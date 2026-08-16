from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import numpy as np


@dataclass
class IterationStep:
    t: int
    soft_labels: np.ndarray
    energy: float


class HarmonicPropagator:
    def __init__(self, adjacency: np.ndarray, max_iter: int = 200, tol: float = 1e-4):
        self.adjacency = adjacency
        self.max_iter = max_iter
        self.tol = tol

    def run(self, y_observed: np.ndarray, n_classes: int) -> Iterator[IterationStep]:
        n = self.adjacency.shape[0]
        labeled_mask = y_observed >= 0

        f = np.full((n, n_classes), 1.0 / n_classes)
        f[labeled_mask] = 0.0
        f[labeled_mask, y_observed[labeled_mask]] = 1.0

        degree = self.adjacency.sum(axis=1)
        safe_degree = np.where(degree > 0, degree, 1.0)
        transition = self.adjacency / safe_degree[:, None]

        prev_energy = self._energy(f)
        for t in range(1, self.max_iter + 1):
            f = transition @ f
            f[labeled_mask] = 0.0
            f[labeled_mask, y_observed[labeled_mask]] = 1.0

            energy = self._energy(f)
            yield IterationStep(t=t, soft_labels=f.copy(), energy=energy)

            if abs(prev_energy - energy) < self.tol:
                break
            prev_energy = energy

    def _energy(self, f: np.ndarray) -> float:
        diff = f[:, None, :] - f[None, :, :]
        sq_diff = np.sum(diff ** 2, axis=2)
        return float(0.5 * np.sum(self.adjacency * sq_diff))
