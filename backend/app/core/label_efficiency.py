from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from app.core.datasets import LabelRevealer
from app.core.label_propagation.harmonic import HarmonicPropagator
from app.core.metrics import MetricsCalculator
from app.core.state import SessionState


@dataclass
class EfficiencyPoint:
    label_fraction: float
    accuracy: float


class LabelEfficiencyAnalyzer:
    def __init__(self):
        self.revealer = LabelRevealer()
        self.metrics = MetricsCalculator()

    def sweep(self, session: SessionState, fractions: List[float], seed: Optional[int]) -> List[EfficiencyPoint]:
        points = []
        for fraction in fractions:
            observed = self.revealer.reveal(session.dataset.y_true, fraction, seed)
            propagator = HarmonicPropagator(session.graph, max_iter=300, tol=1e-5)

            soft_labels = None
            for step in propagator.run(observed, session.dataset.n_classes):
                soft_labels = step.soft_labels

            y_pred = np.argmax(soft_labels, axis=1)
            unlabeled_mask = observed < 0
            result = self.metrics.evaluate(session.dataset.y_true, y_pred, unlabeled_mask)
            points.append(EfficiencyPoint(label_fraction=fraction, accuracy=result.accuracy))

        return points
