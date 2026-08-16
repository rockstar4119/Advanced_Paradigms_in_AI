import numpy as np

from app.core.metrics import MetricsCalculator


def test_per_class_metrics_perfect_prediction():
    y_true = np.array([0, 0, 1, 1, 1])
    y_pred = np.array([0, 0, 1, 1, 1])
    mask = np.array([True, True, True, True, True])

    result = MetricsCalculator().evaluate(y_true, y_pred, mask)

    assert result.accuracy == 1.0
    assert all(m.precision == 1.0 and m.recall == 1.0 for m in result.per_class)


def test_mean_entropy_is_zero_for_confident_predictions():
    soft_labels = np.array([[1.0, 0.0], [0.0, 1.0], [0.5, 0.5]])
    unlabeled_mask = np.array([True, True, False])

    entropy = MetricsCalculator().mean_entropy(soft_labels, unlabeled_mask)

    assert entropy < 1e-8


def test_mean_entropy_is_positive_for_uncertain_predictions():
    soft_labels = np.array([[0.5, 0.5], [0.5, 0.5]])
    unlabeled_mask = np.array([True, True])

    entropy = MetricsCalculator().mean_entropy(soft_labels, unlabeled_mask)

    assert abs(entropy - 1.0) < 1e-6
