import { create } from 'zustand';
import type { ClusterDashboardData, ComputeTask, ConvergencePoint } from '@/types';
import { fetchDashboardData, fetchConvergenceData, cancelTask as apiCancelTask } from '@/utils/api';

const USE_MOCK = true;

interface ClusterState {
  isLoading: boolean;
  error: string | null;
  dashboardData: ClusterDashboardData | null;
  selectedTaskId: string | null;
  selectedTaskDetail: ComputeTask | null;
  convergenceData: Map<string, ConvergencePoint[]>;
  lastUpdate: Date | null;
  pollingInterval: number;
  isPolling: boolean;

  setSelectedTaskId: (id: string | null) => void;
  fetchData: () => Promise<void>;
  fetchTaskConvergence: (taskId: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  setPollingInterval: (interval: number) => void;
  clearError: () => void;
  cancelTask: (taskId: string) => Promise<{ acknowledged: boolean; status: string; message?: string }>;
}

export const useClusterStore = create<ClusterState>((set, get) => ({
  isLoading: false,
  error: null,
  dashboardData: null,
  selectedTaskId: null,
  selectedTaskDetail: null,
  convergenceData: new Map(),
  lastUpdate: null,
  pollingInterval: 3000,
  isPolling: false,

  setSelectedTaskId: (id) => {
    set({ selectedTaskId: id });
    if (id) {
      get().fetchTaskConvergence(id);
    }
  },

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      if (USE_MOCK) {
        return set({ isLoading: false });
      }
      const data = await fetchDashboardData();
      set({
        dashboardData: data,
        lastUpdate: new Date(),
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch data',
        isLoading: false,
      });
    }
  },

  fetchTaskConvergence: async (taskId) => {
    if (USE_MOCK) return;
    try {
      const data = await fetchConvergenceData(taskId);
      set((state) => {
        const newMap = new Map(state.convergenceData);
        newMap.set(taskId, data);
        return { convergenceData: newMap };
      });
    } catch (err) {
      console.error('Failed to fetch convergence data:', err);
    }
  },

  startPolling: () => {
    if (get().isPolling) return;
    set({ isPolling: true });
    const poll = async () => {
      if (!get().isPolling) return;
      await get().fetchData();
      const selectedId = get().selectedTaskId;
      if (selectedId) {
        await get().fetchTaskConvergence(selectedId);
      }
      setTimeout(poll, get().pollingInterval);
    };
    poll();
  },

  stopPolling: () => {
    set({ isPolling: false });
  },

  setPollingInterval: (interval) => {
    set({ pollingInterval: interval });
  },

  clearError: () => {
    set({ error: null });
  },

  cancelTask: async (taskId) => {
    if (USE_MOCK) {
      const data = get().dashboardData;
      if (!data) {
        return { acknowledged: false, status: 'ERROR', message: 'No data' };
      }
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) {
        return { acknowledged: false, status: 'ERROR', message: 'Task not found' };
      }
      const cancellable = ['PENDING', 'QUEUED', 'RUNNING'].includes(task.status);
      if (!cancellable) {
        return {
          acknowledged: true,
          status: task.status,
          message: `Task already ${task.status}`,
        };
      }

      const newTasks = data.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const nt: ComputeTask & { _cancellingStartMs?: number } = JSON.parse(JSON.stringify(t));
        nt.status = 'CANCELLING';
        nt._cancellingStartMs = Date.now();
        nt.subtasks.forEach((st) => {
          if (st.status === 'PENDING' || st.status === 'QUEUED') {
            st.status = 'CANCELLED';
            st.computeTimeMs = Math.floor(Math.random() * 2000) + 200;
          } else if (st.status === 'RUNNING') {
            st.status = 'CANCELLING';
          }
        });
        return nt;
      });

      set({
        dashboardData: { ...data, tasks: newTasks },
        lastUpdate: new Date(),
      });

      return {
        acknowledged: true,
        status: 'CANCELLING',
        message: 'Mock: 取消请求已派发, 正在模拟三级取消流程 (软取消→SIGTERM→SIGKILL)',
      };
    }

    try {
      return await apiCancelTask(taskId);
    } catch (e) {
      return {
        acknowledged: false,
        status: 'ERROR',
        message: e instanceof Error ? e.message : 'Network error',
      };
    }
  },
}));
