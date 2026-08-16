from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import numpy as np


@dataclass
class GraphStatistics:
    n_nodes: int
    n_edges: int
    density: float
    avg_degree: float
    n_components: int
    algebraic_connectivity: float
    mean_edge_weight: float


class GraphAnalyzer:
    def analyze(self, adjacency: np.ndarray) -> GraphStatistics:
        n = adjacency.shape[0]
        n_edges = int(np.count_nonzero(adjacency) / 2)
        max_edges = n * (n - 1) / 2
        density = n_edges / max_edges if max_edges > 0 else 0.0

        degree = adjacency.sum(axis=1)
        avg_degree = float(degree.mean()) if n > 0 else 0.0

        nonzero_weights = adjacency[adjacency > 0]
        mean_edge_weight = float(nonzero_weights.mean()) if nonzero_weights.size else 0.0

        return GraphStatistics(
            n_nodes=n,
            n_edges=n_edges,
            density=density,
            avg_degree=avg_degree,
            n_components=self._count_components(adjacency),
            algebraic_connectivity=self._algebraic_connectivity(adjacency, degree),
            mean_edge_weight=mean_edge_weight,
        )

    def _count_components(self, adjacency: np.ndarray) -> int:
        n = adjacency.shape[0]
        visited = [False] * n
        components = 0
        for start in range(n):
            if visited[start]:
                continue
            components += 1
            queue = deque([start])
            visited[start] = True
            while queue:
                u = queue.popleft()
                for v in np.where(adjacency[u] > 0)[0]:
                    v = int(v)
                    if not visited[v]:
                        visited[v] = True
                        queue.append(v)
        return components

    def _algebraic_connectivity(self, adjacency: np.ndarray, degree: np.ndarray) -> float:
        n = adjacency.shape[0]
        if n < 3:
            return 0.0
        laplacian = np.diag(degree) - adjacency
        eigenvalues = np.linalg.eigvalsh(laplacian)
        return float(max(eigenvalues[1], 0.0))
