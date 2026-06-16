import numpy as np
from scipy.linalg import lu_factor, lu_solve, qr, svd
from scipy.sparse.linalg import eigsh, svds

def matrix_decomposition(matrix, method='lu'):
    if method == 'lu':
        lu, piv = lu_factor(matrix)
        return {'lu': lu, 'piv': piv}
    elif method == 'qr':
        Q, R = qr(matrix)
        return {'Q': Q, 'R': R}
    elif method == 'svd':
        U, s, Vh = svd(matrix)
        return {'U': U, 's': s, 'Vh': Vh}
    else:
        raise ValueError(f"Unknown decomposition method: {method}")

def solve_linear_system(A, b):
    lu, piv = lu_factor(A)
    x = lu_solve((lu, piv), b)
    return x

def matrix_norm(matrix, ord='fro'):
    return np.linalg.norm(matrix, ord=ord)

def create_random_matrix(size, symmetric=True, positive_definite=True):
    if symmetric and positive_definite:
        A = np.random.randn(size, size)
        return A @ A.T + size * np.eye(size)
    elif symmetric:
        A = np.random.randn(size, size)
        return (A + A.T) / 2
    else:
        return np.random.randn(size, size)
