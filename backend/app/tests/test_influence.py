import numpy as np

from app.core.influence import InfluenceAnalyzer
from app.core.label_propagation.harmonic import HarmonicPropagator


def two_cluster_graph():
    """Two dense triangles joined by one weak bridge."""
    edges = [
        (0, 1, 0.9), (0, 2, 0.8), (1, 2, 0.95), (1, 3, 0.85), (2, 3, 0.9),
        (3, 4, 0.15),
        (4, 5, 0.9), (4, 6, 0.85), (5, 6, 0.95), (5, 7, 0.9), (6, 7, 0.8),
    ]
    adjacency = np.zeros((8, 8))
    for i, j, w in edges:
        adjacency[i, j] = adjacency[j, i] = w
    return adjacency


def test_absorption_rows_sum_to_one():
    adjacency = two_cluster_graph()
    observed = np.full(8, -1)
    observed[0] = 0
    observed[7] = 1

    result = InfluenceAnalyzer().analyze(adjacency, observed, 2)

    assert np.allclose(result.absorption.sum(axis=1), 1.0)


def test_absorption_reproduces_harmonic_solution():
    """The closed-form decomposition must agree with the iterative solver."""
    adjacency = two_cluster_graph()
    observed = np.full(8, -1)
    observed[0] = 0
    observed[7] = 1

    propagator = HarmonicPropagator(adjacency, max_iter=5000, tol=1e-14)
    iterated = None
    for step in propagator.run(observed, 2):
        iterated = step.soft_labels

    analyzer = InfluenceAnalyzer()
    result = analyzer.analyze(adjacency, observed, 2)
    closed_form = analyzer._soft_from_absorption(result.absorption, observed[result.labeled], 2)

    assert np.allclose(iterated, closed_form, atol=1e-6)


def test_influence_falls_off_with_distance_from_seed():
    adjacency = two_cluster_graph()
    observed = np.full(8, -1)
    observed[0] = 0
    observed[7] = 1

    result = InfluenceAnalyzer().analyze(adjacency, observed, 2)
    seed_zero = list(result.labeled).index(0)

    # Node 1 sits beside the seed; node 3 is a hop further and across the graph.
    assert result.absorption[1, seed_zero] > result.absorption[3, seed_zero]
    assert result.absorption[3, seed_zero] > result.absorption[4, seed_zero]


def test_unreachable_nodes_are_reported_not_solved():
    adjacency = np.zeros((4, 4))
    adjacency[0, 1] = adjacency[1, 0] = 1.0
    adjacency[2, 3] = adjacency[3, 2] = 1.0  # island with no labels

    observed = np.array([0, -1, -1, -1])
    result = InfluenceAnalyzer().analyze(adjacency, observed, 2)

    assert set(result.unreachable) == {2, 3}
    assert np.allclose(result.absorption[[2, 3]], 0.0)
    assert np.isclose(result.absorption[1].sum(), 1.0)


def test_seed_influence_shares_sum_to_one():
    adjacency = two_cluster_graph()
    observed = np.full(8, -1)
    observed[0] = 0
    observed[1] = 0
    observed[7] = 1

    result = InfluenceAnalyzer().analyze(adjacency, observed, 2)
    total_share = sum(s.share for s in result.seed_influence)

    assert np.isclose(total_share, 1.0)
    assert len(result.seed_influence) == 3
