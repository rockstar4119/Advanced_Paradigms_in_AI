from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np


@dataclass
class ClassMetric:
    class_index: int
    precision: float
    recall: float
    f1: float
    support: int


@dataclass
class EvaluationResult:
    accuracy: float
    confusion_matrix: List[List[int]]
    per_class: List[ClassMetric]


class MetricsCalculator:
    def evaluate(self, y_true: np.ndarray, y_pred: np.ndarray, evaluated_mask: np.ndarray) -> EvaluationResult:
        true_subset = y_true[evaluated_mask]
        pred_subset = y_pred[evaluated_mask]
        n_classes = int(max(y_true.max(), y_pred.max())) + 1

        matrix = np.zeros((n_classes, n_classes), dtype=int)
        for t, p in zip(true_subset, pred_subset):
            matrix[t, p] += 1

        accuracy = float(np.mean(true_subset == pred_subset)) if len(true_subset) else 0.0
        per_class = self._per_class_metrics(matrix)

        return EvaluationResult(accuracy=accuracy, confusion_matrix=matrix.tolist(), per_class=per_class)

    def mean_entropy(self, soft_labels: np.ndarray, unlabeled_mask: np.ndarray) -> float:
        probs = soft_labels[unlabeled_mask]
        if probs.size == 0:
            return 0.0
        safe_probs = np.clip(probs, 1e-12, 1.0)
        entropy_per_node = -np.sum(safe_probs * np.log2(safe_probs), axis=1)
        return float(entropy_per_node.mean())

    def _per_class_metrics(self, matrix: np.ndarray) -> List[ClassMetric]:
        n_classes = matrix.shape[0]
        metrics = []
        for c in range(n_classes):
            true_positive = int(matrix[c, c])
            false_positive = int(matrix[:, c].sum()) - true_positive
            false_negative = int(matrix[c, :].sum()) - true_positive
            support = int(matrix[c, :].sum())

            precision = true_positive / (true_positive + false_positive) if (true_positive + false_positive) > 0 else 0.0
            recall = true_positive / (true_positive + false_negative) if (true_positive + false_negative) > 0 else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

            metrics.append(
                ClassMetric(class_index=c, precision=precision, recall=recall, f1=f1, support=support)
            )
        return metrics
