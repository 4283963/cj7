import os

class Config:
    NODE_ID = os.environ.get('NODE_ID', 'node-001')
    NODE_NAME = os.environ.get('NODE_NAME', '计算节点-01')
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 5000))
    SCHEDULER_URL = os.environ.get('SCHEDULER_URL', 'http://localhost:8080')
    CALLBACK_URL = os.environ.get('CALLBACK_URL', f'http://localhost:{PORT}')
    HEARTBEAT_INTERVAL = int(os.environ.get('HEARTBEAT_INTERVAL', 5000))
    MAX_CONCURRENT_TASKS = int(os.environ.get('MAX_CONCURRENT_TASKS', 2))
