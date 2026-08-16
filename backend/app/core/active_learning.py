from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np

from app.core.label_propagation.harmonic import HarmonicPropagator

STRATEGIES = ("entropy", "margin", "density_entropy", "random")


@dataclass
class Suggestion:
    node_id: int
    score: float
    entropy: float
    margin: float
    degree: float


@dataclass
class RoundPoint:
    round_index: int
    n_labels: int
    accuracy: float
    mean_entropy: float


@dataclass
class TrackSnapshot:
    name: str
    strategy: str
    n_labels: int
    accuracy: float
    mean_entropy: float
    history: List[RoundPoint]
    predictions: List[int]
    confidence: List[float]
    entropy: List[float]
    observed: List[int]
    newly_labeled: List[int]


@dataclass
class ArenaSnapshot:
    round_index: int
    batch_size: int
    strategy: str
    holdout: List[int]
    pool_size: int
    exhausted: bool
    n_classes: int
    tracks: Dict[str, TrackSnapshot]
    suggestions: List[Suggestion]


@dataclass
class Track:
    name: str
    strategy: str
    observed: np.ndarray
    history: List[RoundPoint] = field(default_factory=list)
    soft: Optional[np.ndarray] = None
    newly_labeled: List[int] = field(default_factory=list)


class ActiveLearningArena:
    """
    Two label budgets spent side by side on the same graph: one guided by the
    model's own uncertainty, one spent at random.

    Both tracks are scored on a held-out set carved out when the arena starts
    and never offered to either track, so the comparison measures the
    acquisition strategy rather than which track happened to label the test
    nodes. Held-out nodes still participate in the graph — this stays
    transductive, they simply never have their labels revealed.
    """

    def __init__(
        self,
        adjacency: np.ndarray,
        y_true: np.ndarray,
        n_classes: int,
        initial_observed: np.ndarray,
        batch_size: int = 4,
        strategy: str = "entropy",
        holdout_fraction: float = 0.3,
        seed: Optional[int] = None,
    ):
        if strategy not in STRATEGIES:
            raise ValueError(f"unknown strategy: {strategy}")

        self.adjacency = adjacency
        self.y_true = y_true
        self.n_classes = n_classes
        self.batch_size = batch_size
        self.strategy = strategy
        self.rng = np.random.default_rng(seed)
        self.round_index = 0

        degree = adjacency.sum(axis=1)
        self.degree = degree
        peak = float(degree.max()) if degree.size and degree.max() > 0 else 1.0
        self.degree_normalized = degree / peak

        unlabeled = np.where(initial_observed < 0)[0]
        n_holdout = int(round(unlabeled.size * holdout_fraction))
        n_holdout = max(1, min(n_holdout, max(unlabeled.size - 1, 1))) if unlabeled.size else 0
        self.holdout = np.sort(self.rng.choice(unlabeled, size=n_holdout, replace=False)) if n_holdout else np.array([], dtype=int)

        self.holdout_mask = np.zeros(len(y_true), dtype=bool)
        self.holdout_mask[self.holdout] = True

        self.tracks: Dict[str, Track] = {
            "guided": Track(name="guided", strategy=strategy, observed=initial_observed.copy()),
            "random": Track(name="random", strategy="random", observed=initial_observed.copy()),
        }

        for track in self.tracks.values():
            self._evaluate(track)

    # ---------------------------------------------------------------- rounds

    def step(self) -> None:
        """Advance both tracks by one batch."""
        if self.exhausted():
            return

        self.round_index += 1
        for track in self.tracks.values():
            chosen = self._select(track)
            track.observed[chosen] = self.y_true[chosen]
            track.newly_labeled = [int(c) for c in chosen]
            self._evaluate(track)

    def exhausted(self) -> bool:
        return any(self._pool(track).size == 0 for track in self.tracks.values())

    def _pool(self, track: Track) -> np.ndarray:
        """Nodes this track may still buy: unlabeled and not held out."""
        return np.where((track.observed < 0) & ~self.holdout_mask)[0]

    def _select(self, track: Track) -> np.ndarray:
        pool = self._pool(track)
        if pool.size == 0:
            return np.array([], dtype=int)
        take = int(min(self.batch_size, pool.size))

        if track.strategy == "random":
            return self.rng.choice(pool, size=take, replace=False)

        scores, _, _ = self._score(track.strategy, track.soft, pool)
        return pool[np.argsort(scores)[::-1][:take]]

    def _score(self, strategy: str, soft: np.ndarray, pool: np.ndarray):
        probs = self._normalize(soft[pool])
        safe = np.clip(probs, 1e-12, 1.0)
        entropy = -np.sum(np.where(probs > 0, probs * np.log2(safe), 0.0), axis=1)

        if probs.shape[1] >= 2:
            ordered = np.sort(probs, axis=1)
            margin = ordered[:, -1] - ordered[:, -2]
        else:
            margin = np.ones(probs.shape[0])

        if strategy == "entropy":
            scores = entropy
        elif strategy == "margin":
            scores = -margin
        elif strategy == "density_entropy":
            scores = entropy * self.degree_normalized[pool]
        else:
            scores = self.rng.random(pool.size)

        return scores, entropy, margin

    # ------------------------------------------------------------ evaluation

    def _evaluate(self, track: Track) -> None:
        track.soft = self._propagate(track.observed)
        predictions = np.argmax(track.soft, axis=1)

        if self.holdout.size:
            accuracy = float(np.mean(predictions[self.holdout] == self.y_true[self.holdout]))
        else:
            accuracy = 0.0

        probs = self._normalize(track.soft)
        safe = np.clip(probs, 1e-12, 1.0)
        per_node = -np.sum(np.where(probs > 0, probs * np.log2(safe), 0.0), axis=1)
        unlabeled = track.observed < 0
        mean_entropy = float(per_node[unlabeled].mean()) if unlabeled.any() else 0.0

        track.history.append(
            RoundPoint(
                round_index=self.round_index,
                n_labels=int((track.observed >= 0).sum()),
                accuracy=accuracy,
                mean_entropy=mean_entropy,
            )
        )

    def _propagate(self, observed: np.ndarray) -> np.ndarray:
        propagator = HarmonicPropagator(self.adjacency, max_iter=300, tol=1e-5)
        soft = None
        for step in propagator.run(observed, self.n_classes):
            soft = step.soft_labels
        return soft

    def _normalize(self, soft: np.ndarray) -> np.ndarray:
        total = soft.sum(axis=1, keepdims=True)
        return np.divide(soft, total, out=np.zeros_like(soft), where=total > 0)

    # -------------------------------------------------------------- snapshot

    def snapshot(self) -> ArenaSnapshot:
        guided = self.tracks["guided"]
        pool = self._pool(guided)

        suggestions: List[Suggestion] = []
        if pool.size and guided.soft is not None:
            scores, entropy, margin = self._score(guided.strategy, guided.soft, pool)
            order = np.argsort(scores)[::-1][: self.batch_size]
            suggestions = [
                Suggestion(
                    node_id=int(pool[k]),
                    score=float(scores[k]),
                    entropy=float(entropy[k]),
                    margin=float(margin[k]),
                    degree=float(self.degree[pool[k]]),
                )
                for k in order
            ]

        return ArenaSnapshot(
            round_index=self.round_index,
            batch_size=self.batch_size,
            strategy=self.strategy,
            holdout=[int(i) for i in self.holdout],
            pool_size=int(pool.size),
            exhausted=self.exhausted(),
            n_classes=self.n_classes,
            tracks={name: self._track_snapshot(track) for name, track in self.tracks.items()},
            suggestions=suggestions,
        )

    def _track_snapshot(self, track: Track) -> TrackSnapshot:
        probs = self._normalize(track.soft)
        safe = np.clip(probs, 1e-12, 1.0)
        entropy = -np.sum(np.where(probs > 0, probs * np.log2(safe), 0.0), axis=1)
        latest = track.history[-1]

        return TrackSnapshot(
            name=track.name,
            strategy=track.strategy,
            n_labels=latest.n_labels,
            accuracy=latest.accuracy,
            mean_entropy=latest.mean_entropy,
            history=list(track.history),
            predictions=[int(v) for v in np.argmax(track.soft, axis=1)],
            confidence=[float(v) for v in probs.max(axis=1)],
            entropy=[float(v) for v in entropy],
            observed=[int(v) for v in track.observed],
            newly_labeled=list(track.newly_labeled),
        )
