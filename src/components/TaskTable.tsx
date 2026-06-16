import { ChevronRight, Clock, Grid3X3, GitBranch, Target, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { ComputeTask } from '@/types';
import { getStatusBgColor, formatScientific, formatTimeAgo } from '@/utils/api';
import { useClusterStore } from '@/store/clusterStore';

interface TaskTableProps {
  tasks: ComputeTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

const CANCELLABLE_STATUSES = new Set(['PENDING', 'QUEUED', 'RUNNING']);

export function TaskTable({ tasks, selectedTaskId, onSelectTask }: TaskTableProps) {
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCancel = async (e: React.MouseEvent, task: ComputeTask) => {
    e.stopPropagation();
    if (cancellingIds.has(task.id)) return;

    setCancellingIds((prev) => new Set(prev).add(task.id));

    try {
      const cancelFn = useClusterStore.getState().cancelTask;
      const result = await cancelFn(task.id);
      if (result.acknowledged) {
        showToast(`任务 ${task.name} 取消请求已派发: ${result.status}${result.message ? ` - ${result.message}` : ''}`);
      } else {
        showToast(`取消失败: ${result.message || '未知错误'}`);
      }
    } catch (err) {
      showToast(`取消请求失败: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }, 1000);
    }
  };

  const progressBarColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-lab-success';
      case 'CANCELLED': return 'bg-lab-textMuted';
      case 'CANCELLING': return 'bg-lab-warning';
      case 'RUNNING': return 'bg-lab-running';
      case 'FAILED': return 'bg-lab-error';
      default: return 'bg-lab-pending';
    }
  };

  return (
    <div className="bg-lab-bgCard rounded-lg border border-lab-border overflow-hidden relative">
      {toastMsg && (
        <div className="absolute top-3 right-3 z-10 bg-lab-bgLight border border-lab-border text-lab-text text-sm px-4 py-2 rounded-md shadow-xl animate-pulse-soft">
          {toastMsg}
        </div>
      )}

      <div className="px-4 py-3 border-b border-lab-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-lab-text flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-lab-running" />
          计算任务列表
        </h2>
        <span className="text-sm text-lab-textMuted font-mono">
          共 {tasks.length} 个任务
        </span>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-lab-bg sticky top-0">
            <tr className="text-lab-textMuted text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">任务 ID</th>
              <th className="px-4 py-3 text-left font-medium">名称</th>
              <th className="px-4 py-3 text-left font-medium">矩阵维度</th>
              <th className="px-4 py-3 text-left font-medium">迭代</th>
              <th className="px-4 py-3 text-left font-medium">当前残差</th>
              <th className="px-4 py-3 text-left font-medium">进度</th>
              <th className="px-4 py-3 text-left font-medium">状态</th>
              <th className="px-4 py-3 text-left font-medium">创建时间</th>
              <th className="px-4 py-3 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lab-border">
            {tasks.map((task) => {
              const isCancellable = CANCELLABLE_STATUSES.has(task.status);
              const isNowCancelling = cancellingIds.has(task.id);

              return (
                <tr
                  key={task.id}
                  className={`hover:bg-lab-bg/50 transition-colors cursor-pointer ${
                    selectedTaskId === task.id ? 'bg-lab-bgLight/30' : ''
                  }`}
                  onClick={() => onSelectTask(task.id)}
                >
                  <td className="px-4 py-3 font-mono text-lab-text text-xs">
                    {task.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-lab-text font-medium">
                    {task.name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-mono text-lab-text">
                      <Grid3X3 className="w-3.5 h-3.5 text-lab-textMuted" />
                      {task.matrixDimension.toLocaleString()} × {task.matrixDimension.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-lab-text">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-lab-textMuted" />
                      {task.currentIteration.toLocaleString()}
                      <span className="text-lab-textMuted">/</span>
                      {task.totalIterations.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-lab-textMuted" />
                      <span className={task.currentResidual <= task.targetResidual ? 'text-lab-success' : 'text-lab-warning'}>
                        {formatScientific(task.currentResidual)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-lab-bg rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progressBarColor(task.status)}`}
                          style={{ width: `${task.progressPercent}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-lab-text w-10 text-right">
                        {task.progressPercent.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getStatusBgColor(task.status)}`}>
                      {task.status === 'RUNNING' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-lab-running mr-1.5 animate-pulse" />
                      )}
                      {task.status === 'CANCELLING' && (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      )}
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-lab-textMuted text-xs font-mono">
                    {formatTimeAgo(task.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {isCancellable && (
                        <button
                          onClick={(e) => handleCancel(e, task)}
                          disabled={isNowCancelling}
                          className="p-1.5 rounded hover:bg-lab-error/20 text-lab-textMuted hover:text-lab-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="取消任务"
                        >
                          {isNowCancelling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <ChevronRight className={`w-4 h-4 transition-transform ${
                        selectedTaskId === task.id ? 'rotate-90 text-lab-running' : 'text-lab-textMuted'
                      }`} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tasks.length === 0 && (
          <div className="py-12 text-center text-lab-textMuted">
            <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无计算任务</p>
          </div>
        )}
      </div>
    </div>
  );
}
