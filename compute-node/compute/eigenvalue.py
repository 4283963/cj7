import numpy as np
from scipy.linalg import eigh
from scipy.sparse.linalg import eigsh

def compute_eigenvalues(matrix, k=10, which='SM', tol=1e-8, maxiter=1000):
    if matrix.shape[0] <= 2000:
        eigenvalues, eigenvectors = eigh(
            matrix,
            subset_by_index=[0, min(k, matrix.shape[0] - 1)],
            maxiter=maxiter,
            tol=tol
        )
    else:
        eigenvalues, eigenvectors = eigsh(
            matrix,
            k=min(k, matrix.shape[0] - 2),
            which=which,
            tol=tol,
            maxiter=maxiter
        )
    
    sort_idx = np.argsort(eigenvalues)
    return eigenvalues[sort_idx], eigenvectors[:, sort_idx]

def compute_generalized_eigenvalues(A, B, k=10, tol=1e-8, maxiter=1000):
    eigenvalues, eigenvectors = eigh(
        A,
        B,
        subset_by_index=[0, min(k, A.shape[0] - 1)],
        maxiter=maxiter,
        tol=tol
    )
    sort_idx = np.argsort(eigenvalues)
    return eigenvalues[sort_idx], eigenvectors[:, sort_idx]

def power_iteration(matrix, max_iter=1000, tol=1e-8):
    n = matrix.shape[0]
    v = np.random.rand(n)
    v = v / np.linalg.norm(v)
    lambda_old = 0
    
    convergence_history = []
    
    for i in range(max_iter):
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
