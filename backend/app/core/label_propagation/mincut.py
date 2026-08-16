from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Dict, Iterator, List, Optional, Tuple, Union

import numpy as np


@dataclass
class AugmentPathStep:
    path: List[int]
    flow_added: float
    total_flow: float


@dataclass
class MincutFoundStep:
    cut_edges: List[Tuple[int, int]]
    side_source: List[int]
    side_sink: List[int]


MincutStep = Union[AugmentPathStep, MincutFoundStep]


class GraphMincutClassifier:
    def __init__(self, adjacency: np.ndarray):
        self.adjacency = adjacency
        self.n = adjacency.shape[0]
        self.source_idx = self.n
        self.sink_idx = self.n + 1

    def run(self, source_nodes: List[int], sink_nodes: List[int]) -> Iterator[MincutStep]:
        size = self.n + 2
        capacity = np.zeros((size, size))
        capacity[: self.n, : self.n] = self.adjacency

        big = float(self.adjacency.sum()) * 10.0 + 1.0
        for node in source_nodes:
            capacity[self.source_idx, node] = big
        for node in sink_nodes:
            capacity[node, self.sink_idx] = big

        residual = capacity.copy()
        total_flow = 0.0

        while True:
            path = self._bfs_path(residual)
            if path is None:
                break
            bottleneck = float(min(residual[path[i], path[i + 1]] for i in range(len(path) - 1)))
            for i in range(len(path) - 1):
                u, v = path[i], path[i + 1]
                residual[u, v] -= bottleneck
                residual[v, u] += bottleneck
            total_flow += bottleneck
            yield AugmentPathStep(path=path, flow_added=bottleneck, total_flow=total_flow)

        reachable = self._reachable_from(residual, self.source_idx)
        side_source = sorted(node for node in reachable if node < self.n)
        side_sink = sorted(node for node in range(self.n) if node not in reachable)

        cut_edges = [
            (u, v)
            for u in side_source
            for v in range(self.n)
            if v not in reachable and self.adjacency[u, v] > 0
        ]

        yield MincutFoundStep(cut_edges=cut_edges, side_source=side_source, side_sink=side_sink)

    def _bfs_path(self, residual: np.ndarray) -> Optional[List[int]]:
        size = residual.shape[0]
        visited = [False] * size
        parent = [-1] * size
        visited[self.source_idx] = True
        queue = deque([self.source_idx])

        while queue:
            u = queue.popleft()
            if u == self.sink_idx:
                break
            for v in np.where(residual[u] > 1e-9)[0]:
                v = int(v)
                if not visited[v]:
                    visited[v] = True
                    parent[v] = u
                    queue.append(v)

        if not visited[self.sink_idx]:
            return None

        path = []
        node = self.sink_idx
        while node != -1:
            path.append(node)
            node = parent[node]
        path.reverse()
        return path

    def _reachable_from(self, residual: np.ndarray, start: int) -> set:
        visited = {start}
        queue = deque([start])
        while queue:
            u = queue.popleft()
            for v in np.where(residual[u] > 1e-9)[0]:
                v = int(v)
                if v not in visited:
                    visited.add(v)
                    queue.append(v)
        return visited


@dataclass
class ClassPhaseStep:
    class_index: int
    step: MincutStep


@dataclass
class FinalAssignmentStep:
    labels: Dict[int, int]


class OneVsRestMincut:
    def __init__(self, adjacency: np.ndarray):
        self.adjacency = adjacency
        self.n = adjacency.shape[0]

    def run(self, y_observed: np.ndarray, n_classes: int) -> Iterator[Union[ClassPhaseStep, FinalAssignmentStep]]:
        source_side_by_class: Dict[int, set] = {}

        for cls in range(n_classes):
            source_nodes = [int(x) for x in np.where(y_observed == cls)[0]]
            sink_nodes = [int(x) for x in np.where((y_observed >= 0) & (y_observed != cls))[0]]
            if not source_nodes or not sink_nodes:
                continue
            classifier = GraphMincutClassifier(self.adjacency)
            for step in classifier.run(source_nodes, sink_nodes):
                yield ClassPhaseStep(class_index=cls, step=step)
                if isinstance(step, MincutFoundStep):
                    source_side_by_class[cls] = set(step.side_source)

        fallback_label = int(y_observed[y_observed >= 0][0])
        labels: Dict[int, int] = {}
        for node in range(self.n):
            if y_observed[node] >= 0:
                labels[node] = int(y_observed[node])
                continue
            assigned = None
            for cls, side in source_side_by_class.items():
                if node in side:
                    assigned = cls
                    break
            labels[node] = assigned if assigned is not None else fallback_label

        yield FinalAssignmentStep(labels=labels)
