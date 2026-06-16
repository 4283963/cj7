import type { ClusterDashboardData, ComputeTask, ComputeNode, Subtask, ConvergencePoint } from '@/types';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateConvergenceHistory(
  startIteration: number,
  iterations: number,
  targetResidual: number,
  noiseLevel: number = 0.3
): ConvergencePoint[] {
  const history: ConvergencePoint[] = [];
  let residual = Math.random() * 0.5 + 0.5;

  for (let i = 0; i < iterations; i++) {
    const decayFactor = Math.exp(-(i + 1) * 0.03);
    const noise = (Math.random() - 0.5) * noiseLevel * residual;
    residual = Math.max(targetResidual * 0.1, residual * decayFactor * (0.85 + Math.random() * 0.25) + noise);

    history.push({
      iteration: startIteration + i,
      residual: Math.max(residual, 1e-12),
      timestamp: new Date(Date.now() - (iterations - i) * 5000).toISOString(),
    });
  }

  return history;
}

function generateSubtask(
  taskId: string,
  nodeId: string,
  startRow: number,
  endRow: number,
  maxIterations: number,
  targetResidual: number,
  isRunning: boolean,
  progressPercent: number
): Subtask {
  const currentIteration = isRunning
    ? Math.floor(maxIterations * (progressPercent / 100)) + Math.floor(Math.random() * 3)
    : maxIterations;

  const historyIterations = Math.min(currentIteration, 50);
  const convergenceHistory = generateConvergenceHistory(
    1,
    historyIterations,
    targetResidual,
    0.25
  );

  const currentResidual = convergenceHistory.length > 0
    ? convergenceHistory[convergenceHistory.length - 1].residual
    : targetResidual * 1000;

  const status = isRunning
    ? currentIteration >= maxIterations
      ? 'COMPLETED'
      : 'RUNNING'
    : currentIteration >= maxIterations
      ? 'COMPLETED'
      : 'RUNNING';

  return {
    id: `sub-${generateUUID().slice(0, 16)}`,
    taskId,
    nodeId,
    matrixStartRow: startRow,
    matrixEndRow: endRow,
    status,
    currentIteration: Math.min(currentIteration, maxIterations),
    maxIterations,
    currentResidual,
    convergenceHistory,
    computeTimeMs: status === 'COMPLETED' ? Math.floor(Math.random() * 25000) + 8000 : undefined,
    eigenvalues: status === 'COMPLETED'
      ? Array.from({ length: 5 }, () => (Math.random() - 0.5) * 15)
      : undefined,
  };
}

function generateTask(
  index: number,
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
  nodes: ComputeNode[]
): ComputeTask {
  const physicsFormulas = [
    'HΨ = EΨ 薛定谔方程求解',
    'Ax = λx 广义特征值问题',
    '∇²φ + k²φ = 0 亥姆霍兹方程',
    'ρü + Cú + Ku = F 结构动力学',
    'H = T + V 哈密顿量对角化',
  ];

  const taskNames = [
    '量子力学系统特征值分析',
    '有限元结构动力学求解',
    '电磁场模式计算',
    '大尺度分子动力学模拟',
    '纳米材料电子结构计算',
  ];

  const matrixDimensions = [2000, 5000, 8000, 10000, 3000, 6000];
  const maxIterations = [500, 800, 1000, 1200, 600];

  const targetResidual = 1e-8;
  const dimension = matrixDimensions[index % matrixDimensions.length];
  const totalIterations = maxIterations[index % maxIterations.length];
  const splitCount = Math.min(4, nodes.length);

  const progressPercent = status === 'COMPLETED'
    ? 100
    : status === 'RUNNING'
      ? 25 + Math.random() * 60
      : status === 'FAILED'
        ? 15 + Math.random() * 30
        : 0;

  const currentIteration = status === 'PENDING'
    ? 0
    : Math.floor(totalIterations * (progressPercent / 100));

  const decayFactor = Math.exp(-currentIteration * 0.02);
  const currentResidual = status === 'COMPLETED'
    ? targetResidual * (0.5 + Math.random() * 0.5)
    : status === 'PENDING'
      ? 1.0
      : Math.max(targetResidual * 0.5, 0.8 * decayFactor + Math.random() * 0.3 * decayFactor);

  const assignedNodes = nodes.slice(0, splitCount);
  const rowsPerSubtask = Math.floor(dimension / splitCount);

  const subtasks: Subtask[] = [];
  for (let i = 0; i < splitCount; i++) {
    const startRow = i * rowsPerSubtask;
    const endRow = i === splitCount - 1 ? dimension : (i + 1) * rowsPerSubtask;
    const node = assignedNodes[i % assignedNodes.length];
    subtasks.push(
      generateSubtask(
        'task-id',
        node.id,
        startRow,
        endRow,
        Math.floor(totalIterations / splitCount) + 100,
        targetResidual,
        status === 'RUNNING',
        progressPercent
      )
    );
  }

  const now = new Date();
  const createdAt = new Date(now.getTime() - (index + 1) * 60000 * (Math.random() * 30 + 5));
  const startedAt = status !== 'PENDING'
    ? new Date(createdAt.getTime() + 30000 + Math.random() * 60000)
    : undefined;
  const completedAt = status === 'COMPLETED'
    ? new Date((startedAt || createdAt).getTime() + Math.random() * 600000 + 120000)
    : undefined;

  return {
    id: `task-${generateUUID().slice(0, 12)}`,
    name: taskNames[index % taskNames.length],
    matrixDimension: dimension,
    physicsFormula: physicsFormulas[index % physicsFormulas.length],
    status,
    totalIterations,
    currentIteration,
    targetResidual,
    currentResidual,
    progressPercent,
    splitCount,
    subtasks,
    assignedNodes: assignedNodes.map((n) => n.id),
    createdAt: createdAt.toISOString(),
    startedAt: startedAt?.toISOString(),
    completedAt: completedAt?.toISOString(),
  };
}

function generateNodes(): ComputeNode[] {
  const nodeConfigs = [
    { name: '计算节点-01', hostname: '192.168.1.101', port: 5000, memory: 64 },
    { name: '计算节点-02', hostname: '192.168.1.102', port: 5000, memory: 64 },
    { name: '计算节点-03', hostname: '192.168.1.103', port: 5000, memory: 128 },
    { name: '计算节点-04', hostname: '192.168.1.104', port: 5000, memory: 128 },
  ];

  return nodeConfigs.map((config, idx) => {
    const baseLoad = 15 + Math.random() * 20;
    const memLoad = 30 + Math.random() * 15;
    return {
      id: `node-00${idx + 1}`,
      name: config.name,
      hostname: config.hostname,
      port: config.port,
      cpuUsage: baseLoad,
      memoryUsage: memLoad,
      memoryTotalGB: config.memory,
      memoryUsedGB: (config.memory * memLoad) / 100,
      activeTasks: 0,
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      registeredAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    };
  });
}

export async function generateMockData(): Promise<ClusterDashboardData> {
  const nodes = generateNodes();

  const tasks: ComputeTask[] = [];
  const statuses: Array<'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'> = [
    'RUNNING', 'RUNNING', 'COMPLETED', 'COMPLETED', 'PENDING', 'FAILED'
  ];

  for (let i = 0; i < 6; i++) {
    const task = generateTask(i, statuses[i], nodes);
    task.subtasks.forEach((st) => {
      st.taskId = task.id;
    });
    tasks.push(task);
  }

  nodes.forEach((node) => {
    node.activeTasks = tasks.filter(
      (t) => t.status === 'RUNNING' && t.assignedNodes.includes(node.id)
    ).length;
    if (node.activeTasks > 0) {
      node.cpuUsage = 40 + node.activeTasks * 20 + (Math.random() - 0.5) * 10;
      node.memoryUsage = 45 + node.activeTasks * 15 + (Math.random() - 0.5) * 8;
      node.memoryUsedGB = (node.memoryTotalGB * node.memoryUsage) / 100;
      node.status = 'BUSY';
    }
  });

  const onlineNodes = nodes.filter((n) => n.status !== 'OFFLINE').length;
  const runningTasks = tasks.filter((t) => t.status === 'RUNNING').length;
  const pendingTasks = tasks.filter((t) => t.status === 'PENDING' || t.status === 'QUEUED').length;
  const avgCpu = nodes.reduce((sum, n) => sum + n.cpuUsage, 0) / nodes.length;
  const avgMem = nodes.reduce((sum, n) => sum + n.memoryUsage, 0) / nodes.length;

  return {
    summary: {
      totalNodes: nodes.length,
      onlineNodes,
      runningTasks,
      pendingTasks,
      avgCpuUsage: avgCpu,
      avgMemoryUsage: avgMem,
    },
    tasks,
    nodes,
  };
}
