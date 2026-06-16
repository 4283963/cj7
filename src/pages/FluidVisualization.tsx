import { useState } from 'react';
import { StatusHeader } from '@/components/StatusHeader';
import { FluidStreamlineCanvas } from '@/components/FluidStreamlineCanvas';
import { generateFluidField, FLOW_TYPES } from '@/utils/fluidField';
import type { FluidFieldData, SelectionStats } from '@/types';
import { Info, Settings, Sparkles, Droplets, Zap } from 'lucide-react';

export default function FluidVisualization() {
  const [fluidData, setFluidData] = useState<FluidFieldData | null>(() =>
    generateFluidField('demo-task', 100, 3, 'taylor-green')
  );
  const [selectedFlowType, setSelectedFlowType] = useState<string>('taylor-green');
  const [selectedMode, setSelectedMode] = useState<number>(3);
  const [gridSize, setGridSize] = useState<number>(100);
  const [selectionStats, setSelectionStats] = useState<SelectionStats | null>(null);

  const handleFlowTypeChange = (type: string) => {
    setSelectedFlowType(type);
    const data = generateFluidField('demo-task', gridSize, selectedMode, type);
    setFluidData(data);
    setSelectionStats(null);
  };

  const handleModeChange = (mode: number) => {
    setSelectedMode(mode);
    const data = generateFluidField('demo-task', gridSize, mode, selectedFlowType);
    setFluidData(data);
    setSelectionStats(null);
  };

  const handleGridSizeChange = (size: number) => {
    setGridSize(size);
    const data = generateFluidField('demo-task', size, selectedMode, selectedFlowType);
    setFluidData(data);
    setSelectionStats(null);
  };

  return (
    <div className="min-h-screen bg-lab-bg bg-grid-pattern bg-grid text-lab-text">
      <StatusHeader />

      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-lab-bgCard rounded-lg border border-lab-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-lab-running" />
                <h3 className="text-sm font-semibold text-lab-text">流场参数</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-lab-textMuted mb-2 block">流场类型</label>
                  <div className="space-y-1.5">
                    {FLOW_TYPES.map((flow) => (
                      <button
                        key={flow.id}
                        onClick={() => handleFlowTypeChange(flow.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                          selectedFlowType === flow.id
                            ? 'bg-lab-running/15 border border-lab-running/40 text-lab-running'
                            : 'bg-lab-bg border border-lab-border text-lab-textMuted hover:text-lab-text hover:border-lab-bgLight'
                        }`}
                      >
                        <div className="font-medium">{flow.name}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{flow.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-lab-textMuted mb-2 flex justify-between">
                    <span>特征波数 (k={selectedMode})</span>
                    <span className="font-mono">{selectedMode}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={selectedMode}
                    onChange={(e) => handleModeChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-lab-bg rounded-lg appearance-none cursor-pointer accent-lab-running"
                  />
                  <div className="flex justify-between text-[10px] text-lab-textMuted mt-1">
                    <span>1</span>
                    <span>6</span>
                    <span>12</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-lab-textMuted mb-2 flex justify-between">
                    <span>网格分辨率</span>
                    <span className="font-mono">{gridSize}×{gridSize}</span>
                  </label>
                  <input
                    type="range"
                    min="32"
                    max="200"
                    step="4"
                    value={gridSize}
                    onChange={(e) => handleGridSizeChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-lab-bg rounded-lg appearance-none cursor-pointer accent-lab-running"
                  />
                </div>
              </div>
            </div>

            <div className="bg-lab-bgCard rounded-lg border border-lab-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-lab-info" />
                <h3 className="text-sm font-semibold text-lab-text">物理背景</h3>
              </div>
              <p className="text-xs text-lab-textMuted leading-relaxed">
                速度场数据由矩阵特征值分解结果推导而来。第 k 阶特征模态对应
                k 对主涡结构，残差收敛精度决定速度场的数值准确性。
              </p>
              <div className="mt-3 pt-3 border-t border-lab-border space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-lab-textMuted">矩阵维度</span>
                  <span className="font-mono text-lab-text">{gridSize * gridSize}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-lab-textMuted">特征值模式</span>
                  <span className="font-mono text-lab-running">λ<sub>{selectedMode}</sub></span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-lab-textMuted">最大流速</span>
                  <span className="font-mono text-lab-success">
                    {fluidData?.velocityGrid.maxSpeed.toExponential(3) || '--'}
                  </span>
                </div>
              </div>
            </div>

            {selectionStats && (
              <div className="bg-lab-bgCard rounded-lg border border-lab-warning/40 p-4 shadow-lg shadow-lab-warning/5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-lab-warning" />
                  <h3 className="text-sm font-semibold text-lab-warning">切片分析</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-lab-textMuted">网格单元</span>
                    <span className="font-mono text-lab-text">{selectionStats.gridCells.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-lab-textMuted">区域尺寸</span>
                    <span className="font-mono text-lab-text">{selectionStats.width}×{selectionStats.height}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-lab-textMuted">平均流速</span>
                    <span className="font-mono text-lab-running font-semibold">
                      {selectionStats.avgVelocity.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-lab-textMuted">涡量强度</span>
                    <span className={`font-mono font-semibold ${
                      selectionStats.vorticity >= 0 ? 'text-lab-success' : 'text-lab-warning'
                    }`}>
                      {selectionStats.vorticity.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-3 space-y-6">
            <div className="bg-lab-bgCard rounded-lg border border-lab-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="w-5 h-5 text-lab-running" />
                <div>
                  <h2 className="text-lg font-semibold text-lab-text">速度场流线图</h2>
                  <p className="text-xs text-lab-textMuted">
                    6000+ 颗粒子平流追踪 · 鼠标拖拽划取切片区域
                  </p>
                </div>
              </div>
              <FluidStreamlineCanvas
                fluidData={fluidData}
                onSelectionChange={setSelectionStats}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoCard
                icon={<Zap className="w-5 h-5" />}
                title="特征值 → 速度场"
                desc="通过 Helmholtz 分解，将矩阵特征向量投影为无散速度场"
                color="text-lab-running"
              />
              <InfoCard
                icon={<Droplets className="w-5 h-5" />}
                title="粒子追踪算法"
                desc="RK4 积分沿流线粒子轨迹，尾迹长度 30 帧"
                color="text-lab-info"
              />
              <InfoCard
                icon={<Sparkles className="w-5 h-5" />}
                title="实时切片分析"
                desc="框选区域即时计算平均流速、涡量、速度梯度"
                color="text-lab-warning"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <div className="bg-lab-bgCard rounded-lg border border-lab-border p-4">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className="text-sm font-medium text-lab-text mb-1">{title}</div>
      <div className="text-xs text-lab-textMuted leading-relaxed">{desc}</div>
    </div>
  );
}
