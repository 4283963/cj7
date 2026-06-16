import { ChevronRight, Clock, Grid3X3, GitBranch, Target } from 'lucide-react';
import type { ComputeTask } from '@/types';
import { getStatusBgColor, formatScientific, formatTimeAgo } from '@/utils/api';

interface TaskTableProps {
  tasks: ComputeTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export function TaskTable({ tasks, selectedTaskId, onSelectTask }: TaskTableProps) {
  return (
    <div className="bg-lab-bgCard rounded-lg border border-lab-border overflow-hidden">
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
              <th className="px-4 py-3 text-center font-medium">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lab-border">
            {tasks.map((task) => (
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
                        className={`h-full rounded-full transition-all duration-500 ${
                          task.status === 'COMPLETED' ? 'bg-lab-success' :
                          task.status === 'RUNNING' ? 'bg-lab-running' :
                          task.status === 'FAILED' ? 'bg-lab-error' : 'bg-lab-pending'
                        }`}
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
                    {task.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-lab-textMuted text-xs font-mono">
                  {formatTimeAgo(task.createdAt)}
                </td>
                <td className="px-4 py-3 text-center">
                  <ChevronRight className={`w-4 h-4 mx-auto transition-transform ${
                    selectedTaskId === task.id ? 'rotate-90 text-lab-running' : 'text-lab-textMuted'
                  }`} />
                </td>
              </tr>
            ))}
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
