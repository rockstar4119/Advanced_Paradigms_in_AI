from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np


@dataclass
class LeakEdge:
    """An edge joining two different true classes — a path labels will leak along."""

    source: int
    target: int
    weight: float
    source_class: int
    target_class: int


@dataclass
class Histogram:
    bin_edges: List[float]
    counts: List[int]


@dataclass
class ComponentInfo:
    component_id: int
    size: int
    n_labeled: int
    classes_present: List[int]


@dataclass
class GraphExplanation:
    homophily_weighted: float
    homophily_unweighted: float
    n_cross_class_edges: int
    cross_class_weight_fraction: float
    top_leaks: List[LeakEdge]
    degree_histogram: Histogram
    weight_histogram: Histogram
    isolated_nodes: List[int]
    weak_nodes: List[int]
    components: List[ComponentInfo]
    n_unreachable: int
    node_degree: List[float]
    node_neighbors: List[int]
    node_local_homophily: List[float]


class GraphExplainer:
    """
    Structural diagnostics for a built graph.

    Several of these read `y_true`, which the propagation algorithms never see.
    They are evaluator-side diagnostics in exactly the same sense as accuracy —
    useful for understanding whether the graph *can* work, not available to the
    model at inference time.
    """

    def __init__(self, top_leaks: int = 8, weak_degree_quantile: float = 0.05):
        self.top_leaks = top_leaks
        self.weak_degree_quantile = weak_degree_quantile

    def explain(
        self,
        adjacency: np.ndarray,
        y_true: np.ndarray,
        observed: np.ndarray,
    ) -> GraphExplanation:
        n = adjacency.shape[0]
        upper_i, upper_j = np.triu_indices(n, k=1)
        weights = adjacency[upper_i, upper_j]
        present = weights > 0

        edge_i = upper_i[present]
        edge_j = upper_j[present]
        edge_w = weights[present]

        same_class = y_true[edge_i] == y_true[edge_j]
        total_weight = float(edge_w.sum())
        n_edges = int(edge_w.size)

        homophily_weighted = float(edge_w[same_class].sum() / total_weight) if total_weight > 0 else 0.0
        homophily_unweighted = float(same_class.mean()) if n_edges else 0.0
        cross_weight = float(edge_w[~same_class].sum())

        degree = adjacency.sum(axis=1)
        neighbors = (adjacency > 0).sum(axis=1)

        return GraphExplanation(
            homophily_weighted=homophily_weighted,
            homophily_unweighted=homophily_unweighted,
            n_cross_class_edges=int((~same_class).sum()),
            cross_class_weight_fraction=float(cross_weight / total_weight) if total_weight > 0 else 0.0,
            top_leaks=self._top_leaks(edge_i, edge_j, edge_w, same_class, y_true),
            degree_histogram=self._histogram(degree, bins=12),
            weight_histogram=self._histogram(edge_w, bins=12),
            isolated_nodes=[int(i) for i in np.where(neighbors == 0)[0]],
            weak_nodes=self._weak_nodes(degree, neighbors),
            components=self._components(adjacency, y_true, observed),
            n_unreachable=self._count_unreachable(adjacency, observed),
            node_degree=[float(v) for v in degree],
            node_neighbors=[int(v) for v in neighbors],
            node_local_homophily=self._local_homophily(adjacency, y_true),
        )

    def _top_leaks(
        self,
        edge_i: np.ndarray,
        edge_j: np.ndarray,
        edge_w: np.ndarray,
        same_class: np.ndarray,
        y_true: np.ndarray,
    ) -> List[LeakEdge]:
        cross = np.where(~same_class)[0]
        if cross.size == 0:
            return []
        order = cross[np.argsort(edge_w[cross])[::-1][: self.top_leaks]]
        return [
            LeakEdge(
                source=int(edge_i[k]),
                target=int(edge_j[k]),
                weight=float(edge_w[k]),
                source_class=int(y_true[edge_i[k]]),
                target_class=int(y_true[edge_j[k]]),
            )
            for k in order
        ]

    def _histogram(self, values: np.ndarray, bins: int) -> Histogram:
        if values.size == 0:
            return Histogram(bin_edges=[0.0, 1.0], counts=[0])
        lo = float(values.min())
        hi = float(values.max())
        if hi <= lo:
            hi = lo + 1e-9
        counts, edges = np.histogram(values, bins=bins, range=(lo, hi))
        return Histogram(bin_edges=[float(e) for e in edges], counts=[int(c) for c in counts])

    def _weak_nodes(self, degree: np.ndarray, neighbors: np.ndarray) -> List[int]:
        connected = degree[neighbors > 0]
        if connected.size == 0:
            return []
        cutoff = float(np.quantile(connected, self.weak_degree_quantile))
        weak = np.where((neighbors > 0) & (degree <= cutoff))[0]
        return [int(i) for i in weak]

    def _component_labels(self, adjacency: np.ndarray) -> np.ndarray:
        n = adjacency.shape[0]
        labels = np.full(n, -1, dtype=int)
        current = 0
        for start in range(n):
            if labels[start] >= 0:
                continue
            queue = deque([start])
            labels[start] = current
            while queue:
                u = queue.popleft()
                for v in np.where(adjacency[u] > 0)[0]:
                    v = int(v)
                    if labels[v] < 0:
                        labels[v] = current
                        queue.append(v)
            current += 1
        return labels

    def _components(
        self,
        adjacency: np.ndarray,
        y_true: np.ndarray,
        observed: np.ndarray,
    ) -> List[ComponentInfo]:
        labels = self._component_labels(adjacency)
        out: List[ComponentInfo] = []
        for component_id in range(int(labels.max()) + 1 if labels.size else 0):
            members = np.where(labels == component_id)[0]
            member_observed = observed[members]
            classes = sorted({int(c) for c in member_observed[member_observed >= 0]})
            out.append(
                ComponentInfo(
                    component_id=component_id,
                    size=int(members.size),
                    n_labeled=int((member_observed >= 0).sum()),
                    classes_present=classes,
                )
            )
        out.sort(key=lambda c: c.size, reverse=True)
        return out

    def _count_unreachable(self, adjacency: np.ndarray, observed: np.ndarray) -> int:
        """Unlabeled nodes with no path to any labeled node — predictions there are arbitrary."""
        reachable = reachable_from_labeled(adjacency, observed)
        unlabeled = observed < 0
        return int(np.sum(unlabeled & ~reachable))

    def _local_homophily(self, adjacency: np.ndarray, y_true: np.ndarray) -> List[float]:
        same = (y_true[:, None] == y_true[None, :]).astype(float)
        same_weight = (adjacency * same).sum(axis=1)
        total = adjacency.sum(axis=1)
        with np.errstate(divide="ignore", invalid="ignore"):
            ratio = np.where(total > 0, same_weight / np.where(total > 0, total, 1.0), 0.0)
        return [float(v) for v in ratio]


def reachable_from_labeled(adjacency: np.ndarray, observed: np.ndarray) -> np.ndarray:
    """Boolean mask of nodes connected to at least one labeled node."""
    n = adjacency.shape[0]
    visited = np.zeros(n, dtype=bool)
    queue = deque(int(i) for i in np.where(observed >= 0)[0])
    for start in queue:
        visited[start] = True
    while queue:
        u = queue.popleft()
        for v in np.where(adjacency[u] > 0)[0]:
            v = int(v)
            if not visited[v]:
                visited[v] = True
                queue.append(v)
    return visited
