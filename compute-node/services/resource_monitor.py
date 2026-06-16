import psutil
import time
from datetime import datetime

class ResourceMonitor:
    def __init__(self):
        self.cpu_history = []
        self.memory_history = []
        self.max_history = 100
    
    def get_current_usage(self):
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        
        return {
            'cpuUsage': cpu_percent,
            'memoryUsage': memory.percent,
            'memoryTotalGB': memory.total / (1024**3),
            'memoryUsedGB': memory.used / (1024**3),
            'timestamp': datetime.now().isoformat()
        }
    
    def get_process_usage(self, pid=None):
        if pid is None:
            pid = psutil.Process().pid
        
        process = psutil.Process(pid)
        return {
            'pid': pid,
            'cpuPercent': process.cpu_percent(interval=0.1),
            'memoryRSS': process.memory_info().rss / (1024**2),
            'memoryVMS': process.memory_info().vms / (1024**2),
            'numThreads': process.num_threads()
        }
    
    def get_system_info(self):
        return {
            'cpuCount': psutil.cpu_count(logical=True),
            'cpuCountPhysical': psutil.cpu_count(logical=False),
            'totalMemoryGB': psutil.virtual_memory().total / (1024**3),
            'availableMemoryGB': psutil.virtual_memory().available / (1024**3),
            'diskUsage': psutil.disk_usage('/').percent,
            'loadAverage': psutil.getloadavg()
        }
    
    def record_usage(self):
        usage = self.get_current_usage()
        self.cpu_history.append(usage['cpuUsage'])
        self.memory_history.append(usage['memoryUsage'])
        
        if len(self.cpu_history) > self.max_history:
            self.cpu_history.pop(0)
            self.memory_history.pop(0)
        
        return usage
    
    def get_average_usage(self, window=10):
        if not self.cpu_history:
            return {'avgCpu': 0, 'avgMemory': 0}
        
        window_cpu = self.cpu_history[-min(window, len(self.cpu_history)):]
        window_mem = self.memory_history[-min(window, len(self.memory_history)):]
        
        return {
            'avgCpu': sum(window_cpu) / len(window_cpu),
            'avgMemory': sum(window_mem) / len(window_mem)
        }
