from flask import Flask, request, jsonify
import threading
import time
import requests
from datetime import datetime
from config import Config
from services.task_executor import TaskExecutor
from services.resource_monitor import ResourceMonitor
from compute.matrix_ops import create_random_matrix

app = Flask(__name__)

app.config['JSON_SORT_KEYS'] = False

config = Config()
task_executor = TaskExecutor(config.NODE_ID, config.SCHEDULER_URL)
resource_monitor = ResourceMonitor()


def send_heartbeat():
    while True:
        try:
            usage = resource_monitor.get_current_usage()
            active_count = task_executor.get_active_task_count()

            heartbeat_data = {
                'nodeId': config.NODE_ID,
                'name': config.NODE_NAME,
                'hostname': config.HOST,
                'port': config.PORT,
                'cpuUsage': usage['cpuUsage'],
                'memoryUsage': usage['memoryUsage'],
                'memoryTotalGB': usage['memoryTotalGB'],
                'memoryUsedGB': usage['memoryUsedGB'],
                'activeTasks': active_count,
                'status': 'BUSY' if active_count > 0 else 'ONLINE',
                'lastHeartbeat': datetime.now().isoformat()
            }

            url = f'{config.SCHEDULER_URL}/api/nodes/{config.NODE_ID}/heartbeat'
            with requests.Session() as s:
                s.post(url, json=heartbeat_data, timeout=2.0)

        except Exception as e:
            pass

        time.sleep(config.HEARTBEAT_INTERVAL / 1000)


@app.route('/health', methods=['GET'])
def health_check():
    usage = resource_monitor.get_current_usage()
    return jsonify({
        'status': 'healthy',
        'nodeId': config.NODE_ID,
        'activeTasks': task_executor.get_active_task_count(),
        'resources': usage,
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/compute/submit', methods=['POST'])
def submit_task():
    try:
        task_data = request.get_json(force=True, silent=True)
        if not task_data:
            return jsonify({'error': 'Invalid JSON payload'}), 400

        if 'matrixData' not in task_data:
            if 'matrixDimension' in task_data:
                size = task_data['matrixDimension']
                end_row = task_data.get('matrixEndRow', size)
                start_row = task_data.get('matrixStartRow', 0)
                sub_size = max(1, end_row - start_row)
                task_data['matrixData'] = create_random_matrix(
                    sub_size, symmetric=True
                ).tolist()

        if task_executor.get_active_task_count() >= config.MAX_CONCURRENT_TASKS:
            return jsonify({
                'error': 'Node is busy',
                'activeTasks': task_executor.get_active_task_count(),
                'maxConcurrent': config.MAX_CONCURRENT_TASKS,
            }), 503

        result = task_executor.execute_task(task_data)
        return jsonify(result), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/compute/tasks/<subtask_id>', methods=['GET'])
def get_task_status(subtask_id):
    status = task_executor.get_task_status(subtask_id)
    if status:
        return jsonify(status)
    return jsonify({'error': 'Task not found', 'subtaskId': subtask_id}), 404


@app.route('/api/compute/tasks/<subtask_id>/cancel', methods=['POST'])
def cancel_task(subtask_id):
    result = task_executor.cancel_task(subtask_id)

    if result.get('status') == 'NOT_FOUND':
        return jsonify(result), 404

    return jsonify(result), 202


@app.route('/api/resources', methods=['GET'])
def get_resources():
    usage = resource_monitor.get_current_usage()
    system = resource_monitor.get_system_info()
    return jsonify({
        'current': usage,
        'system': system,
        'activeTasks': task_executor.get_active_task_count()
    })


@app.route('/api/compute/test', methods=['POST'])
def test_computation():
    try:
        data = request.get_json(force=True, silent=True) or {}
        size = data.get('size', 1000)
        target_residual = data.get('targetResidual', 1e-8)
        max_iterations = data.get('maxIterations', 100)

        from compute.eigenvalue import compute_eigenvalues

        start = time.time()
        matrix = create_random_matrix(size, symmetric=True, positive_definite=True)
        eigenvalues, eigenvectors = compute_eigenvalues(
            matrix, k=10, tol=target_residual, maxiter=max_iterations
        )
        compute_time = time.time() - start

        return jsonify({
            'matrixSize': size,
            'eigenvalues': eigenvalues.tolist(),
            'computeTimeSeconds': compute_time,
            'iterations': max_iterations
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.before_request
def before_request_logging():
    request._start_time = time.time()


@app.after_request
def after_request_logging(response):
    if hasattr(request, '_start_time'):
        elapsed = (time.time() - request._start_time) * 1000
        if elapsed > 1000:
            app.logger.warning(
                f"慢请求: {request.method} {request.path} -> {response.status_code} "
                f"耗时 {elapsed:.1f}ms"
            )
    return response


if __name__ == '__main__':
    heartbeat_thread = threading.Thread(target=send_heartbeat, daemon=True)
    heartbeat_thread.start()

    print(f"Starting compute node {config.NODE_ID} on port {config.PORT}")
    print(f"Scheduler URL: {config.SCHEDULER_URL}")
    print(f"Max concurrent tasks: {config.MAX_CONCURRENT_TASKS}")
    print(f"Cancel policy: soft-3s/SIGTERM-5s/SIGKILL")
    print("  NOTE: 生产环境请使用 gunicorn --workers 4 --threads 32 -b 0.0.0.0:5001 app:app")

    app.run(
        host=config.HOST,
        port=config.PORT,
        threaded=True,
        processes=1,
        request_timeout=120,
    )
