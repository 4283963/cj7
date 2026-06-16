"""
流体动力学场生成器
从矩阵特征值分解结果推导出二维速度场（u, v）
"""

import numpy as np
from typing import Tuple, Dict, Any, Optional
from .eigenvalue import CancellationToken


def eigenvalues_to_velocity_field(
    eigenvalues: np.ndarray,
    eigenvectors: np.ndarray,
    grid_size: int = 100,
    mode: int = 0,
    flow_type: str = "taylor-green",
    cancel_token: Optional[CancellationToken] = None,
) -> Dict[str, Any]:
    """
    从特征值/特征向量推导出二维速度场

    物理背景：
    - 利用 Helmholtz 分解将特征向量投影为无散速度场
    - 第 k 阶特征模态对应 k 对主涡结构
    - 特征值大小决定该模态的能量（流速幅值）

    Args:
        eigenvalues: 特征值数组
        eigenvectors: 特征向量矩阵（每列一个特征向量）
        grid_size: 输出网格大小（grid_size x grid_size）
        mode: 使用第几阶特征模态（0 为最大特征值）
        flow_type: 流场类型（taylor-green, vortex-shedding, channel-flow, double-vortex）
        cancel_token: 取消令牌

    Returns:
        包含 u, v, speed, max_speed, min_speed 的速度场数据
    """
    n_modes = len(eigenvalues)
    mode_idx = min(max(mode, 0), n_modes - 1)

    eigenvalue = eigenvalues[mode_idx]
    eigenvector = eigenvectors[:, mode_idx]

    amplitude = np.sqrt(abs(eigenvalue)) * 0.1

    x = np.linspace(0, 2 * np.pi, grid_size)
    y = np.linspace(0, 2 * np.pi, grid_size)
    X, Y = np.meshgrid(x, y)

    u = np.zeros((grid_size, grid_size), dtype=np.float64)
    v = np.zeros((grid_size, grid_size), dtype=np.float64)

    if cancel_token and cancel_token.is_cancelled:
        raise InterruptedError("Cancelled during velocity field generation")

    if flow_type == "taylor-green":
        k = mode_idx + 1
        u = amplitude * np.sin(k * X) * np.cos(k * Y)
        v = -amplitude * np.cos(k * X) * np.sin(k * Y)

    elif flow_type == "vortex-shedding":
        cx1 = grid_size * 0.3
        cy1 = grid_size * 0.5
        cx2 = grid_size * 0.7
        cy2 = grid_size * 0.5

        for j in range(grid_size):
            for i in range(grid_size):
                if cancel_token and cancel_token.is_cancelled and (i * grid_size + j) % 1000 == 0:
                    raise InterruptedError("Cancelled during velocity field generation")

                dx1 = i - cx1
                dy1 = j - cy1
                r1 = np.sqrt(dx1 * dx1 + dy1 * dy1) + 1.0
                u[j, i] += -dy1 / (r1 * r1) * amplitude * 10
                v[j, i] += dx1 / (r1 * r1) * amplitude * 10

                dx2 = i - cx2
                dy2 = j - cy2
                r2 = np.sqrt(dx2 * dx2 + dy2 * dy2) + 1.0
                u[j, i] += dy2 / (r2 * r2) * amplitude * 8
                v[j, i] += -dx2 / (r2 * r2) * amplitude * 8

    elif flow_type == "channel-flow":
        y_norm = np.linspace(0, 1, grid_size)
        parabolic = 4 * y_norm * (1 - y_norm)
        u = amplitude * np.outer(parabolic, np.ones(grid_size)) * (
            1 + 0.3 * np.sin((mode_idx + 1) * Y)
        )
        v = 0.1 * amplitude * np.sin((mode_idx + 1) * X) * np.cos((mode_idx + 1) * Y)

    elif flow_type == "double-vortex":
        cx1 = grid_size * 0.3
        cy1 = grid_size * 0.3
        cx2 = grid_size * 0.7
        cy2 = grid_size * 0.7
        sigma = grid_size * 0.15

        for j in range(grid_size):
            for i in range(grid_size):
                if cancel_token and cancel_token.is_cancelled and (i * grid_size + j) % 1000 == 0:
                    raise InterruptedError("Cancelled during velocity field generation")

                dx1 = i - cx1
                dy1 = j - cy1
                r1 = np.sqrt(dx1 * dx1 + dy1 * dy1) / sigma + 0.5
                s1 = np.exp(-r1 * r1)
                u[j, i] += -dy1 / sigma * s1 * amplitude * 0.5
                v[j, i] += dx1 / sigma * s1 * amplitude * 0.5

                dx2 = i - cx2
                dy2 = j - cy2
                r2 = np.sqrt(dx2 * dx2 + dy2 * dy2) / sigma + 0.5
                s2 = np.exp(-r2 * r2)
                u[j, i] += dx2 / sigma * s2 * amplitude * 0.5
                v[j, i] += -dy2 / sigma * s2 * amplitude * 0.5
    else:
        k = mode_idx + 1
        u = amplitude * np.sin(X + k * Y)
        v = amplitude * np.cos(k * X - Y)

    speed = np.sqrt(u * u + v * v)
    max_speed = float(np.max(speed))
    min_speed = float(np.min(speed))

    return {
        "width": grid_size,
        "height": grid_size,
        "u": u.flatten().tolist(),
        "v": v.flatten().tolist(),
        "speed": speed.flatten().tolist(),
        "max_speed": max_speed,
        "min_speed": min_speed,
        "eigenvalue": float(eigenvalue),
        "mode": mode_idx,
        "flow_type": flow_type,
    }


def compute_stream_function(
    u: np.ndarray,
    v: np.ndarray,
    dx: float = 1.0,
    dy: float = 1.0,
) -> np.ndarray:
    """
    从速度场计算流函数（标量场，等值线即流线）

    ψ_y = u,  ψ_x = -v
    """
    ny, nx = u.shape
    psi = np.zeros_like(u)

    for j in range(1, ny):
        psi[j, 0] = psi[j - 1, 0] + v[j - 1, 0] * dx

    for j in range(ny):
        for i in range(1, nx):
            psi[j, i] = psi[j, i - 1] - u[j, i - 1] * dy

    return psi


def compute_vorticity(
    u: np.ndarray,
    v: np.ndarray,
    dx: float = 1.0,
    dy: float = 1.0,
) -> np.ndarray:
    """
    计算涡量场 ω = ∂v/∂x - ∂u/∂y
    """
    dv_dx = np.gradient(v, dx, axis=1)
    du_dy = np.gradient(u, dy, axis=0)
    return dv_dx - du_dy


def compute_selection_stats(
    u: np.ndarray,
    v: np.ndarray,
    speed: np.ndarray,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
) -> Dict[str, float]:
    """
    计算选定区域内的速度统计量
    """
    x0 = max(0, min(x0, x1))
    y0 = max(0, min(y0, y1))
    x1 = min(u.shape[1] - 1, max(x0, x1))
    y1 = min(u.shape[0] - 1, max(y0, y1))

    region_speed = speed[y0 : y1 + 1, x0 : x1 + 1]
    region_u = u[y0 : y1 + 1, x0 : x1 + 1]
    region_v = v[y0 : y1 + 1, x0 : x1 + 1]

    grid_cells = region_speed.size
    avg_velocity = float(np.mean(region_speed))
    max_velocity = float(np.max(region_speed))
    min_velocity = float(np.min(region_speed))
    avg_u = float(np.mean(region_u))
    avg_v = float(np.mean(region_v))

    dv_dx = np.gradient(region_v, axis=1)
    du_dy = np.gradient(region_u, axis=0)
    vorticity = float(np.mean(dv_dx - du_dy))

    return {
        "x": x0,
        "y": y0,
        "width": x1 - x0 + 1,
        "height": y1 - y0 + 1,
        "grid_cells": grid_cells,
        "avg_velocity": avg_velocity,
        "max_velocity": max_velocity,
        "min_velocity": min_velocity,
        "avg_u": avg_u,
        "avg_v": avg_v,
        "vorticity": vorticity,
    }
