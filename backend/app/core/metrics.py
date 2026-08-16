from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

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
    n_evaluated: int
    balanced_accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    weighted_f1: float
    cohen_kappa: float
    matthews_corrcoef: float


@dataclass
class ProbabilisticMetrics:
    """Scores that read the posterior, not just the argmax.

    Accuracy alone hides the two failure modes that matter most on a graph:
    a model that is right but has no idea why (flat posteriors), and one that
    is wrong while shouting (confident errors far from any seed).
    """

    mean_entropy: float
    mean_confidence: float
    mean_margin: float
    confidence_gap: float
    brier_score: float
    log_loss: float
    auroc_macro: float


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

        supported = [m for m in per_class if m.support > 0]
        total_support = sum(m.support for m in supported)

        balanced_accuracy = float(np.mean([m.recall for m in supported])) if supported else 0.0
        macro_precision = float(np.mean([m.precision for m in supported])) if supported else 0.0
        macro_recall = balanced_accuracy
        macro_f1 = float(np.mean([m.f1 for m in supported])) if supported else 0.0
        weighted_f1 = (
            float(sum(m.f1 * m.support for m in supported) / total_support) if total_support else 0.0
        )

        return EvaluationResult(
            accuracy=accuracy,
            confusion_matrix=matrix.tolist(),
            per_class=per_class,
            n_evaluated=int(len(true_subset)),
            balanced_accuracy=balanced_accuracy,
            macro_precision=macro_precision,
            macro_recall=macro_recall,
            macro_f1=macro_f1,
            weighted_f1=weighted_f1,
            cohen_kappa=self._cohen_kappa(matrix),
            matthews_corrcoef=self._matthews_corrcoef(matrix),
        )

    def mean_entropy(self, soft_labels: np.ndarray, unlabeled_mask: np.ndarray) -> float:
        probs = soft_labels[unlabeled_mask]
        if probs.size == 0:
            return 0.0
        safe_probs = np.clip(probs, 1e-12, 1.0)
        entropy_per_node = -np.sum(safe_probs * np.log2(safe_probs), axis=1)
        return float(entropy_per_node.mean())

    def probabilistic(
        self,
        soft_labels: Optional[np.ndarray],
        y_true: np.ndarray,
        evaluated_mask: np.ndarray,
        accuracy: float,
    ) -> Optional[ProbabilisticMetrics]:
        """Posterior-aware scores over the evaluated nodes.

        Returns ``None`` for algorithms such as min-cut that emit a hard
        partition and therefore have no posterior to score.
        """
        if soft_labels is None:
            return None

        probs = np.asarray(soft_labels, dtype=float)[evaluated_mask]
        truth = np.asarray(y_true, dtype=int)[evaluated_mask]
        if probs.size == 0:
            return None

        probs = self._normalize(probs)
        n_classes = probs.shape[1]

        safe = np.clip(probs, 1e-12, 1.0)
        entropy = float((-np.sum(safe * np.log2(safe), axis=1)).mean())

        sorted_probs = np.sort(probs, axis=1)
        confidence = sorted_probs[:, -1]
        runner_up = sorted_probs[:, -2] if n_classes > 1 else np.zeros_like(confidence)
        margin = confidence - runner_up

        onehot = np.zeros_like(probs)
        onehot[np.arange(len(truth)), np.clip(truth, 0, n_classes - 1)] = 1.0
        brier = float(np.sum((probs - onehot) ** 2, axis=1).mean())

        true_prob = np.clip(probs[np.arange(len(truth)), np.clip(truth, 0, n_classes - 1)], 1e-12, 1.0)
        log_loss = float(-np.log(true_prob).mean())

        return ProbabilisticMetrics(
            mean_entropy=entropy,
            mean_confidence=float(confidence.mean()),
            mean_margin=float(margin.mean()),
            confidence_gap=float(confidence.mean() - accuracy),
            brier_score=brier,
            log_loss=log_loss,
            auroc_macro=self._auroc_macro(probs, truth),
        )

    # ------------------------------------------------------------------ internals

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

    def _cohen_kappa(self, matrix: np.ndarray) -> float:
        """Agreement corrected for what guessing the marginals would already give."""
        total = float(matrix.sum())
        if total == 0:
            return 0.0
        observed = float(np.trace(matrix)) / total
        true_marginal = matrix.sum(axis=1) / total
        pred_marginal = matrix.sum(axis=0) / total
        expected = float(np.dot(true_marginal, pred_marginal))
        if abs(1.0 - expected) < 1e-12:
            return 0.0
        return (observed - expected) / (1.0 - expected)

    def _matthews_corrcoef(self, matrix: np.ndarray) -> float:
        """Multiclass MCC — the one headline number imbalance cannot inflate."""
        total = float(matrix.sum())
        if total == 0:
            return 0.0
        correct = float(np.trace(matrix))
        true_marginal = matrix.sum(axis=1).astype(float)
        pred_marginal = matrix.sum(axis=0).astype(float)

        numerator = correct * total - float(np.dot(true_marginal, pred_marginal))
        denominator = np.sqrt(
            (total ** 2 - float(np.dot(pred_marginal, pred_marginal)))
            * (total ** 2 - float(np.dot(true_marginal, true_marginal)))
        )
        if denominator < 1e-12:
            return 0.0
        return float(numerator / denominator)

    def _normalize(self, probs: np.ndarray) -> np.ndarray:
        """Rows of a harmonic solution can sum to zero on nodes the seeds never
        reached. Fall back to a uniform posterior there so the scores stay finite."""
        totals = probs.sum(axis=1, keepdims=True)
        uniform = np.full_like(probs, 1.0 / probs.shape[1])
        return np.where(totals > 1e-12, probs / np.where(totals > 1e-12, totals, 1.0), uniform)

    def _auroc_macro(self, probs: np.ndarray, truth: np.ndarray) -> float:
        """One-vs-rest AUROC, averaged over classes that actually appear.

        Rank-based (Mann-Whitney U) with tied scores sharing an average rank —
        harmonic posteriors tie constantly on saturated nodes.
        """
        scores = []
        for c in range(probs.shape[1]):
            positives = truth == c
            n_pos = int(positives.sum())
            n_neg = int(len(truth) - n_pos)
            if n_pos == 0 or n_neg == 0:
                continue
            ranks = self._average_ranks(probs[:, c])
            auc = (float(ranks[positives].sum()) - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg)
            scores.append(auc)
        return float(np.mean(scores)) if scores else 0.0

    def _average_ranks(self, values: np.ndarray) -> np.ndarray:
        order = np.argsort(values, kind="mergesort")
        ordered = values[order]
        ranks = np.empty(len(values), dtype=float)

        start = 0
        while start < len(ordered):
            stop = start
            while stop + 1 < len(ordered) and ordered[stop + 1] == ordered[start]:
                stop += 1
            ranks[start : stop + 1] = (start + stop) / 2.0 + 1.0
            start = stop + 1

        out = np.empty(len(values), dtype=float)
        out[order] = ranks
        return out
