import numpy as np

from app.core.graph_builder import KNNGraphBuilder, RBFGraphBuilder


def test_knn_builder_is_symmetric():
    X = np.array([[0, 0], [1, 0], [0, 1], [5, 5]], dtype=float)
    builder = KNNGraphBuilder(k=2, sigma=1.0)
    list(builder.build(X))
    assert np.allclose(builder.adjacency, builder.adjacency.T)


def test_knn_builder_respects_mutual_flag():
    X = np.array([[0, 0], [0.1, 0], [10, 10], [10.1, 10]], dtype=float)
    builder = KNNGraphBuilder(k=1, sigma=1.0, mutual=True)
    edges = list(builder.build(X))
    assert all(builder.adjacency[e.source, e.target] > 0 for e in edges)


def test_rbf_builder_weights_in_unit_range():
    X = np.random.default_rng(0).normal(size=(10, 2))
    builder = RBFGraphBuilder(sigma=1.0)
    edges = list(builder.build(X))
    assert len(edges) == 45
    assert all(0.0 <= edge.weight <= 1.0 for edge in edges)


def test_rbf_sparsify_threshold_drops_weak_edges():
    X = np.random.default_rng(1).normal(size=(20, 2))
    builder = RBFGraphBuilder(sigma=0.3, sparsify_threshold=0.2)
    edges = list(builder.build(X))
    assert all(edge.weight >= 0.2 for edge in edges)
