from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from app.core.graph_explain import reachable_from_labeled


@dataclass
class SeedContribution:
    seed_node: int
    seed_class: int
    mass: float


@dataclass
class NodeExplanation:
    node_id: int
    predicted: int
    true_label: int
    soft_labels: List[float]
    entropy: float
    margin: float
    degree: float
    n_neighbors: int
    local_homophily: float
    reachable: bool
    top_seeds: List[SeedContribution]
    class_mass: List[float]


@dataclass
class SeedInfluence:
    seed_node: int
    seed_class: int
    total_mass: float
    share: float
    n_nodes_dominated: int


@dataclass
class InfluenceResult:
    absorption: np.ndarray
    labeled: np.ndarray
    unreachable: List[int]
    entropy: np.ndarray
    margin: np.ndarray
    seed_influence: List[SeedInfluence]


class InfluenceAnalyzer:
    """
    Exact attribution for harmonic propagation.

    The harmonic solution is f_U = (I - P_UU)^-1 P_UL f_L. The matrix
    A = (I - P_UU)^-1 P_UL is the absorption matrix: A[i, l] is the probability
    that a random walk leaving unlabeled node i is absorbed at labeled node l.
    Its rows sum to 1, so every prediction decomposes exactly into the labeled
    seeds that produced it — no approximation and no surrogate model.
    """

    def analyze(
        self,
        adjacency: np.ndarray,
        observed: np.ndarray,
        n_classes: int,
    ) -> InfluenceResult:
        n = adjacency.shape[0]
        labeled = np.where(observed >= 0)[0]
        unlabeled = np.where(observed < 0)[0]

        absorption = np.zeros((n, labeled.size))
        if labeled.size == 0:
            return InfluenceResult(
                absorption=absorption,
                labeled=labeled,
                unreachable=[int(i) for i in unlabeled],
                entropy=np.zeros(n),
                margin=np.zeros(n),
                seed_influence=[],
            )

        degree = adjacency.sum(axis=1)
        safe_degree = np.where(degree > 0, degree, 1.0)
        transition = adjacency / safe_degree[:, None]

        # Nodes cut off from every seed make (I - P_UU) singular, so solve only
        # on the reachable block and report the rest as unexplained.
        reachable = reachable_from_labeled(adjacency, observed)
        solvable = np.array([i for i in unlabeled if reachable[i]], dtype=int)
        unreachable = [int(i) for i in unlabeled if not reachable[i]]

        if solvable.size:
            block = np.eye(solvable.size) - transition[np.ix_(solvable, solvable)]
            to_seeds = transition[np.ix_(solvable, labeled)]
            absorption[solvable] = np.linalg.solve(block, to_seeds)

        # A labeled node is, trivially, entirely its own explanation.
        for column, node in enumerate(labeled):
            absorption[node, column] = 1.0

        soft = self._soft_from_absorption(absorption, observed[labeled], n_classes)
        entropy = self._entropy(soft)
        margin = self._margin(soft)

        return InfluenceResult(
            absorption=absorption,
            labeled=labeled,
            unreachable=unreachable,
            entropy=entropy,
            margin=margin,
            seed_influence=self._seed_influence(absorption, labeled, observed, unlabeled),
        )

    def explain_node(
        self,
        node_id: int,
        result: InfluenceResult,
        soft_labels: np.ndarray,
        y_true: np.ndarray,
        observed: np.ndarray,
        degree: np.ndarray,
        n_neighbors: np.ndarray,
        local_homophily: np.ndarray,
        top_k: int = 6,
    ) -> NodeExplanation:
        row = result.absorption[node_id]
        order = np.argsort(row)[::-1][:top_k]
        seed_classes = observed[result.labeled]

        class_mass = np.zeros(int(soft_labels.shape[1]))
        for column, seed in enumerate(result.labeled):
            class_mass[seed_classes[column]] += row[column]

        return NodeExplanation(
            node_id=int(node_id),
            predicted=int(np.argmax(soft_labels[node_id])),
            true_label=int(y_true[node_id]),
            soft_labels=[float(v) for v in soft_labels[node_id]],
            entropy=float(result.entropy[node_id]),
            margin=float(result.margin[node_id]),
            degree=float(degree[node_id]),
            n_neighbors=int(n_neighbors[node_id]),
            local_homophily=float(local_homophily[node_id]),
            reachable=node_id not in set(result.unreachable),
            top_seeds=[
                SeedContribution(
                    seed_node=int(result.labeled[c]),
                    seed_class=int(seed_classes[c]),
                    mass=float(row[c]),
                )
                for c in order
                if row[c] > 1e-9
            ],
            class_mass=[float(v) for v in class_mass],
        )

    def _soft_from_absorption(
        self,
        absorption: np.ndarray,
        seed_classes: np.ndarray,
        n_classes: int,
    ) -> np.ndarray:
        one_hot = np.zeros((seed_classes.size, n_classes))
        one_hot[np.arange(seed_classes.size), seed_classes] = 1.0
        return absorption @ one_hot

    def _entropy(self, soft: np.ndarray) -> np.ndarray:
        total = soft.sum(axis=1, keepdims=True)
        normalized = np.divide(soft, total, out=np.zeros_like(soft), where=total > 0)
        safe = np.clip(normalized, 1e-12, 1.0)
        return -np.sum(np.where(normalized > 0, normalized * np.log2(safe), 0.0), axis=1)

    def _margin(self, soft: np.ndarray) -> np.ndarray:
        if soft.shape[1] < 2:
            return np.ones(soft.shape[0])
        ordered = np.sort(soft, axis=1)
        return ordered[:, -1] - ordered[:, -2]

    def _seed_influence(
        self,
        absorption: np.ndarray,
        labeled: np.ndarray,
        observed: np.ndarray,
        unlabeled: np.ndarray,
    ) -> List[SeedInfluence]:
        if unlabeled.size == 0:
            return []

        block = absorption[unlabeled]
        totals = block.sum(axis=0)
        grand_total = float(totals.sum())
        dominant = np.argmax(block, axis=1) if block.size else np.array([], dtype=int)

        out = [
            SeedInfluence(
                seed_node=int(labeled[c]),
                seed_class=int(observed[labeled[c]]),
                total_mass=float(totals[c]),
                share=float(totals[c] / grand_total) if grand_total > 0 else 0.0,
                n_nodes_dominated=int(np.sum(dominant == c)) if block.size else 0,
            )
            for c in range(labeled.size)
        ]
        out.sort(key=lambda s: s.total_mass, reverse=True)
        return out
