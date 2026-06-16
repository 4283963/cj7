import numpy as np
from .eigenvalue import compute_eigenvalues, CancellationToken


def schrodinger_solver(potential, n_points=1000, n_eigenvalues=10,
                       cancel_token: CancellationToken | None = None):
    h = 2 * np.pi / (n_points - 1)
    x = np.linspace(-np.pi, np.pi, n_points)

    if cancel_token and cancel_token.is_cancelled:
        raise InterruptedError("Schrodinger solver cancelled before assembly")

    T = -1 / (2 * h**2) * (np.diag(np.ones(n_points - 1), 1) -
                            2 * np.diag(np.ones(n_points), 0) +
                            np.diag(np.ones(n_points - 1), -1))

    V = np.diag(potential(x))
    H = T + V

    eigenvalues, eigenvectors = compute_eigenvalues(
        H, k=n_eigenvalues, tol=1e-10, cancel_token=cancel_token
    )
    return eigenvalues, eigenvectors, x


def harmonic_oscillator_potential(x, omega=1.0):
    return 0.5 * omega**2 * x**2


def finite_element_stiffness(n_elements, length=1.0, E=1.0, A=1.0,
                             cancel_token: CancellationToken | None = None):
    n_nodes = n_elements + 1
    h = length / n_elements

    K = np.zeros((n_nodes, n_nodes))
    M = np.zeros((n_nodes, n_nodes))

    k_element = E * A / h * np.array([[1, -1], [-1, 1]])
    m_element = h / 6 * np.array([[2, 1], [1, 2]])

    for i in range(n_elements):
        if i % 50 == 0 and cancel_token and cancel_token.is_cancelled:
            raise InterruptedError(f"FE assembly cancelled at element {i}")
        K[i:i+2, i:i+2] += k_element
        M[i:i+2, i:i+2] += m_element

    return K[1:-1, 1:-1], M[1:-1, 1:-1]


def structural_dynamics_solver(n_elements=100, n_modes=5,
                               cancel_token: CancellationToken | None = None):
    K, M = finite_element_stiffness(n_elements, cancel_token=cancel_token)

    from scipy.linalg import eigh
    eigenvalues, eigenvectors = eigh(K, M, subset_by_index=[0, n_modes - 1])

    if cancel_token and cancel_token.is_cancelled:
        raise InterruptedError("Structural dynamics solver cancelled")

    natural_frequencies = np.sqrt(eigenvalues)
    return natural_frequencies, eigenvectors, K, M


def apply_physics_formula(matrix, formula_type,
                          cancel_token: CancellationToken | None = None):
    if formula_type == 'schrodinger':
        eigenvalues, eigenvectors, _ = schrodinger_solver(
            lambda x: 0.5 * x**2, n_points=matrix.shape[0],
            cancel_token=cancel_token
        )
        return eigenvalues, eigenvectors
    elif formula_type == 'structural':
        n = matrix.shape[0]
        K = matrix + np.eye(n) * 10
        M = np.eye(n)
        eigenvalues, eigenvectors = compute_eigenvalues(
            np.linalg.inv(M) @ K, k=10, cancel_token=cancel_token
        )
        return eigenvalues, eigenvectors
    elif formula_type == 'helmholtz':
        eigenvalues, eigenvectors = compute_eigenvalues(
            matrix, k=10, cancel_token=cancel_token
        )
        return eigenvalues, eigenvectors
    else:
        return compute_eigenvalues(matrix, k=10, cancel_token=cancel_token)
