import { Server, Cpu, HardDrive, Activity, Clock, AlertTriangle } from 'lucide-react';
import { useClusterStore } from '@/store/clusterStore';

export function StatusHeader() {
  const { dashboardData, lastUpdate, isLoading } = useClusterStore();
  const summary = dashboardData?.summary;

  const formatTime = (date: Date | null) => {
    if (!date) return '--';
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  return (
    <div className="bg-lab-bgCard border-b border-lab-border px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-lab-running" />
          <div>
            <h1 className="text-2xl font-bold text-lab-text font-sans">
              矩阵特征值并行计算平台
            </h1>
            <p className="text-sm text-lab-textMuted">Matrix Eigenvalue Parallel Computing Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-lab-textMuted text-sm">
          <Clock className="w-4 h-4" />
          <span className="font-mono">
            {isLoading ? (
              <span className="text-lab-running animate-pulse-soft">同步中...</span>
            ) : (
              `最后更新: ${formatTime(lastUpdate)}`
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Server className="w-5 h-5" />}
          label="总节点数"
          value={summary?.totalNodes ?? 0}
          color="text-lab-text"
        />
        <StatCard
          icon={<Server className="w-5 h-5" />}
          label="在线节点"
          value={summary?.onlineNodes ?? 0}
          color="text-lab-success"
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="运行中任务"
          value={summary?.runningTasks ?? 0}
          color="text-lab-running"
          pulse={summary?.runningTasks && summary.runningTasks > 0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="等待中任务"
          value={summary?.pendingTasks ?? 0}
          color="text-lab-pending"
        />
        <StatCard
          icon={<Cpu className="w-5 h-5" />}
          label="平均 CPU"
          value={`${summary?.avgCpuUsage?.toFixed(1) ?? 0}%`}
          color={summary && summary.avgCpuUsage > 80 ? 'text-lab-error' : 'text-lab-cpu'}
        />
        <StatCard
          icon={<HardDrive className="w-5 h-5" />}
          label="平均内存"
          value={`${summary?.avgMemoryUsage?.toFixed(1) ?? 0}%`}
          color={summary && summary.avgMemoryUsage > 85 ? 'text-lab-error' : 'text-lab-memory'}
        />
      </div>

      {summary && summary.onlineNodes < summary.totalNodes && (
        <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-lab-warning/10 border border-lab-warning/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-lab-warning" />
          <span className="text-sm text-lab-warning">
            警告：{summary.totalNodes - summary.onlineNodes} 个计算节点离线
          </span>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  pulse?: boolean;
}

function StatCard({ icon, label, value, color, pulse }: StatCardProps) {
  return (
    <div className="bg-lab-bg rounded-lg border border-lab-border p-3 hover:border-lab-bgLight transition-colors">
      <div className="flex items-center gap-2 text-lab-textMuted text-sm mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold font-mono ${color} ${pulse ? 'animate-pulse-soft' : ''}`}>
        {value}
      </div>
    </div>
  );
}
