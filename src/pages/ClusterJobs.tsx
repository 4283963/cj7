import { useEffect } from 'react';
import { StatusHeader } from '@/components/StatusHeader';
import { TaskTable } from '@/components/TaskTable';
import { ConvergenceChart } from '@/components/ConvergenceChart';
import { NodeResourceBar } from '@/components/NodeResourceBar';
import { TaskDetailDrawer } from '@/components/TaskDetailDrawer';
import { useClusterStore } from '@/store/clusterStore';
import { generateMockData } from '@/utils/mockData';
import type { ClusterDashboardData, ComputeTask, ComputeNode } from '@/types';

export default function ClusterJobs() {
  const {
    dashboardData,
    selectedTaskId,
    setSelectedTaskId,
    error,
    startPolling,
    stopPolling,
  } = useClusterStore();

  useEffect(() => {
    const initData = async () => {
      const mockData = await generateMockData();
      useClusterStore.setState({ dashboardData: mockData, isLoading: false, lastUpdate: new Date() });
    };
    initData();
    startPolling();

    const interval = setInterval(() => {
      const currentData = useClusterStore.getState().dashboardData;
      if (currentData) {
        const updated = updateMockData(currentData);
        useClusterStore.setState({ dashboardData: updated, lastUpdate: new Date() });
      }
    }, 3000);

    return () => {
      stopPolling();
      clearInterval(interval);
    };
  }, [startPolling, stopPolling]);

  const tasks = dashboardData?.tasks || [];
  const nodes = dashboardData?.nodes || [];

  return (
    <div className="min-h-screen bg-lab-bg bg-grid-pattern bg-grid text-lab-text">
      <StatusHeader />

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-lab-error/10 border border-lab-error/30 rounded-lg text-lab-error">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <TaskTable
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
            />
            <ConvergenceChart />
          </div>
          <div className="space-y-6">
            <NodeResourceBar nodes={nodes} />
          </div>
        </div>
      </div>

      <TaskDetailDrawer />
    </div>
  );
}

function updateMockData(data: ClusterDashboardData): ClusterDashboardData {
  const newData = JSON.parse(JSON.stringify(data)) as ClusterDashboardData;

  newData.tasks.forEach((task: ComputeTask) => {
    if (task.status === 'RUNNING' && task.currentIteration < task.totalIterations) {
      task.currentIteration += 1;
      task.progressPercent = (task.currentIteration / task.totalIterations) * 100;
      const decayFactor = Math.exp(-task.currentIteration * 0.02);
      task.currentResidual = Math.max(
        task.targetResidual * 0.1,
        task.currentResidual * (0.8 + Math.random() * 0.35) * decayFactor + 1e-10
      );

      if (task.currentResidual <= task.targetResidual || task.currentIteration >= task.totalIterations) {
        task.status = 'COMPLETED';
        task.progressPercent = 100;
        task.completedAt = new Date().toISOString();
      }

      task.subtasks.forEach((subtask) => {
        if (subtask.status === 'RUNNING' && subtask.currentIteration < subtask.maxIterations) {
          subtask.currentIteration += 1;
          const subDecay = Math.exp(-subtask.currentIteration * 0.025);
          subtask.currentResidual = Math.max(
            task.targetResidual * 0.1,
            subtask.currentResidual * (0.75 + Math.random() * 0.4) * subDecay + 1e-10
          );

          if (subtask.convergenceHistory.length < 100) {
            subtask.convergenceHistory.push({
              iteration: subtask.currentIteration,
              residual: subtask.currentResidual,
              timestamp: new Date().toISOString(),
            });
          }

          if (subtask.currentResidual <= task.targetResidual || subtask.currentIteration >= subtask.maxIterations) {
            subtask.status = 'COMPLETED';
            subtask.computeTimeMs = Math.floor(Math.random() * 30000) + 5000;
            subtask.eigenvalues = Array.from({ length: 5 }, () => (Math.random() - 0.5) * 10);
          }
        }
      });
    }
  });

  newData.nodes.forEach((node: ComputeNode) => {
    const runningTasks = newData.tasks.filter(
      (t: ComputeTask) => t.status === 'RUNNING' && t.assignedNodes.includes(node.id)
    ).length;

    const baseLoad = 15 + runningTasks * 25;
    node.cpuUsage = Math.min(98, Math.max(5, baseLoad + (Math.random() - 0.5) * 15));
    node.memoryUsage = Math.min(95, Math.max(10, 30 + runningTasks * 18 + (Math.random() - 0.5) * 8));
    node.memoryUsedGB = (node.memoryTotalGB * node.memoryUsage) / 100;
    node.activeTasks = runningTasks;
    node.lastHeartbeat = new Date().toISOString();
    node.status = runningTasks > 0 ? 'BUSY' : 'ONLINE';
  });

  if (newData.summary) {
    const onlineNodes = newData.nodes.filter((n: ComputeNode) => n.status !== 'OFFLINE').length;
    const runningTasks = newData.tasks.filter((t: ComputeTask) => t.status === 'RUNNING').length;
    const pendingTasks = newData.tasks.filter((t: ComputeTask) => t.status === 'PENDING' || t.status === 'QUEUED').length;
    const avgCpu = newData.nodes.reduce((sum: number, n: ComputeNode) => sum + n.cpuUsage, 0) / newData.nodes.length;
    const avgMem = newData.nodes.reduce((sum: number, n: ComputeNode) => sum + n.memoryUsage, 0) / newData.nodes.length;

    newData.summary = {
      totalNodes: newData.nodes.length,
      onlineNodes,
      runningTasks,
      pendingTasks,
      avgCpuUsage: avgCpu,
      avgMemoryUsage: avgMem,
    };
  }

  return newData;
}
