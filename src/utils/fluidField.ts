import type { FluidFieldData, VelocityGrid } from '@/types';

function generateVelocityGrid(
  width: number,
  height: number,
  mode: number = 3,
  flowType: string = 'taylor-green'
): VelocityGrid {
  const size = width * height;
  const u = new Float32Array(size);
  const v = new Float32Array(size);
  const speed = new Float32Array(size);

  let maxSpeed = 0;
  let minSpeed = Infinity;

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const idx = j * width + i;
      const x = (i / (width - 1)) * Math.PI * 2;
      const y = (j / (height - 1)) * Math.PI * 2;

      let uVal = 0;
      let vVal = 0;

      switch (flowType) {
        case 'taylor-green': {
          const k = mode;
          uVal = Math.sin(k * x) * Math.cos(k * y);
          vVal = -Math.cos(k * x) * Math.sin(k * y);
          break;
        }
        case 'vortex-shedding': {
          const cx1 = width * 0.3;
          const cy1 = height * 0.5;
          const cx2 = width * 0.7;
          const cy2 = height * 0.5;

          const dx1 = i - cx1;
          const dy1 = j - cy1;
          const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) + 1;
          uVal += -dy1 / (r1 * r1) * 50 * mode;
          vVal += dx1 / (r1 * r1) * 50 * mode;

          const dx2 = i - cx2;
          const dy2 = j - cy2;
          const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) + 1;
          uVal += dy2 / (r2 * r2) * 40 * mode;
          vVal += -dx2 / (r2 * r2) * 40 * mode;
          break;
        }
        case 'channel-flow': {
          const yNorm = j / height;
          const parabolic = 4 * yNorm * (1 - yNorm);
          uVal = parabolic * (1 + 0.3 * Math.sin(mode * y));
          vVal = 0.1 * Math.sin(mode * x) * Math.cos(mode * y);
          break;
        }
        case 'double-vortex': {
          const cx1 = width * 0.3;
          const cy1 = height * 0.3;
          const cx2 = width * 0.7;
          const cy2 = height * 0.7;

          const dx1 = i - cx1;
          const dy1 = j - cy1;
          const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) / (width * 0.15) + 0.5;
          const s1 = Math.exp(-r1 * r1);
          uVal += -dy1 / (width * 0.15) * s1 * mode * 0.5;
          vVal += dx1 / (width * 0.15) * s1 * mode * 0.5;

          const dx2 = i - cx2;
          const dy2 = j - cy2;
          const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) / (width * 0.15) + 0.5;
          const s2 = Math.exp(-r2 * r2);
          uVal += dx2 / (width * 0.15) * s2 * mode * 0.5;
          vVal += -dy2 / (width * 0.15) * s2 * mode * 0.5;
          break;
        }
        default: {
          uVal = Math.sin(x + mode * y);
          vVal = Math.cos(mode * x - y);
        }
      }

      u[idx] = uVal;
      v[idx] = vVal;
      const s = Math.sqrt(uVal * uVal + vVal * vVal);
      speed[idx] = s;
      if (s > maxSpeed) maxSpeed = s;
      if (s < minSpeed) minSpeed = s;
    }
  }

  return { width, height, u, v, speed, maxSpeed, minSpeed };
}

export function generateFluidField(
  taskId: string = 'demo-task',
  gridSize: number = 100,
  mode: number = 3,
  flowType: string = 'taylor-green'
): FluidFieldData {
  const velocityGrid = generateVelocityGrid(gridSize, gridSize, mode, flowType);

  return {
    taskId,
    gridWidth: gridSize,
    gridHeight: gridSize,
    velocityGrid,
    eigenvalueMode: mode,
    flowType,
    generatedAt: new Date().toISOString(),
  };
}

export function getVelocityAt(
  grid: VelocityGrid,
  x: number,
  y: number
): { u: number; v: number; speed: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);

  if (xi < 0 || xi >= grid.width - 1 || yi < 0 || yi >= grid.height - 1) {
    return { u: 0, v: 0, speed: 0 };
  }

  const xf = x - xi;
  const yf = y - yi;

  const idx00 = yi * grid.width + xi;
  const idx10 = idx00 + 1;
  const idx01 = idx00 + grid.width;
  const idx11 = idx01 + 1;

  const u = grid.u[idx00] * (1 - xf) * (1 - yf) +
            grid.u[idx10] * xf * (1 - yf) +
            grid.u[idx01] * (1 - xf) * yf +
            grid.u[idx11] * xf * yf;

  const v = grid.v[idx00] * (1 - xf) * (1 - yf) +
            grid.v[idx10] * xf * (1 - yf) +
            grid.v[idx01] * (1 - xf) * yf +
            grid.v[idx11] * xf * yf;

  const speed = Math.sqrt(u * u + v * v);

  return { u, v, speed };
}

export function computeSelectionStats(
  grid: VelocityGrid,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { stats: import('@/types').SelectionStats; mask: Uint8Array } {
  const x0 = Math.max(0, Math.min(startX, endX));
  const y0 = Math.max(0, Math.min(startY, endY));
  const x1 = Math.min(grid.width - 1, Math.max(startX, endX));
  const y1 = Math.min(grid.height - 1, Math.max(startY, endY));

  const x0i = Math.floor(x0);
  const y0i = Math.floor(y0);
  const x1i = Math.ceil(x1);
  const y1i = Math.ceil(y1);

  const w = x1i - x0i + 1;
  const h = y1i - y0i + 1;
  const mask = new Uint8Array(grid.width * grid.height);

  let count = 0;
  let sumSpeed = 0;
  let sumU = 0;
  let sumV = 0;
  let maxSpeed = -Infinity;
  let minSpeed = Infinity;

  let sumDvdx = 0;
  let sumDudy = 0;

  for (let j = y0i; j <= y1i; j++) {
    for (let i = x0i; i <= x1i; i++) {
      const idx = j * grid.width + i;
      mask[idx] = 1;
      count++;

      const s = grid.speed[idx];
      sumSpeed += s;
      sumU += grid.u[idx];
      sumV += grid.v[idx];
      if (s > maxSpeed) maxSpeed = s;
      if (s < minSpeed) minSpeed = s;

      if (i < grid.width - 1 && j < grid.height - 1) {
        const dvdx = grid.v[idx + 1] - grid.v[idx];
        const dudy = grid.u[idx + grid.width] - grid.u[idx];
        sumDvdx += dvdx;
        sumDudy += dudy;
      }
    }
  }

  const avgVelocity = count > 0 ? sumSpeed / count : 0;
  const avgU = count > 0 ? sumU / count : 0;
  const avgV = count > 0 ? sumV / count : 0;
  const vorticity = count > 0 ? (sumDvdx - sumDudy) / count : 0;

  return {
    stats: {
      x: x0i,
      y: y0i,
      width: w,
      height: h,
      gridCells: count,
      avgVelocity,
      maxVelocity: maxSpeed === -Infinity ? 0 : maxSpeed,
      minVelocity: minSpeed === Infinity ? 0 : minSpeed,
      avgU,
      avgV,
      vorticity,
    },
    mask,
  };
}

export const FLOW_TYPES = [
  { id: 'taylor-green', name: 'Taylor-Green 涡', description: '标准衰变涡流' },
  { id: 'vortex-shedding', name: '卡门涡街', description: '双圆柱绕流脱落' },
  { id: 'channel-flow', name: '槽道流', description: '抛物线速度剖面' },
  { id: 'double-vortex', name: '双涡结构', description: '反向旋转双涡' },
] as const;
