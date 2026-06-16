import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Activity } from 'lucide-react';
import { useClusterStore } from '@/store/clusterStore';
import { formatScientific } from '@/utils/api';

const TASK_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];

interface ChartDataPoint {
  iteration: number;
  [key: string]: number | string | undefined;
}

export function ConvergenceChart() {
  const { dashboardData, selectedTaskId, convergenceData } = useClusterStore();

  const selectedTask = dashboardData?.tasks?.find((t) => t.id === selectedTaskId);
  const selectedConvergence = selectedTaskId ? convergenceData.get(selectedTaskId) : undefined;

  const chartData = useMemo(() => {
    if (!dashboardData?.tasks) return [];

    const tasksToShow = selectedTaskId && selectedConvergence && selectedConvergence.length > 0
      ? [{ id: selectedTaskId, data: selectedConvergence }]
      : dashboardData.tasks
          .filter((t) => t.status === 'RUNNING' || t.status === 'COMPLETED')
          .slice(0, 4)
          .map((t) => ({
            id: t.id,
            data: t.subtasks.flatMap((st) => st.convergenceHistory)
              .sort((a, b) => a.iteration - b.iteration),
          }))
          .filter((t) => t.data.length > 0);

    if (tasksToShow.length === 0) return [];

    const maxIterations = Math.max(...tasksToShow.map((t) => Math.max(...t.data.map((d) => d.iteration))));
    const dataPoints: ChartDataPoint[] = [];

    for (let i = 1; i <= maxIterations; i++) {
      const point: ChartDataPoint = { iteration: i };
      tasksToShow.forEach((task) => {
        const dataPoint = task.data.find((d) => d.iteration === i);
        if (dataPoint) {
          point[`task_${task.id}`] = dataPoint.residual;
          point[`task_${task.id}_label`] = dashboardData.tasks.find((t) => t.id === task.id)?.name || task.id;
        }
      });
      dataPoints.push(point);
    }

    return dataPoints;
  }, [dashboardData, selectedTaskId, selectedConvergence]);

  const legendItems = useMemo(() => {
    if (!dashboardData?.tasks) return [];

    const tasksToShow = selectedTaskId && selectedConvergence && selectedConvergence.length > 0
      ? [dashboardData.tasks.find((t) => t.id === selectedTaskId)].filter(Boolean)
      : dashboardData.tasks
          .filter((t) => t.status === 'RUNNING' || t.status === 'COMPLETED')
          .slice(0, 4);

    return tasksToShow.map((task, idx) => ({
      id: task?.id || '',
      name: task?.name || '',
      color: TASK_COLORS[idx % TASK_COLORS.length],
    }));
  }, [dashboardData, selectedTaskId, selectedConvergence]);

  const targetResidual = selectedTask?.targetResidual ?? 1e-8;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: number }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-lab-bgCard border border-lab-border rounded-lg p-3 shadow-xl">
        <p className="text-lab-text font-mono text-sm mb-2">迭代步数: {label}</p>
        {payload.map((entry, index) => {
          const task = dashboardData?.tasks.find((t) => t.id === entry.dataKey.replace('task_', ''));
          return (
            <div key={index} className="flex items-center gap-2 text-xs mb-1">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-lab-textMuted">{task?.name || entry.dataKey}:</span>
              <span className="text-lab-text font-mono">{formatScientific(entry.value)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-lab-bgCard rounded-lg border border-lab-border overflow-hidden">
      <div className="px-4 py-3 border-b border-lab-border">
        <h2 className="text-lg font-semibold text-lab-text flex items-center gap-2">
          <Activity className="w-5 h-5 text-lab-success" />
          残差收敛曲线
          {selectedTask && (
            <span className="text-sm font-normal text-lab-textMuted ml-2">
              - {selectedTask.name}
            </span>
          )}
        </h2>
      </div>
      <div className="p-4 h-[380px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <defs>
                {legendItems.map((item) => (
                  <linearGradient key={item.id} id={`gradient-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={item.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.5} />
              <XAxis
                dataKey="iteration"
                stroke="#94A3B8"
                tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                label={{ value: '迭代步数', position: 'insideBottom', offset: -5, fill: '#94A3B8', fontSize: 12 }}
              />
              <YAxis
                scale="log"
                domain={['auto', 'auto']}
                stroke="#94A3B8"
                tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(value) => formatScientific(value)}
                label={{ value: '残差 (对数刻度)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => {
                  const item = legendItems.find((l) => `task_${l.id}` === value);
                  return <span className="text-lab-text text-xs">{item?.name || value}</span>;
                }}
              />
              <ReferenceLine
                y={targetResidual}
                stroke="#10B981"
                strokeDasharray="5 5"
                label={{ value: `目标残差 ${formatScientific(targetResidual)}`, fill: '#10B981', fontSize: 11, position: 'right' }}
              />
              {legendItems.map((item) => (
                <Line
                  key={item.id}
                  type="monotone"
                  dataKey={`task_${item.id}`}
                  stroke={item.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-lab-textMuted">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无收敛数据</p>
              <p className="text-sm mt-1">选择运行中的任务查看实时收敛曲线</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
