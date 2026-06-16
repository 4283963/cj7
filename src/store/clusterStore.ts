import { create } from 'zustand';
import type { ClusterDashboardData, ComputeTask, ConvergencePoint } from '@/types';
import { fetchDashboardData, fetchConvergenceData } from '@/utils/api';

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
}));
