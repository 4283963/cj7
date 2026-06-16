import type { ClusterDashboardData, ComputeTask, ComputeNode, ConvergencePoint, SubmitTaskRequest } from '@/types';

const API_BASE_URL = '/api';

export async function fetchDashboardData(): Promise<ClusterDashboardData> {
  const response = await fetch(`${API_BASE_URL}/dashboard`);
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

export async function fetchTasks(): Promise<ComputeTask[]> {
  const response = await fetch(`${API_BASE_URL}/tasks`);
  if (!response.ok) {
    throw new Error('Failed to fetch tasks');
  }
  return response.json();
}

export async function fetchTaskById(id: string): Promise<ComputeTask> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch task ${id}`);
  }
  return response.json();
}

export async function fetchConvergenceData(taskId: string): Promise<ConvergencePoint[]> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/convergence`);
  if (!response.ok) {
    throw new Error(`Failed to fetch convergence data for task ${taskId}`);
  }
  return response.json();
}

export async function fetchNodes(): Promise<ComputeNode[]> {
  const response = await fetch(`${API_BASE_URL}/nodes`);
  if (!response.ok) {
    throw new Error('Failed to fetch nodes');
  }
  return response.json();
}

export async function submitTask(request: SubmitTaskRequest): Promise<ComputeTask> {
  const response = await fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to submit task');
  }
  return response.json();
}

export async function cancelTask(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/cancel`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to cancel task ${taskId}`);
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'text-lab-success';
    case 'RUNNING':
      return 'text-lab-running';
    case 'PENDING':
    case 'QUEUED':
      return 'text-lab-pending';
    case 'FAILED':
      return 'text-lab-error';
    case 'ONLINE':
      return 'text-lab-success';
    case 'BUSY':
      return 'text-lab-warning';
    case 'OFFLINE':
      return 'text-lab-textMuted';
    default:
      return 'text-lab-textMuted';
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-lab-success/20 text-lab-success border-lab-success/30';
    case 'RUNNING':
      return 'bg-lab-running/20 text-lab-running border-lab-running/30';
    case 'PENDING':
    case 'QUEUED':
      return 'bg-lab-pending/20 text-lab-pending border-lab-pending/30';
    case 'FAILED':
      return 'bg-lab-error/20 text-lab-error border-lab-error/30';
    case 'ONLINE':
      return 'bg-lab-success/20 text-lab-success border-lab-success/30';
    case 'BUSY':
      return 'bg-lab-warning/20 text-lab-warning border-lab-warning/30';
    case 'OFFLINE':
      return 'bg-lab-border/50 text-lab-textMuted border-lab-border';
    default:
      return 'bg-lab-border/50 text-lab-textMuted border-lab-border';
  }
}

export function formatScientific(num: number): string {
  if (num === 0) return '0';
  if (Math.abs(num) < 0.0001 || Math.abs(num) >= 10000) {
    return num.toExponential(4);
  }
  return num.toFixed(6);
}

export function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
