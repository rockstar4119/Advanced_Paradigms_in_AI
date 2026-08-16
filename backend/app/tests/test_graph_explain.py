import numpy as np

from app.core.graph_explain import GraphExplainer, reachable_from_labeled


def test_pure_graph_has_perfect_homophily():
    adjacency = np.zeros((4, 4))
    adjacency[0, 1] = adjacency[1, 0] = 1.0
    adjacency[2, 3] = adjacency[3, 2] = 1.0
    y_true = np.array([0, 0, 1, 1])
    observed = np.array([0, -1, 1, -1])

    explanation = GraphExplainer().explain(adjacency, y_true, observed)

    assert explanation.homophily_weighted == 1.0
    assert explanation.n_cross_class_edges == 0
    assert explanation.top_leaks == []


def test_cross_class_edges_are_ranked_by_weight():
    adjacency = np.zeros((4, 4))
    adjacency[0, 1] = adjacency[1, 0] = 0.9   # same class
    adjacency[1, 2] = adjacency[2, 1] = 0.3   # leak
    adjacency[0, 3] = adjacency[3, 0] = 0.7   # heavier leak
    y_true = np.array([0, 0, 1, 1])
    observed = np.array([0, -1, 1, -1])

    explanation = GraphExplainer().explain(adjacency, y_true, observed)

    assert explanation.n_cross_class_edges == 2
    assert explanation.top_leaks[0].weight == 0.7
    assert explanation.top_leaks[0].source_class != explanation.top_leaks[0].target_class
    assert 0.0 < explanation.homophily_weighted < 1.0


def test_isolated_and_unreachable_nodes_are_surfaced():
    adjacency = np.zeros((5, 5))
    adjacency[0, 1] = adjacency[1, 0] = 1.0
    adjacency[2, 3] = adjacency[3, 2] = 1.0  # component with no label
    # node 4 has no edges at all
    y_true = np.array([0, 0, 1, 1, 0])
    observed = np.array([0, -1, -1, -1, -1])

    explanation = GraphExplainer().explain(adjacency, y_true, observed)

    assert explanation.isolated_nodes == [4]
    assert explanation.n_unreachable == 3  # nodes 2, 3 and 4
    assert len(explanation.components) == 3


def test_local_homophily_is_weight_share_of_same_class_neighbours():
    adjacency = np.zeros((3, 3))
    adjacency[0, 1] = adjacency[1, 0] = 3.0  # same class as node 0
    adjacency[0, 2] = adjacency[2, 0] = 1.0  # different class
    y_true = np.array([0, 0, 1])
    observed = np.array([0, -1, -1])

    explanation = GraphExplainer().explain(adjacency, y_true, observed)

    assert np.isclose(explanation.node_local_homophily[0], 0.75)
    assert np.isclose(explanation.node_local_homophily[1], 1.0)


def test_reachable_from_labeled_walks_the_whole_component():
    adjacency = np.zeros((4, 4))
    adjacency[0, 1] = adjacency[1, 0] = 1.0
    adjacency[1, 2] = adjacency[2, 1] = 1.0
    observed = np.array([-1, -1, 0, -1])

    reachable = reachable_from_labeled(adjacency, observed)

    assert reachable.tolist() == [True, True, True, False]
