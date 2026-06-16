import numpy as np
import time
import threading
import requests
from datetime import datetime
from compute.eigenvalue import compute_eigenvalues, calculate_residual
from compute.physics_solver import apply_physics_formula
from services.resource_monitor import ResourceMonitor

class TaskExecutor:
    def __init__(self, node_id, scheduler_url):
        self.node_id = node_id
        self.scheduler_url = scheduler_url
        self.active_tasks = {}
        self.task_lock = threading.Lock()
        self.resource_monitor = ResourceMonitor()
    
    def execute_task(self, task_data):
        subtask_id = task_data['subtaskId']
        task_id = task_data['taskId']
        matrix_data = np.array(task_data['matrixData'])
        target_residual = task_data.get('targetResidual', 1e-8)
        max_iterations = task_data.get('maxIterations', 1000)
        physics_formula = task_data.get('physicsFormula', 'default')
        callback_url = task_data.get('callbackUrl', f'{self.scheduler_url}/api/compute/callback')
        
        task_thread = threading.Thread(
            target=self._run_computation,
            args=(subtask_id, task_id, matrix_data, target_residual, 
                  max_iterations, physics_formula, callback_url)
        )
        task_thread.daemon = True
        task_thread.start()
        
        with self.task_lock:
            self.active_tasks[subtask_id] = {
                'thread': task_thread,
                'status': 'RUNNING',
                'startTime': time.time()
            }
        
        return {'subtaskId': subtask_id, 'status': 'RUNNING', 'nodeId': self.node_id}
    
    def _run_computation(self, subtask_id, task_id, matrix, target_residual, 
                         max_iterations, physics_formula, callback_url):
        try:
            start_time = time.time()
            convergence_history = []
            
            n = matrix.shape[0]
            current_matrix = matrix.copy()
            eigenvalues = None
            eigenvectors = None
            
            for iteration in range(1, max_iterations + 1):
                if subtask_id not in self.active_tasks:
                    break
                
                eigenvalues, eigenvectors = apply_physics_formula(current_matrix, physics_formula)
                
                if eigenvalues is not None and len(eigenvalues) > 0:
                    residual = calculate_residual(current_matrix, eigenvalues[0], eigenvectors[:, 0])
                else:
                    residual = 1.0
                
                convergence_history.append({
                    'iteration': iteration,
                    'residual': float(residual),
                    'timestamp': datetime.now().isoformat(),
                    'subtaskId': subtask_id
                })
                
                self._send_progress_update(subtask_id, task_id, iteration, residual)
                
                if residual < target_residual:
                    break
                
                time.sleep(0.05)
            
            compute_time_ms = int((time.time() - start_time) * 1000)
            
            result = {
                'subtaskId': subtask_id,
                'taskId': task_id,
                'status': 'COMPLETED',
                'eigenvalues': eigenvalues.tolist() if eigenvalues is not None else [],
                'eigenvectors': eigenvectors.tolist() if eigenvectors is not None else [],
                'convergenceHistory': convergence_history,
                'finalResidual': convergence_history[-1]['residual'] if convergence_history else 0,
                'iterations': len(convergence_history),
                'nodeId': self.node_id,
                'computeTimeMs': compute_time_ms
            }
            
            self._send_callback(callback_url, result)
            
        except Exception as e:
            compute_time_ms = int((time.time() - start_time) * 1000)
            result = {
                'subtaskId': subtask_id,
                'taskId': task_id,
                'status': 'FAILED',
                'eigenvalues': [],
                'eigenvectors': [],
                'convergenceHistory': convergence_history,
                'finalResidual': 0,
                'iterations': len(convergence_history),
                'nodeId': self.node_id,
                'computeTimeMs': compute_time_ms,
                'error': str(e)
            }
            self._send_callback(callback_url, result)
        
        finally:
            with self.task_lock:
                if subtask_id in self.active_tasks:
                    del self.active_tasks[subtask_id]
    
    def _send_progress_update(self, subtask_id, task_id, iteration, residual):
        try:
            url = f'{self.scheduler_url}/api/compute/progress'
            data = {
                'subtaskId': subtask_id,
                'taskId': task_id,
                'nodeId': self.node_id,
                'iteration': iteration,
                'currentResidual': float(residual)
            }
            requests.post(url, json=data, timeout=2)
        except:
            pass
    
    def _send_callback(self, callback_url, result):
        try:
            requests.post(callback_url, json=result, timeout=5)
        except Exception as e:
            print(f"Callback failed: {e}")
    
    def cancel_task(self, subtask_id):
        with self.task_lock:
            if subtask_id in self.active_tasks:
                del self.active_tasks[subtask_id]
                return True
        return False
    
    def get_active_task_count(self):
        with self.task_lock:
            return len(self.active_tasks)
    
    def get_task_status(self, subtask_id):
        with self.task_lock:
            if subtask_id in self.active_tasks:
                task_info = self.active_tasks[subtask_id]
                return {
                    'subtaskId': subtask_id,
                    'status': task_info['status'],
                    'elapsedTime': time.time() - task_info['startTime']
                }
        return None
