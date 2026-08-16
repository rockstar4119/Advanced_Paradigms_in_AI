import numpy as np

from app.core.metrics import MetricsCalculator

ALL = np.ones(5, dtype=bool)


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


def test_perfect_prediction_saturates_every_agreement_score():
    y = np.array([0, 0, 1, 1, 1])

    result = MetricsCalculator().evaluate(y, y, ALL)

    assert result.balanced_accuracy == 1.0
    assert result.macro_f1 == 1.0
    assert result.weighted_f1 == 1.0
    assert abs(result.cohen_kappa - 1.0) < 1e-12
    assert abs(result.matthews_corrcoef - 1.0) < 1e-12
    assert result.n_evaluated == 5


def test_majority_class_guessing_scores_zero_agreement():
    """The reason kappa and phi are on the panel: 80% accuracy, no skill."""
    y_true = np.array([1, 1, 1, 1, 0])
    y_pred = np.ones(5, dtype=int)

    result = MetricsCalculator().evaluate(y_true, y_pred, ALL)

    assert result.accuracy == 0.8
    assert abs(result.cohen_kappa) < 1e-12
    assert abs(result.matthews_corrcoef) < 1e-12
    assert result.balanced_accuracy == 0.5


def test_balanced_accuracy_ignores_class_sizes():
    y_true = np.array([0, 1, 1, 1, 1])
    y_pred = np.array([0, 1, 1, 0, 0])

    result = MetricsCalculator().evaluate(y_true, y_pred, ALL)

    # Recall is 1.0 on the singleton class and 0.5 on the majority.
    assert abs(result.balanced_accuracy - 0.75) < 1e-12
    assert result.accuracy == 0.6


def test_macro_and_weighted_f1_diverge_under_imbalance():
    y_true = np.array([0, 1, 1, 1, 1])
    y_pred = np.array([1, 1, 1, 1, 1])

    result = MetricsCalculator().evaluate(y_true, y_pred, ALL)

    assert result.macro_f1 < result.weighted_f1


def test_probabilistic_metrics_reward_a_confident_correct_posterior():
    soft_labels = np.array([[0.99, 0.01], [0.01, 0.99], [0.98, 0.02]])
    y_true = np.array([0, 1, 0])
    mask = np.ones(3, dtype=bool)

    scores = MetricsCalculator().probabilistic(soft_labels, y_true, mask, accuracy=1.0)

    assert scores is not None
    assert scores.brier_score < 0.01
    assert scores.log_loss < 0.05
    assert scores.auroc_macro == 1.0
    assert scores.mean_margin > 0.9
    assert scores.confidence_gap < 0.0  # confident, but still shy of perfect accuracy


def test_confidence_gap_flags_an_overconfident_model():
    soft_labels = np.array([[0.95, 0.05], [0.95, 0.05]])
    y_true = np.array([0, 1])
    mask = np.ones(2, dtype=bool)

    scores = MetricsCalculator().probabilistic(soft_labels, y_true, mask, accuracy=0.5)

    assert scores is not None
    assert scores.confidence_gap > 0.4


def test_unreachable_nodes_fall_back_to_a_uniform_posterior():
    """Harmonic leaves all-zero rows on nodes no seed reaches; scoring those
    rows as-is would divide by zero and poison every posterior metric."""
    soft_labels = np.array([[0.0, 0.0], [0.0, 0.0]])
    y_true = np.array([0, 1])
    mask = np.ones(2, dtype=bool)

    scores = MetricsCalculator().probabilistic(soft_labels, y_true, mask, accuracy=0.5)

    assert scores is not None
    assert abs(scores.mean_entropy - 1.0) < 1e-9
    assert abs(scores.mean_confidence - 0.5) < 1e-9
    assert np.isfinite(scores.log_loss)


def test_probabilistic_metrics_are_none_without_a_posterior():
    y_true = np.array([0, 1])
    assert MetricsCalculator().probabilistic(None, y_true, np.ones(2, dtype=bool), 0.5) is None


def test_auroc_handles_tied_scores_with_average_ranks():
    """Every score identical is a coin flip, not a perfect ranker."""
    soft_labels = np.tile([0.5, 0.5], (6, 1))
    y_true = np.array([0, 0, 0, 1, 1, 1])
    mask = np.ones(6, dtype=bool)

    scores = MetricsCalculator().probabilistic(soft_labels, y_true, mask, accuracy=0.5)

    assert scores is not None
    assert abs(scores.auroc_macro - 0.5) < 1e-12
