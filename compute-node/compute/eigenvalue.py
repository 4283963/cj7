import numpy as np
from scipy.linalg import eigh
from scipy.sparse.linalg import eigsh
import multiprocessing as mp
import ctypes
import signal


class CancellationToken:
    def __init__(self):
        self._flag = mp.Value(ctypes.c_bool, False)

    def cancel(self):
        with self._flag.get_lock():
            self._flag.value = True

    @property
    def is_cancelled(self) -> bool:
        return self._flag.value

    def reset(self):
        with self._flag.get_lock():
            self._flag.value = False


def _check_cancelled(token: CancellationToken | None) -> bool:
    if token is None:
        return False
    return token.is_cancelled


def compute_eigenvalues(matrix, k=10, which='SM', tol=1e-8, maxiter=1000,
                        cancel_token: CancellationToken | None = None,
                        chunk_size: int = 50):
    n = matrix.shape[0]

    if _check_cancelled(cancel_token):
        raise InterruptedError("Computation cancelled before start")

    if n <= 2000:
        if _check_cancelled(cancel_token):
            raise InterruptedError("Computation cancelled")
        eigenvalues, eigenvectors = eigh(
            matrix,
            subset_by_index=[0, min(k, n - 1)],
            maxiter=maxiter,
            tol=tol
        )
    else:
        eigenvalues, eigenvectors = _cancellable_eigsh(
            matrix, k=min(k, n - 2), which=which, tol=tol,
            maxiter=maxiter, cancel_token=cancel_token, chunk_size=chunk_size
        )

    if _check_cancelled(cancel_token):
        raise InterruptedError("Computation cancelled after eigenvalue solve")

    sort_idx = np.argsort(eigenvalues)
    return eigenvalues[sort_idx], eigenvectors[:, sort_idx]


def _cancellable_eigsh(matrix, k, which, tol, maxiter, cancel_token, chunk_size):
    """分批执行 eigsh，每 chunk_size 次迭代检查取消令牌。
    通过逐步逼近的策略：先设置较大 tol 快速粗解，再精化；每次精化前检查取消。
    """
    n = matrix.shape[0]

    if _check_cancelled(cancel_token):
        raise InterruptedError("Cancelled before eigsh stages")

    stage_tols = [1e-2, 1e-4, 1e-6, tol]
    stage_iters = [min(chunk_size, maxiter // 4),
                   min(chunk_size * 2, maxiter // 4),
                   min(chunk_size * 3, maxiter // 4),
                   max(1, maxiter - 3 * chunk_size)]

    eigenvalues = None
    eigenvectors = None
    total_iter = 0

    for stage_idx, (stage_tol, stage_maxiter) in enumerate(zip(stage_tols, stage_iters)):
        if _check_cancelled(cancel_token):
            raise InterruptedError(f"Cancelled at eigsh stage {stage_idx}")

        try:
            effective_tol = max(stage_tol, tol)
            effective_maxiter = min(stage_maxiter, max(1, maxiter - total_iter))

            if eigenvectors is not None and stage_idx > 0:
                try:
                    eigenvalues, eigenvectors = eigsh(
                        matrix, k=k, which=which, tol=effective_tol,
                        maxiter=effective_maxiter, v0=eigenvectors[:, 0]
                    )
                except Exception:
                    eigenvalues, eigenvectors = eigsh(
                        matrix, k=k, which=which, tol=effective_tol,
                        maxiter=effective_maxiter
                    )
            else:
                eigenvalues, eigenvectors = eigsh(
                    matrix, k=k, which=which, tol=effective_tol,
                    maxiter=effective_maxiter
                )

            total_iter += effective_maxiter

            if effective_tol <= tol:
                break

        except InterruptedError:
            raise
        except Exception:
            if stage_idx == len(stage_tols) - 1:
                raise

    if _check_cancelled(cancel_token):
        raise InterruptedError("Cancelled after eigsh completion")

    return eigenvalues, eigenvectors


def compute_generalized_eigenvalues(A, B, k=10, tol=1e-8, maxiter=1000,
                                    cancel_token: CancellationToken | None = None):
    if _check_cancelled(cancel_token):
        raise InterruptedError("Computation cancelled")

    eigenvalues, eigenvectors = eigh(
        A, B,
        subset_by_index=[0, min(k, A.shape[0] - 1)],
        maxiter=maxiter, tol=tol
    )

    if _check_cancelled(cancel_token):
        raise InterruptedError("Computation cancelled")

    sort_idx = np.argsort(eigenvalues)
    return eigenvalues[sort_idx], eigenvectors[:, sort_idx]


def power_iteration(matrix, max_iter=1000, tol=1e-8,
                    cancel_token: CancellationToken | None = None,
                    check_interval: int = 10):
    n = matrix.shape[0]
    v = np.random.rand(n)
    v = v / np.linalg.norm(v)
    lambda_old = 0

    convergence_history = []

    for i in range(max_iter):
        if i % check_interval == 0 and _check_cancelled(cancel_token):
            raise InterruptedError(f"Power iteration cancelled at step {i}")

        w = matrix @ v
        lambda_new = np.dot(v, w)
        v = w / np.linalg.norm(w)

        residual = abs(lambda_new - lambda_old)
        convergence_history.append({
            'iteration': i + 1,
            'residual': float(residual),
            'eigenvalue_estimate': float(lambda_new)
        })

        if residual < tol:
            break
        lambda_old = lambda_new

    return lambda_new, v, convergence_history


def calculate_residual(matrix, eigenvalue, eigenvector):
    residual = matrix @ eigenvector - eigenvalue * eigenvector
    return float(np.linalg.norm(residual))
