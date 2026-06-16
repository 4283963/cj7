export type TaskStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'CANCELLING' | 'CANCELLED' | 'COMPLETED' | 'FAILED';

export type NodeStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export interface ConvergencePoint {
  iteration: number;
  residual: number;
  timestamp: string;
  subtaskId?: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  matrixStartRow: number;
  matrixEndRow: number;
  nodeId: string;
  status: TaskStatus;
  currentIteration: number;
  maxIterations: number;
  currentResidual: number;
  convergenceHistory: ConvergencePoint[];
  computeTimeMs?: number;
  eigenvalues?: number[];
}

export interface ComputeNode {
  id: string;
  name: string;
  hostname: string;
  port: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryTotalGB: number;
  memoryUsedGB: number;
  activeTasks: number;
  status: NodeStatus;
  lastHeartbeat: string;
  registeredAt: string;
}

export interface ComputeTask {
  id: string;
  name: string;
  matrixDimension: number;
  physicsFormula: string;
  status: TaskStatus;
  totalIterations: number;
  currentIteration: number;
  targetResidual: number;
  currentResidual: number;
  progressPercent: number;
  splitCount: number;
  subtasks: Subtask[];
  assignedNodes: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DashboardSummary {
  totalNodes: number;
  onlineNodes: number;
  runningTasks: number;
  pendingTasks: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
}

export interface ClusterDashboardData {
  summary: DashboardSummary;
  tasks: ComputeTask[];
  nodes: ComputeNode[];
}

export interface SubmitTaskRequest {
  name: string;
  matrixDimension: number;
  physicsFormula: string;
  targetResidual: number;
  maxIterations: number;
  splitCount: number;
}
