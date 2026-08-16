from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterator, Optional

import numpy as np
from sklearn.neighbors import NearestNeighbors


@dataclass
class Edge:
    source: int
    target: int
    weight: float
    step: int


class GraphBuilder(ABC):
    def __init__(self, sigma: float):
        self.sigma = sigma
        self.adjacency: Optional[np.ndarray] = None

    @abstractmethod
    def build(self, X: np.ndarray) -> Iterator[Edge]:
        raise NotImplementedError

    def _gaussian_weight(self, X: np.ndarray, i: int, j: int) -> float:
        sq_dist = np.sum((X[i] - X[j]) ** 2)
        return float(np.exp(-sq_dist / (2 * self.sigma ** 2)))


class KNNGraphBuilder(GraphBuilder):
    def __init__(self, k: int, sigma: float, mutual: bool = False):
        super().__init__(sigma)
        self.k = k
        self.mutual = mutual

    def build(self, X: np.ndarray) -> Iterator[Edge]:
        n = X.shape[0]
        k = min(self.k, n - 1)
        nn = NearestNeighbors(n_neighbors=k + 1).fit(X)
        _, indices = nn.kneighbors(X)
        neighbor_sets = [set(int(x) for x in indices[i][1:]) for i in range(n)]

        adjacency = np.zeros((n, n))
        seen = set()
        step = 0
        for i in range(n):
            for j in neighbor_sets[i]:
                if self.mutual and i not in neighbor_sets[j]:
                    continue
                pair = (min(i, j), max(i, j))
                if pair in seen:
                    continue
                seen.add(pair)
                weight = self._gaussian_weight(X, i, j)
                adjacency[i, j] = weight
                adjacency[j, i] = weight
                step += 1
                yield Edge(source=pair[0], target=pair[1], weight=weight, step=step)

        self.adjacency = adjacency


class RBFGraphBuilder(GraphBuilder):
    def __init__(self, sigma: float, sparsify_threshold: float = 0.0):
        super().__init__(sigma)
        self.sparsify_threshold = sparsify_threshold

    def build(self, X: np.ndarray) -> Iterator[Edge]:
        n = X.shape[0]
        adjacency = np.zeros((n, n))
        pairs = []
        for i in range(n):
            for j in range(i + 1, n):
                weight = self._gaussian_weight(X, i, j)
                if weight >= self.sparsify_threshold:
                    pairs.append((i, j, weight))

        pairs.sort(key=lambda p: p[2], reverse=True)
        for step, (i, j, weight) in enumerate(pairs, start=1):
            adjacency[i, j] = weight
            adjacency[j, i] = weight
            yield Edge(source=i, target=j, weight=weight, step=step)

        self.adjacency = adjacency
