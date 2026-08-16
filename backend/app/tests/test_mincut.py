import numpy as np

from app.core.label_propagation.mincut import GraphMincutClassifier, MincutFoundStep, OneVsRestMincut


def test_mincut_separates_two_clusters():
    adjacency = np.array(
        [
            [0, 1, 1, 0, 0, 0],
            [1, 0, 1, 0, 0, 0],
            [1, 1, 0, 0.01, 0, 0],
            [0, 0, 0.01, 0, 1, 1],
            [0, 0, 0, 1, 0, 1],
            [0, 0, 0, 1, 1, 0],
        ]
    )
    classifier = GraphMincutClassifier(adjacency)
    steps = list(classifier.run(source_nodes=[0], sink_nodes=[5]))
    final = steps[-1]

    assert isinstance(final, MincutFoundStep)
    assert set(final.side_source) == {0, 1, 2}
    assert set(final.side_sink) == {3, 4, 5}
    assert final.cut_edges == [(2, 3)]


def test_one_vs_rest_assigns_every_unlabeled_node():
    n = 9
    adjacency = np.zeros((n, n))
    clusters = [[0, 1, 2], [3, 4, 5], [6, 7, 8]]
    for cluster in clusters:
        for i in cluster:
            for j in cluster:
                if i != j:
                    adjacency[i, j] = 1.0
    adjacency[2, 3] = 0.01
    adjacency[3, 2] = 0.01
    adjacency[5, 6] = 0.01
    adjacency[6, 5] = 0.01

    y_observed = np.full(n, -1, dtype=int)
    y_observed[0] = 0
    y_observed[3] = 1
    y_observed[6] = 2

    wrapper = OneVsRestMincut(adjacency)
    final_labels = None
    for item in wrapper.run(y_observed, n_classes=3):
        if hasattr(item, "labels"):
            final_labels = item.labels

    assert final_labels is not None
    assert final_labels[1] == 0
    assert final_labels[4] == 1
    assert final_labels[7] == 2
