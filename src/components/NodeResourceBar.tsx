import { Server, Cpu, HardDrive, Network } from 'lucide-react';
import type { ComputeNode } from '@/types';
import { getStatusBgColor } from '@/utils/api';

interface NodeResourceBarProps {
  nodes: ComputeNode[];
}

export function NodeResourceBar({ nodes }: NodeResourceBarProps) {
  return (
    <div className="bg-lab-bgCard rounded-lg border border-lab-border overflow-hidden">
      <div className="px-4 py-3 border-b border-lab-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-lab-text flex items-center gap-2">
          <Server className="w-5 h-5 text-lab-memory" />
          计算节点资源监控
        </h2>
        <span className="text-sm text-lab-textMuted font-mono">
          共 {nodes.length} 个节点
        </span>
      </div>
      <div className="p-4 space-y-3 max-h-[380px] overflow-y-auto">
        {nodes.length > 0 ? (
          nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))
        ) : (
          <div className="py-8 text-center text-lab-textMuted">
            <Server className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无节点数据</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NodeCard({ node }: { node: ComputeNode }) {
  const cpuColor = node.cpuUsage > 90 ? 'bg-lab-error' : node.cpuUsage > 70 ? 'bg-lab-warning' : 'bg-lab-cpu';
  const memColor = node.memoryUsage > 90 ? 'bg-lab-error' : node.memoryUsage > 75 ? 'bg-lab-warning' : 'bg-lab-memory';

  return (
    <div className="bg-lab-bg rounded-lg border border-lab-border p-4 hover:border-lab-bgLight transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className={`w-4 h-4 ${
            node.status === 'ONLINE' ? 'text-lab-success' :
            node.status === 'BUSY' ? 'text-lab-warning' : 'text-lab-textMuted'
          }`} />
          <span className="font-medium text-lab-text">{node.name}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${getStatusBgColor(node.status)}`}>
            {node.status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-lab-textMuted font-mono">
          <Network className="w-3 h-3" />
          {node.hostname}:{node.port}
        </div>
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-1.5 text-lab-textMuted">
              <Cpu className="w-3.5 h-3.5" />
              <span>CPU 使用率</span>
            </div>
            <span className={`font-mono font-bold ${
              node.cpuUsage > 90 ? 'text-lab-error' :
              node.cpuUsage > 70 ? 'text-lab-warning' : 'text-lab-cpu'
            }`}>
              {node.cpuUsage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-lab-bgLight rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${cpuColor}`}
              style={{ width: `${Math.min(node.cpuUsage, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-1.5 text-lab-textMuted">
              <HardDrive className="w-3.5 h-3.5" />
              <span>内存使用率</span>
            </div>
            <span className={`font-mono font-bold ${
              node.memoryUsage > 90 ? 'text-lab-error' :
              node.memoryUsage > 75 ? 'text-lab-warning' : 'text-lab-memory'
            }`}>
              {node.memoryUsage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-lab-bgLight rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${memColor}`}
              style={{ width: `${Math.min(node.memoryUsage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-lab-textMuted mt-0.5 font-mono">
            <span>{node.memoryUsedGB.toFixed(1)} GB</span>
            <span>/ {node.memoryTotalGB.toFixed(0)} GB</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-lab-border/50 mt-2">
          <div className="text-xs text-lab-textMuted">
            <span className="text-lab-running font-mono font-bold">{node.activeTasks}</span>
            <span className="ml-1">活跃任务</span>
          </div>
          <div className="text-xs text-lab-textMuted font-mono">
            心跳: {formatHeartbeat(node.lastHeartbeat)}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatHeartbeat(timestamp: string): string {
  if (!timestamp) return '--';
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return `${seconds}s 前`;
  if (seconds < 60) return `${seconds}s 前`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m 前`;
}
