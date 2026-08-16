from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np


@dataclass
class CalibrationBin:
    lower: float
    upper: float
    count: int
    mean_confidence: float
    accuracy: float


@dataclass
class RiskCoveragePoint:
    threshold: float
    coverage: float
    accuracy: float
    n_kept: int


@dataclass
class ConfidentError:
    node_id: int
    true_label: int
    predicted: int
    confidence: float
    margin: float
    local_homophily: float


@dataclass
class ErrorProfile:
    n_evaluated: int
    n_errors: int
    mean_margin_correct: float
    mean_margin_error: float
    mean_homophily_correct: float
    mean_homophily_error: float
    errors_in_lowest_margin_quartile: float
    unreachable_errors: int


@dataclass
class ResultExplanation:
    accuracy: float
    expected_calibration_error: float
    calibration: List[CalibrationBin]
    risk_coverage: List[RiskCoveragePoint]
    error_profile: ErrorProfile
    confident_errors: List[ConfidentError]


class ResultExplainer:
    """
    Turns a finished run into the three questions a practitioner actually asks:
    is the confidence trustworthy, what happens if I only accept confident
    predictions, and what do the mistakes have in common?
    """

    def __init__(self, n_bins: int = 10, n_confident_errors: int = 8):
        self.n_bins = n_bins
        self.n_confident_errors = n_confident_errors

    def explain(
        self,
        soft_labels: np.ndarray,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        evaluated_mask: np.ndarray,
        margin: np.ndarray,
        local_homophily: np.ndarray,
        unreachable: List[int],
    ) -> ResultExplanation:
        idx = np.where(evaluated_mask)[0]
        if idx.size == 0:
            return self._empty()

        confidence = soft_labels[idx].max(axis=1)
        correct = y_pred[idx] == y_true[idx]
        accuracy = float(correct.mean())

        bins, ece = self._calibration(confidence, correct)

        return ResultExplanation(
            accuracy=accuracy,
            expected_calibration_error=ece,
            calibration=bins,
            risk_coverage=self._risk_coverage(confidence, correct),
            error_profile=self._error_profile(idx, correct, margin, local_homophily, unreachable),
            confident_errors=self._confident_errors(
                idx, correct, confidence, margin, local_homophily, y_true, y_pred
            ),
        )

    def _calibration(self, confidence: np.ndarray, correct: np.ndarray):
        edges = np.linspace(0.0, 1.0, self.n_bins + 1)
        bins: List[CalibrationBin] = []
        ece = 0.0
        total = confidence.size

        for b in range(self.n_bins):
            lower, upper = edges[b], edges[b + 1]
            # last bin is closed so confidence == 1.0 is not dropped
            in_bin = (confidence > lower) & (confidence <= upper) if b > 0 else (confidence >= lower) & (confidence <= upper)
            count = int(in_bin.sum())
            if count == 0:
                bins.append(CalibrationBin(float(lower), float(upper), 0, 0.0, 0.0))
                continue
            mean_conf = float(confidence[in_bin].mean())
            bin_acc = float(correct[in_bin].mean())
            ece += (count / total) * abs(bin_acc - mean_conf)
            bins.append(CalibrationBin(float(lower), float(upper), count, mean_conf, bin_acc))

        return bins, float(ece)

    def _risk_coverage(self, confidence: np.ndarray, correct: np.ndarray) -> List[RiskCoveragePoint]:
        points: List[RiskCoveragePoint] = []
        total = confidence.size
        for threshold in np.linspace(0.0, 0.95, 20):
            keep = confidence >= threshold
            n_kept = int(keep.sum())
            if n_kept == 0:
                continue
            points.append(
                RiskCoveragePoint(
                    threshold=float(threshold),
                    coverage=float(n_kept / total),
                    accuracy=float(correct[keep].mean()),
                    n_kept=n_kept,
                )
            )
        return points

    def _error_profile(
        self,
        idx: np.ndarray,
        correct: np.ndarray,
        margin: np.ndarray,
        local_homophily: np.ndarray,
        unreachable: List[int],
    ) -> ErrorProfile:
        margins = margin[idx]
        homophily = local_homophily[idx]
        errors = ~correct

        quartile = float(np.quantile(margins, 0.25)) if margins.size else 0.0
        in_low_quartile = margins <= quartile
        n_errors = int(errors.sum())
        errors_low = float((errors & in_low_quartile).sum() / n_errors) if n_errors else 0.0

        unreachable_set = set(unreachable)
        unreachable_errors = int(sum(1 for k, node in enumerate(idx) if errors[k] and int(node) in unreachable_set))

        return ErrorProfile(
            n_evaluated=int(idx.size),
            n_errors=n_errors,
            mean_margin_correct=float(margins[correct].mean()) if correct.any() else 0.0,
            mean_margin_error=float(margins[errors].mean()) if errors.any() else 0.0,
            mean_homophily_correct=float(homophily[correct].mean()) if correct.any() else 0.0,
            mean_homophily_error=float(homophily[errors].mean()) if errors.any() else 0.0,
            errors_in_lowest_margin_quartile=errors_low,
            unreachable_errors=unreachable_errors,
        )

    def _confident_errors(
        self,
        idx: np.ndarray,
        correct: np.ndarray,
        confidence: np.ndarray,
        margin: np.ndarray,
        local_homophily: np.ndarray,
        y_true: np.ndarray,
        y_pred: np.ndarray,
    ) -> List[ConfidentError]:
        error_positions = np.where(~correct)[0]
        if error_positions.size == 0:
            return []
        ordered = error_positions[np.argsort(confidence[error_positions])[::-1][: self.n_confident_errors]]
        return [
            ConfidentError(
                node_id=int(idx[k]),
                true_label=int(y_true[idx[k]]),
                predicted=int(y_pred[idx[k]]),
                confidence=float(confidence[k]),
                margin=float(margin[idx[k]]),
                local_homophily=float(local_homophily[idx[k]]),
            )
            for k in ordered
        ]

    def _empty(self) -> ResultExplanation:
        return ResultExplanation(
            accuracy=0.0,
            expected_calibration_error=0.0,
            calibration=[],
            risk_coverage=[],
            error_profile=ErrorProfile(0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0),
            confident_errors=[],
        )
