import numpy as np

from app.core.graph_metrics import GraphAnalyzer


def test_analyzer_reports_single_component_for_connected_graph():
    adjacency = np.array(
        [
            [0, 1, 0, 0],
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
        ],
        dtype=float,
    )
    stats = GraphAnalyzer().analyze(adjacency)

    assert stats.n_edges == 3
    assert stats.n_components == 1
    assert stats.algebraic_connectivity > 0


def test_analyzer_detects_disconnected_components():
    adjacency = np.zeros((4, 4))
    adjacency[0, 1] = adjacency[1, 0] = 1
    adjacency[2, 3] = adjacency[3, 2] = 1

    stats = GraphAnalyzer().analyze(adjacency)

    assert stats.n_components == 2
    assert stats.algebraic_connectivity == 0.0
