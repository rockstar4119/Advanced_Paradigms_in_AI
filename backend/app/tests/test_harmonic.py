import numpy as np

from app.core.label_propagation.harmonic import HarmonicPropagator


def test_harmonic_converges_toward_labels():
    adjacency = np.array(
        [
            [0, 1, 0, 0],
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
        ],
        dtype=float,
    )
    y_observed = np.array([0, -1, -1, 1])
    propagator = HarmonicPropagator(adjacency, max_iter=100, tol=1e-6)
    steps = list(propagator.run(y_observed, n_classes=2))
    final = steps[-1].soft_labels

    assert final[1, 0] > final[1, 1]
    assert final[2, 1] > final[2, 0]


def test_harmonic_energy_is_non_increasing():
    adjacency = np.array(
        [
            [0, 1, 0.2, 0],
            [1, 0, 1, 0.2],
            [0.2, 1, 0, 1],
            [0, 0.2, 1, 0],
        ]
    )
    y_observed = np.array([0, -1, -1, 1])
    propagator = HarmonicPropagator(adjacency, max_iter=50, tol=1e-8)
    energies = [step.energy for step in propagator.run(y_observed, n_classes=2)]

    assert all(energies[i] >= energies[i + 1] - 1e-9 for i in range(len(energies) - 1))
