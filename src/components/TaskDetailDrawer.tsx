import { X, Grid3X3, Clock, Target, Server, GitBranch, FileCode, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useClusterStore } from '@/store/clusterStore';
import { getStatusBgColor, formatScientific, formatTimeAgo } from '@/utils/api';

export function TaskDetailDrawer() {
  const { selectedTaskId, dashboardData, convergenceData, setSelectedTaskId } = useClusterStore();
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

  const task = dashboardData?.tasks.find((t) => t.id === selectedTaskId);
  const taskConvergence = selectedTaskId ? convergenceData.get(selectedTaskId) : undefined;

  if (!selectedTaskId || !task) return null;

  const toggleSubtask = (subtaskId: string) => {
    setExpandedSubtasks((prev) => {
      const next = new Set(prev);
      if (next.has(subtaskId)) {
        next.delete(subtaskId);
      } else {
        next.add(subtaskId);
      }
      return next;
    });
  };

  const nodeNameMap = new Map(
    dashboardData?.nodes?.map((n) => [n.id, n.name]) || []
  );

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-lab-bgCard border-l border-lab-border shadow-2xl z-50 flex flex-col">
      <div className="px-6 py-4 border-b border-lab-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-lab-text flex items-center gap-2">
            <FileCode className="w-5 h-5 text-lab-running" />
            任务详情
          </h2>
          <p className="text-sm text-lab-textMuted font-mono mt-0.5">{task.id}</p>
        </div>
        <button
          onClick={() => setSelectedTaskId(null)}
          className="p-2 hover:bg-lab-bg rounded-lg transition-colors text-lab-textMuted hover:text-lab-text"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-lab-bg rounded-lg border border-lab-border p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-lab-text">{task.name}</h3>
              <p className="text-sm text-lab-textMuted mt-1">{task.physicsFormula}</p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border ${getStatusBgColor(task.status)}`}>
              {task.status === 'RUNNING' && (
                <span className="w-1.5 h-1.5 rounded-full bg-lab-running mr-1.5 animate-pulse" />
              )}
              {task.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoItem
              icon={<Grid3X3 className="w-4 h-4" />}
              label="矩阵维度"
              value={`${task.matrixDimension.toLocaleString()} × ${task.matrixDimension.toLocaleString()}`}
              mono
            />
            <InfoItem
              icon={<GitBranch className="w-4 h-4" />}
              label="子任务数"
              value={`${task.splitCount} 个`}
              mono
            />
            <InfoItem
              icon={<Clock className="w-4 h-4" />}
              label="当前迭代"
              value={`${task.currentIteration.toLocaleString()} / ${task.totalIterations.toLocaleString()}`}
              mono
            />
            <InfoItem
              icon={<Target className="w-4 h-4" />}
              label="当前残差"
              value={formatScientific(task.currentResidual)}
              mono
              valueColor={task.currentResidual <= task.targetResidual ? 'text-lab-success' : 'text-lab-warning'}
            />
            <InfoItem
              icon={<Target className="w-4 h-4" />}
              label="目标残差"
              value={formatScientific(task.targetResidual)}
              mono
            />
            <InfoItem
              icon={<Server className="w-4 h-4" />}
              label="分配节点"
              value={`${task.assignedNodes.length} 个`}
              mono
            />
          </div>

          <div className="mt-4 pt-4 border-t border-lab-border">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-lab-textMuted">总进度</span>
              <span className="text-lab-text font-mono font-bold">{task.progressPercent.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-lab-bgLight rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  task.status === 'COMPLETED' ? 'bg-lab-success' :
                  task.status === 'RUNNING' ? 'bg-lab-running' :
                  task.status === 'FAILED' ? 'bg-lab-error' : 'bg-lab-pending'
                }`}
                style={{ width: `${task.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-lab-border grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-lab-textMuted">创建时间</span>
              <p className="text-lab-text font-mono mt-0.5">{formatTimeAgo(task.createdAt)}</p>
            </div>
            <div>
              <span className="text-lab-textMuted">开始时间</span>
              <p className="text-lab-text font-mono mt-0.5">{task.startedAt ? formatTimeAgo(task.startedAt) : '--'}</p>
            </div>
            <div>
              <span className="text-lab-textMuted">完成时间</span>
              <p className="text-lab-text font-mono mt-0.5">{task.completedAt ? formatTimeAgo(task.completedAt) : '--'}</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-lab-text mb-3 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-lab-pending" />
            子任务列表
          </h4>
          <div className="space-y-2">
            {task.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="bg-lab-bg rounded-lg border border-lab-border overflow-hidden"
              >
                <button
                  onClick={() => toggleSubtask(subtask.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-lab-bgLight/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedSubtasks.has(subtask.id) ? (
                      <ChevronUp className="w-4 h-4 text-lab-textMuted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-lab-textMuted" />
                    )}
                    <div>
                      <div className="text-sm text-lab-text font-mono">
                        {subtask.id.slice(0, 12)}...
                      </div>
                      <div className="text-xs text-lab-textMuted mt-0.5">
                        行 {subtask.matrixStartRow} - {subtask.matrixEndRow}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-mono text-lab-text">
                        {subtask.currentIteration}/{subtask.maxIterations} 步
                      </div>
                      <div className="text-xs font-mono text-lab-textMuted">
                        {formatScientific(subtask.currentResidual)}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${getStatusBgColor(subtask.status)}`}>
                      {subtask.status}
                    </span>
                  </div>
                </button>

                {expandedSubtasks.has(subtask.id) && (
                  <div className="px-4 pb-4 pt-0 border-t border-lab-border/50">
                    <div className="pt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-lab-textMuted">分配节点</span>
                        <p className="text-lab-text font-mono mt-0.5">
                          {nodeNameMap.get(subtask.nodeId) || subtask.nodeId}
                        </p>
                      </div>
                      <div>
                        <span className="text-lab-textMuted">计算耗时</span>
                        <p className="text-lab-text font-mono mt-0.5">
                          {subtask.computeTimeMs ? `${(subtask.computeTimeMs / 1000).toFixed(2)}s` : '--'}
                        </p>
                      </div>
                    </div>

                    {subtask.eigenvalues && subtask.eigenvalues.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-lab-border/50">
                        <span className="text-lab-textMuted text-xs">计算得到的特征值</span>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {subtask.eigenvalues.slice(0, 6).map((val, idx) => (
                            <span key={idx} className="px-2 py-1 bg-lab-bgLight/50 rounded text-xs font-mono text-lab-text">
                              λ{idx + 1} = {formatScientific(val)}
                            </span>
                          ))}
                          {subtask.eigenvalues.length > 6 && (
                            <span className="px-2 py-1 text-xs font-mono text-lab-textMuted">
                              +{subtask.eigenvalues.length - 6} 更多
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {subtask.convergenceHistory.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-lab-border/50">
                        <span className="text-lab-textMuted text-xs">收敛历史 (最近5步)</span>
                        <div className="mt-2 space-y-1">
                          {[...subtask.convergenceHistory].reverse().slice(0, 5).map((point, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs font-mono">
                              <span className="text-lab-textMuted">迭代 {point.iteration}</span>
                              <span className={point.residual <= task.targetResidual ? 'text-lab-success' : 'text-lab-warning'}>
                                {formatScientific(point.residual)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {taskConvergence && taskConvergence.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-lab-text mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-lab-success" />
              收敛统计
            </h4>
            <div className="bg-lab-bg rounded-lg border border-lab-border p-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoItem
                  icon={<Clock className="w-4 h-4" />}
                  label="总迭代步数"
                  value={taskConvergence.length.toString()}
                  mono
                />
                <InfoItem
                  icon={<Target className="w-4 h-4" />}
                  label="初始残差"
                  value={formatScientific(taskConvergence[0]?.residual || 0)}
                  mono
                />
                <InfoItem
                  icon={<Target className="w-4 h-4" />}
                  label="最终残差"
                  value={formatScientific(taskConvergence[taskConvergence.length - 1]?.residual || 0)}
                  mono
                  valueColor={
                    taskConvergence[taskConvergence.length - 1]?.residual <= task.targetResidual
                      ? 'text-lab-success'
                      : 'text-lab-warning'
                  }
                />
                <InfoItem
                  icon={<GitBranch className="w-4 h-4" />}
                  label="收敛率"
                  value={calculateConvergenceRate(taskConvergence, task.targetResidual)}
                  mono
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}

function InfoItem({ icon, label, value, mono, valueColor }: InfoItemProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-lab-textMuted mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`${mono ? 'font-mono' : ''} ${valueColor || 'text-lab-text'} font-semibold`}>
        {value}
      </p>
    </div>
  );
}

function calculateConvergenceRate(points: Array<{ residual: number }>, target: number): string {
  if (points.length < 2) return '--';
  const convergedPoints = points.filter((p) => p.residual <= target);
  const rate = (convergedPoints.length / points.length) * 100;
  return `${rate.toFixed(1)}%`;
}
