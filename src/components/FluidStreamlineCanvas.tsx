import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Layers, Move, Square, Activity } from 'lucide-react';
import type { FluidFieldData, SelectionStats, VelocityGrid } from '@/types';
import { computeSelectionStats, getVelocityAt } from '@/utils/fluidField';

interface FluidStreamlineCanvasProps {
  fluidData: FluidFieldData | null;
  particleCount?: number;
  onSelectionChange?: (stats: SelectionStats | null) => void;
}

const PARTICLE_LIFETIME = 80;
const TRAIL_LENGTH = 30;
const PARTICLE_SPEED_SCALE = 1.5;

interface Particle {
  x: number;
  y: number;
  age: number;
  trailX: number[];
  trailY: number[];
}

export function FluidStreamlineCanvas({
  fluidData,
  particleCount = 6000,
  onSelectionChange,
}: FluidStreamlineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const gridRef = useRef<VelocityGrid | null>(null);
  const canvasSizeRef = useRef({ width: 800, height: 600 });
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [selectionStats, setSelectionStats] = useState<SelectionStats | null>(null);

  const [displayMode, setDisplayMode] = useState<'streamlines' | 'magnitude' | 'both'>('both');
  const [isPlaying, setIsPlaying] = useState(true);

  const displayModeRef = useRef(displayMode);
  const isPlayingRef = useRef(isPlaying);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    displayModeRef.current = displayMode;
  }, [displayMode]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const initParticles = useCallback((grid: VelocityGrid, canvasW: number, canvasH: number) => {
    const particles: Particle[] = [];
    const scaleX = canvasW / grid.width;
    const scaleY = canvasH / grid.height;

    for (let i = 0; i < particleCount; i++) {
      const gx = Math.random() * (grid.width - 1);
      const gy = Math.random() * (grid.height - 1);
      const vel = getVelocityAt(grid, gx, gy);

      const particle: Particle = {
        x: gx * scaleX,
        y: gy * scaleY,
        age: Math.floor(Math.random() * PARTICLE_LIFETIME),
        trailX: [],
        trailY: [],
      };

      if (vel.speed > 0.001) {
        particles.push(particle);
      }
    }
    return particles;
  }, [particleCount]);

  const drawMagnitude = useCallback((ctx: CanvasRenderingContext2D, grid: VelocityGrid, w: number, h: number) => {
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;
    const scaleX = grid.width / w;
    const scaleY = grid.height / h;
    const maxSpd = grid.maxSpeed;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const gx = px * scaleX;
        const gy = py * scaleY;
        const vel = getVelocityAt(grid, gx, gy);
        const t = Math.min(1, vel.speed / maxSpd);

        const idx = (py * w + px) * 4;

        const r = Math.floor(15 + t * 50);
        const g = Math.floor(40 + t * 120);
        const b = Math.floor(80 + t * 175);

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = Math.floor(80 + t * 120);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, []);

  useEffect(() => {
    if (!fluidData || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    const grid = fluidData.velocityGrid;
    gridRef.current = grid;

    const updateSize = () => {
      if (!containerRef.current || !canvasRef.current || !ctxRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const size = Math.min(rect.width - 48, 700);
      const w = size;
      const h = size * (grid.height / grid.width);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      canvasSizeRef.current = { width: w, height: h };
      particlesRef.current = initParticles(grid, w, h);
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    const animate = () => {
      if (!isPlayingRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const { width: cw, height: ch } = canvasSizeRef.current;
      const sx = grid.width / cw;
      const sy = grid.height / ch;

      ctx.clearRect(0, 0, cw, ch);

      if (displayModeRef.current === 'magnitude' || displayModeRef.current === 'both') {
        drawMagnitude(ctx, grid, cw, ch);
      } else {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, cw, ch);
      }

      if (displayModeRef.current === 'streamlines' || displayModeRef.current === 'both') {
        const particles = particlesRef.current;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          p.age++;

          const gx = p.x * sx;
          const gy = p.y * sy;
          const vel = getVelocityAt(grid, gx, gy);

          if (vel.speed > 0.0001) {
            p.trailX.push(p.x);
            p.trailY.push(p.y);
            if (p.trailX.length > TRAIL_LENGTH) {
              p.trailX.shift();
              p.trailY.shift();
            }
          }

          const spdScale = PARTICLE_SPEED_SCALE * (cw / grid.width);
          p.x += vel.u * spdScale;
          p.y += vel.v * spdScale;

          if (p.x < 0 || p.x >= cw || p.y < 0 || p.y >= ch || p.age > PARTICLE_LIFETIME) {
            p.x = Math.random() * cw;
            p.y = Math.random() * ch;
            p.age = 0;
            p.trailX = [];
            p.trailY = [];
            continue;
          }

          if (p.trailX.length > 1) {
            const alpha = vel.speed > 0 ? Math.min(1, vel.speed / grid.maxSpeed) * 0.9 : 0.2;
            const hue = 190 + Math.min(50, vel.speed / grid.maxSpeed * 60);

            ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p.trailX[0], p.trailY[0]);
            for (let k = 1; k < p.trailX.length; k++) {
              ctx.lineTo(p.trailX[k], p.trailY[k]);
            }
            ctx.stroke();
          }
        }
      }

      if (isSelecting && selectionStart && selectionEnd) {
        const x = Math.min(selectionStart.x, selectionEnd.x);
        const y = Math.min(selectionStart.y, selectionEnd.y);
        const wBox = Math.abs(selectionEnd.x - selectionStart.x);
        const hBox = Math.abs(selectionEnd.y - selectionStart.y);

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x + 0.5, y + 0.5, wBox, hBox);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.fillRect(x, y, wBox, hBox);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [fluidData, initParticles, drawMagnitude, isSelecting, selectionStart, selectionEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    setIsSelecting(true);
    setSelectionStart(pos);
    setSelectionEnd(pos);
    setSelectionStats(null);
    if (onSelectionChange) onSelectionChange(null);
  }, [onSelectionChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting) return;
    const pos = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    setSelectionEnd(pos);
  }, [isSelecting]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart || !gridRef.current) {
      setIsSelecting(false);
      return;
    }

    const end = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    setSelectionEnd(end);
    setIsSelecting(false);

    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;

    const rect = canvas.getBoundingClientRect();
    const sx = (Math.min(selectionStart.x, end.x) / rect.width) * grid.width;
    const sy = (Math.min(selectionStart.y, end.y) / rect.height) * grid.height;
    const ex = (Math.max(selectionStart.x, end.x) / rect.width) * grid.width;
    const ey = (Math.max(selectionStart.y, end.y) / rect.height) * grid.height;

    const w = ex - sx;
    const h = ey - sy;
    if (w < 2 || h < 2) {
      setSelectionStart(null);
      setSelectionEnd(null);
      setSelectionStats(null);
      if (onSelectionChange) onSelectionChange(null);
      return;
    }

    const { stats } = computeSelectionStats(grid, sx, sy, ex, ey);
    setSelectionStats(stats);
    if (onSelectionChange) onSelectionChange(stats);
  }, [isSelecting, selectionStart, onSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectionStats(null);
    if (onSelectionChange) onSelectionChange(null);
  }, [onSelectionChange]);

  const modeButtons = useMemo(() => [
    { id: 'streamlines', label: '流线', icon: Activity },
    { id: 'magnitude', label: '速度云图', icon: Layers },
    { id: 'both', label: '叠加', icon: Layers },
  ] as const, []);

  return (
    <div ref={containerRef} className="bg-lab-bgCard rounded-lg border border-lab-border overflow-hidden">
      <div className="px-4 py-3 border-b border-lab-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-lab-running" />
          <h2 className="text-lg font-semibold text-lab-text">速度场流线可视化</h2>
          {fluidData && (
            <span className="text-xs text-lab-textMuted font-mono ml-2">
              {fluidData.gridWidth}×{fluidData.gridHeight} · {fluidData.flowType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-lab-bg rounded-md border border-lab-border overflow-hidden">
            {modeButtons.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setDisplayMode(id as typeof displayMode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  displayMode === id
                    ? 'bg-lab-running text-white'
                    : 'text-lab-textMuted hover:text-lab-text hover:bg-lab-bgLight'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-lab-border text-lab-text hover:bg-lab-bgLight transition-colors"
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>

          {(selectionStart || selectionStats) && (
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-lab-error/30 text-lab-error hover:bg-lab-error/10 transition-colors"
            >
              ✕ 清除选区
            </button>
          )}
        </div>
      </div>

      <div className="p-6 flex justify-center">
        <canvas
          ref={canvasRef}
          className="border border-lab-border rounded-md cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {selectionStats && (
        <div className="px-4 py-3 border-t border-lab-border bg-lab-bg/50">
          <div className="flex items-center gap-2 mb-2">
            <Square className="w-4 h-4 text-lab-warning" />
            <span className="text-sm font-medium text-lab-text">切片区域统计</span>
            <span className="text-xs text-lab-textMuted font-mono">
              [{Math.round(selectionStats.x)}, {Math.round(selectionStats.y)}] → {selectionStats.width}×{selectionStats.height} 网格
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="平均流速" value={selectionStats.avgVelocity.toExponential(3)} unit="" color="text-lab-running" />
            <StatBox label="最大流速" value={selectionStats.maxVelocity.toExponential(3)} unit="" color="text-lab-success" />
            <StatBox label="最小流速" value={selectionStats.minVelocity.toExponential(3)} unit="" color="text-lab-warning" />
            <StatBox label="平均涡量" value={selectionStats.vorticity.toExponential(3)} unit="" color="text-lab-purple" />
            <StatBox label="平均 U 速度" value={selectionStats.avgU.toExponential(3)} unit="" />
            <StatBox label="平均 V 速度" value={selectionStats.avgV.toExponential(3)} unit="" />
            <StatBox label="网格单元数" value={selectionStats.gridCells.toLocaleString()} unit="" />
          </div>
        </div>
      )}

      {!selectionStats && (
        <div className="px-4 py-3 border-t border-lab-border bg-lab-bg/30">
          <p className="text-xs text-lab-textMuted flex items-center gap-2">
            <Move className="w-3.5 h-3.5" />
            提示：在画布上按住鼠标拖拽可划取矩形切片区域，实时查看该区域的流速统计
          </p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="bg-lab-bg rounded-md border border-lab-border px-3 py-2">
      <div className="text-xs text-lab-textMuted mb-1">{label}</div>
      <div className={`font-mono text-sm font-semibold ${color || 'text-lab-text'}`}>
        {value}
        {unit && <span className="text-xs text-lab-textMuted ml-1">{unit}</span>}
      </div>
    </div>
  );
}
