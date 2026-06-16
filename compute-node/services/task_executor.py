import numpy as np
import time
import threading
import multiprocessing as mp
import requests
import signal
import logging
from datetime import datetime
from queue import Empty
from compute.eigenvalue import compute_eigenvalues, calculate_residual, CancellationToken
from compute.physics_solver import apply_physics_formula
from services.resource_monitor import ResourceMonitor

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


def _worker_process(subtask_id, task_id, matrix_data, target_residual,
                    max_iterations, physics_formula, chunk_size,
                    result_queue, progress_queue, cancel_flag,
                    worker_ready):
    """独立的子进程：真正执行计算的地方。
    好处：1) 出问题可以 SIGKILL；2) 内存隔离，大矩阵不污染主进程；3) 取消时可以硬终止。
    """
    try:
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)

        cancel_token = CancellationToken()
        cancel_token._flag = cancel_flag

        worker_ready.set()

        matrix = np.array(matrix_data)
        n = matrix.shape[0]
        current_matrix = matrix.copy()
        eigenvalues = None
        eigenvectors = None
        convergence_history = []
        start_time = time.time()

        for iteration in range(1, max_iterations + 1):
            if cancel_flag.value:
                result_queue.put({
                    'type': 'CANCELLED',
                    'subtaskId': subtask_id,
                    'taskId': task_id,
                    'iterations': len(convergence_history),
                    'convergenceHistory': convergence_history,
                    'finalResidual': convergence_history[-1]['residual'] if convergence_history else 0,
                    'computeTimeMs': int((time.time() - start_time) * 1000),
                    'nodeId': None,
                })
                return

            try:
                eigenvalues, eigenvectors = apply_physics_formula(
                    current_matrix, physics_formula, cancel_token=cancel_token
                )
            except InterruptedError as e:
                logger.info(f"[{subtask_id}] 计算被可取消检查点中断: {e}")
                result_queue.put({
                    'type': 'CANCELLED',
                    'subtaskId': subtask_id,
                    'taskId': task_id,
                    'iterations': len(convergence_history),
                    'convergenceHistory': convergence_history,
                    'finalResidual': convergence_history[-1]['residual'] if convergence_history else 0,
                    'computeTimeMs': int((time.time() - start_time) * 1000),
                    'nodeId': None,
                })
                return

            if eigenvalues is not None and len(eigenvalues) > 0:
                try:
                    residual = calculate_residual(current_matrix, eigenvalues[0], eigenvectors[:, 0])
                except Exception:
                    residual = 1.0
            else:
                residual = 1.0

            point = {
                'iteration': iteration,
                'residual': float(residual),
                'timestamp': datetime.now().isoformat(),
                'subtaskId': subtask_id
            }
            convergence_history.append(point)

            try:
                progress_queue.put_nowait({
                    'subtaskId': subtask_id,
                    'taskId': task_id,
                    'iteration': iteration,
                    'currentResidual': float(residual),
                })
            except Exception:
                pass

            if residual < target_residual:
                logger.info(f"[{subtask_id}] 在第 {iteration} 步收敛，残差={residual:.2e}")
                break

            if iteration % chunk_size == 0:
                if cancel_flag.value:
                    result_queue.put({
                        'type': 'CANCELLED',
                        'subtaskId': subtask_id,
                        'taskId': task_id,
                        'iterations': len(convergence_history),
                        'convergenceHistory': convergence_history,
                        'finalResidual': convergence_history[-1]['residual'] if convergence_history else 0,
                        'computeTimeMs': int((time.time() - start_time) * 1000),
                        'nodeId': None,
                    })
                    return

            time.sleep(0.02)

        compute_time_ms = int((time.time() - start_time) * 1000)
        result_queue.put({
            'type': 'COMPLETED',
            'subtaskId': subtask_id,
            'taskId': task_id,
            'status': 'COMPLETED',
            'eigenvalues': eigenvalues.tolist() if eigenvalues is not None else [],
            'eigenvectors': eigenvectors.tolist() if eigenvectors is not None else [],
            'convergenceHistory': convergence_history,
            'finalResidual': convergence_history[-1]['residual'] if convergence_history else 0,
            'iterations': len(convergence_history),
            'nodeId': None,
            'computeTimeMs': compute_time_ms,
        })

    except Exception as e:
        logger.exception(f"[{subtask_id}] 子进程计算异常: {e}")
        try:
            result_queue.put({
                'type': 'FAILED',
                'subtaskId': subtask_id,
                'taskId': task_id,
                'status': 'FAILED',
                'eigenvalues': [],
                'eigenvectors': [],
                'convergenceHistory': [],
                'finalResidual': 0,
                'iterations': 0,
                'nodeId': None,
                'computeTimeMs': 0,
                'error': str(e),
            })
        except Exception:
            pass


class TaskExecutor:
    CANCEL_GRACE_PERIOD_SEC = 3.0
    CANCEL_FORCE_TIMEOUT_SEC = 8.0

    def __init__(self, node_id, scheduler_url):
        self.node_id = node_id
        self.scheduler_url = scheduler_url
        self.resource_monitor = ResourceMonitor()

        self.active_tasks = {}
        self.task_lock = threading.Lock()

        self._result_queue: mp.Queue = mp.Queue(maxsize=1024)
        self._progress_queue: mp.Queue = mp.Queue(maxsize=4096)

        self._monitor_thread = None
        self._progress_thread = None
        self._stop_flag = threading.Event()
        self._start_background_threads()

    def _start_background_threads(self):
        self._monitor_thread = threading.Thread(
            target=self._monitor_results, daemon=True, name="result-monitor"
        )
        self._monitor_thread.start()

        self._progress_thread = threading.Thread(
            target=self._monitor_progress, daemon=True, name="progress-monitor"
        )
        self._progress_thread.start()

    def execute_task(self, task_data):
        subtask_id = task_data['subtaskId']
        task_id = task_data['taskId']
        matrix_data = task_data['matrixData']
        target_residual = task_data.get('targetResidual', 1e-8)
        max_iterations = task_data.get('maxIterations', 1000)
        physics_formula = task_data.get('physicsFormula', 'default')
        chunk_size = task_data.get('cancelCheckInterval', 10)

        cancel_flag = mp.Value('b', False)
        worker_ready = mp.Event()

        process = mp.Process(
            target=_worker_process,
            args=(subtask_id, task_id, matrix_data, target_residual,
                  max_iterations, physics_formula, chunk_size,
                  self._result_queue, self._progress_queue,
                  cancel_flag, worker_ready),
            name=f"compute-{subtask_id[:12]}",
            daemon=True,
        )
        process.start()

        ready = worker_ready.wait(timeout=5.0)
        if not ready:
            logger.warning(f"[{subtask_id}] 子进程 5s 内未就绪，但仍继续跟踪")

        with self.task_lock:
            self.active_tasks[subtask_id] = {
                'process': process,
                'cancel_flag': cancel_flag,
                'status': 'RUNNING',
                'startTime': time.time(),
                'cancelling': False,
                'cancelRequestedAt': None,
                'taskId': task_id,
            }

        logger.info(f"[{subtask_id}] 启动子进程 pid={process.pid}, task={task_id}")
        return {'subtaskId': subtask_id, 'status': 'RUNNING', 'nodeId': self.node_id, 'pid': process.pid}

    def cancel_task(self, subtask_id: str) -> dict:
        """异步取消：立刻返回，不等待计算真正停止。
        三级策略：1) 设取消标志(软) → 2) 发 SIGTERM → 3) SIGKILL(硬终止)
        """
        with self.task_lock:
            task = self.active_tasks.get(subtask_id)
            if not task:
                return {'subtaskId': subtask_id, 'status': 'NOT_FOUND', 'acknowledged': True}

            if task['cancelling']:
                return {'subtaskId': subtask_id, 'status': 'CANCELLING', 'acknowledged': True}

            task['cancelling'] = True
            task['status'] = 'CANCELLING'
            task['cancelRequestedAt'] = time.time()
            task['cancel_flag'].value = True
            process: mp.Process = task['process']

        logger.warning(f"[{subtask_id}] 收到取消请求, pid={process.pid}")

        cancel_thread = threading.Thread(
            target=self._cancel_supervisor,
            args=(subtask_id, process),
            daemon=True,
            name=f"cancel-supervisor-{subtask_id[:10]}"
        )
        cancel_thread.start()

        return {
            'subtaskId': subtask_id,
            'status': 'CANCELLING',
            'acknowledged': True,
            'message': 'Cancel request accepted. Use GET /tasks/{id} to poll status.'
        }

    def _cancel_supervisor(self, subtask_id, process: mp.Process):
        """负责三级取消流程的守护线程。"""
        try:
            grace_until = time.time() + self.CANCEL_GRACE_PERIOD_SEC
            while time.time() < grace_until and process.is_alive():
                time.sleep(0.1)

            if process.is_alive():
                logger.warning(f"[{subtask_id}] 软取消超时 ({self.CANCEL_GRACE_PERIOD_SEC}s), 发送 SIGTERM")
                try:
                    process.terminate()
                except Exception:
                    pass

                term_until = time.time() + (self.CANCEL_FORCE_TIMEOUT_SEC - self.CANCEL_GRACE_PERIOD_SEC)
                while time.time() < term_until and process.is_alive():
                    time.sleep(0.08)

                if process.is_alive():
                    logger.critical(f"[{subtask_id}] SIGTERM 无效, 发送 SIGKILL 强制终止 pid={process.pid}")
                    try:
                        process.kill()
                        process.join(timeout=2.0)
                    except Exception as e:
                        logger.error(f"[{subtask_id}] SIGKILL 失败: {e}")

            if not process.is_alive():
                logger.info(f"[{subtask_id}] 进程已终止, exitcode={process.exitcode}")

        except Exception as e:
            logger.exception(f"[{subtask_id}] 取消守护线程异常: {e}")
        finally:
            with self.task_lock:
                if subtask_id in self.active_tasks:
                    del self.active_tasks[subtask_id]
                self._fire_cancel_callback(subtask_id)

    def _fire_cancel_callback(self, subtask_id):
        with self.task_lock:
            task_info = None
        task_id = None
        callback_url = f'{self.scheduler_url}/api/compute/callback'

        def _do_callback():
            try:
                payload = {
                    'subtaskId': subtask_id,
                    'taskId': task_id if task_id else '',
                    'status': 'CANCELLED',
                    'eigenvalues': [],
                    'eigenvectors': [],
                    'convergenceHistory': [],
                    'finalResidual': 0,
                    'iterations': 0,
                    'nodeId': self.node_id,
                    'computeTimeMs': 0,
                    'cancelled': True,
                }
                requests.post(callback_url, json=payload, timeout=3.0)
            except Exception as e:
                logger.debug(f"[{subtask_id}] 取消回调失败(可忽略): {e}")

        threading.Thread(target=_do_callback, daemon=True).start()

    def _monitor_results(self):
        while not self._stop_flag.is_set():
            try:
                result = self._result_queue.get(timeout=0.5)
            except Empty:
                continue

            result_type = result.get('type', 'UNKNOWN')
            subtask_id = result.get('subtaskId')
            result['nodeId'] = self.node_id

            logger.info(f"[{subtask_id}] 收到子进程结果: {result_type}")

            callback_url = f'{self.scheduler_url}/api/compute/callback'

            def _callback(r):
                try:
                    requests.post(callback_url, json=r, timeout=5.0)
                except Exception as e:
                    logger.warning(f"[{subtask_id}] 结果回调失败: {e}")

            threading.Thread(target=_callback, args=(result,), daemon=True).start()

            with self.task_lock:
                if subtask_id in self.active_tasks:
                    proc = self.active_tasks[subtask_id]['process']
                    try:
                        if proc.is_alive():
                            proc.join(timeout=2.0)
                    except Exception:
                        pass
                    del self.active_tasks[subtask_id]

    def _monitor_progress(self):
        progress_batch = []
        last_flush = time.time()
        FLUSH_INTERVAL = 1.0
        BATCH_SIZE = 32

        while not self._stop_flag.is_set():
            try:
                progress = self._progress_queue.get(timeout=0.25)
                progress['nodeId'] = self.node_id
                progress_batch.append(progress)
            except Empty:
                pass

            now = time.time()
            if progress_batch and (len(progress_batch) >= BATCH_SIZE or now - last_flush >= FLUSH_INTERVAL):
                self._flush_progress(progress_batch)
                progress_batch = []
                last_flush = now

        if progress_batch:
            self._flush_progress(progress_batch)

    def _flush_progress(self, batch):
        if not batch:
            return

        def _send():
            try:
                url = f'{self.scheduler_url}/api/compute/progress/batch'
                requests.post(url, json={'items': batch}, timeout=2.0)
            except Exception:
                try:
                    url = f'{self.scheduler_url}/api/compute/progress'
                    for item in batch[-8:]:
                        requests.post(url, json=item, timeout=1.0)
                except Exception:
                    pass

        threading.Thread(target=_send, daemon=True).start()

    def get_active_task_count(self):
        with self.task_lock:
            return len(self.active_tasks)

    def get_task_status(self, subtask_id):
        with self.task_lock:
            task = self.active_tasks.get(subtask_id)
            if not task:
                return None
            process: mp.Process = task['process']
            return {
                'subtaskId': subtask_id,
                'status': task['status'],
                'cancelling': task['cancelling'],
                'elapsedTime': time.time() - task['startTime'],
                'pid': process.pid if process else None,
                'alive': process.is_alive() if process else False,
            }

    def shutdown(self):
        logger.info("TaskExecutor 关闭中, 取消所有活跃任务...")
        self._stop_flag.set()
        with self.task_lock:
            tasks = list(self.active_tasks.keys())
        for sid in tasks:
            self.cancel_task(sid)
