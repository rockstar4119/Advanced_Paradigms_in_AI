"""End-to-end walk through the real app: dataset -> graph -> run -> explain -> arena."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def session(client):
    response = client.post(
        "/api/datasets/generate",
        json={
            "dataset_type": "two_moons",
            "n_samples": 120,
            "noise": 0.08,
            "label_fraction": 0.1,
            "seed": 11,
        },
    )
    assert response.status_code == 200
    session_id = response.json()["session_id"]

    with client.websocket_connect(f"/ws/graph/{session_id}") as socket:
        socket.send_json({"method": "knn", "k": 6, "sigma": 0.4, "mutual": False, "sparsify_threshold": 0.0})
        while True:
            message = socket.receive_json()
            if message["type"] == "build_done":
                assert message["edge_count"] > 0
                break

    return session_id


def test_graph_explanation_reports_homophily_and_structure(client, session):
    response = client.get(f"/api/explain/{session}/graph")
    assert response.status_code == 200
    body = response.json()

    assert 0.0 <= body["homophily_weighted"] <= 1.0
    assert body["homophily_weighted"] > 0.7  # two moons at low noise is a clean graph
    assert len(body["node_degree"]) == 120
    assert len(body["degree_histogram"]["counts"]) == 12
    assert body["n_unreachable"] == 0


def test_influence_summary_attributes_all_mass_to_seeds(client, session):
    response = client.get(f"/api/explain/{session}/influence")
    assert response.status_code == 200
    body = response.json()

    assert len(body["seed_influence"]) > 0
    assert abs(sum(s["share"] for s in body["seed_influence"]) - 1.0) < 1e-6
    assert len(body["entropy"]) == 120


def test_node_explanation_decomposes_into_seeds(client, session):
    response = client.get(f"/api/explain/{session}/node/7")
    assert response.status_code == 200
    body = response.json()

    assert body["node_id"] == 7
    assert len(body["top_seeds"]) > 0
    assert abs(sum(body["class_mass"]) - 1.0) < 1e-6
    assert 0.0 <= body["local_homophily"] <= 1.0


def test_result_explanation_requires_a_run_first(client, session):
    response = client.get(f"/api/explain/{session}/result")
    assert response.status_code == 400
    assert "Run a propagation" in response.json()["detail"]


def test_result_explanation_after_harmonic_run(client, session):
    with client.websocket_connect(f"/ws/propagate/{session}") as socket:
        socket.send_json(
            {"algorithm": "harmonic", "max_iter": 300, "tol": 1e-5, "source_class": 0, "sink_class": 1}
        )
        while True:
            message = socket.receive_json()
            if message["type"] == "done":
                break

    response = client.get(f"/api/explain/{session}/result")
    assert response.status_code == 200
    body = response.json()

    assert 0.0 <= body["accuracy"] <= 1.0
    assert 0.0 <= body["expected_calibration_error"] <= 1.0
    assert len(body["calibration"]) == 10
    assert body["error_profile"]["n_evaluated"] > 0
    assert body["homophily_ceiling"] > 0.7

    # Selective prediction must trade coverage for accuracy monotonically in coverage.
    coverages = [p["coverage"] for p in body["risk_coverage"]]
    assert coverages == sorted(coverages, reverse=True)


def test_mincut_run_refuses_calibration_with_a_clear_reason(client, session):
    with client.websocket_connect(f"/ws/propagate/{session}") as socket:
        socket.send_json(
            {"algorithm": "mincut", "max_iter": 200, "tol": 1e-4, "source_class": 0, "sink_class": 1}
        )
        while True:
            message = socket.receive_json()
            if message["type"] == "done":
                break

    response = client.get(f"/api/explain/{session}/result")
    assert response.status_code == 400
    assert "hard partition" in response.json()["detail"]


HARMONIC_RUN = {"algorithm": "harmonic", "max_iter": 300, "tol": 1e-5, "source_class": 0, "sink_class": 1}
MINCUT_RUN = {"algorithm": "mincut", "max_iter": 200, "tol": 1e-4, "source_class": 0, "sink_class": 1}

AGREEMENT_KEYS = [
    "balanced_accuracy",
    "macro_precision",
    "macro_recall",
    "macro_f1",
    "weighted_f1",
    "cohen_kappa",
    "matthews_corrcoef",
    "n_evaluated",
]
POSTERIOR_KEYS = [
    "mean_entropy",
    "mean_confidence",
    "mean_margin",
    "confidence_gap",
    "brier_score",
    "log_loss",
    "auroc_macro",
]


def run_to_completion(client, session, params):
    with client.websocket_connect(f"/ws/propagate/{session}") as socket:
        socket.send_json(params)
        while True:
            message = socket.receive_json()
            if message["type"] == "done":
                return message


def test_harmonic_done_event_carries_agreement_and_posterior_metrics(client, session):
    done = run_to_completion(client, session, HARMONIC_RUN)

    assert all(key in done for key in AGREEMENT_KEYS + POSTERIOR_KEYS)
    assert done["n_evaluated"] > 0
    assert -1.0 <= done["cohen_kappa"] <= 1.0
    assert -1.0 <= done["matthews_corrcoef"] <= 1.0
    assert 0.0 <= done["auroc_macro"] <= 1.0
    assert done["brier_score"] >= 0.0
    assert done["log_loss"] >= 0.0

    # Two moons at low noise is easy, so the scores should agree with each other.
    assert done["macro_f1"] > 0.8
    assert done["cohen_kappa"] > 0.8


def test_mincut_done_event_reports_agreement_but_no_posterior(client, session):
    """A hard partition has nothing to calibrate, so those tiles must stay absent
    rather than showing an invented posterior."""
    done = run_to_completion(client, session, MINCUT_RUN)

    assert all(key in done for key in AGREEMENT_KEYS)
    assert not any(key in done for key in POSTERIOR_KEYS)


def test_patient_zero_scenario_runs_end_to_end(client):
    response = client.post(
        "/api/datasets/generate",
        json={
            "dataset_type": "patient_zero",
            "n_samples": 160,
            "noise": 0.1,
            "label_fraction": 0.12,
            "seed": 4,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["n_classes"] == 2
    assert len(body["nodes"]) == 160

    outbreak = body["session_id"]
    with client.websocket_connect(f"/ws/graph/{outbreak}") as socket:
        socket.send_json({"method": "knn", "k": 6, "sigma": 1.0, "mutual": False, "sparsify_threshold": 0.0})
        while True:
            if socket.receive_json()["type"] == "build_done":
                break

    done = run_to_completion(client, outbreak, HARMONIC_RUN)

    # Local spread is recoverable from geometry; the flight-borne pocket is not,
    # so this must land clearly above chance without pretending to be solved.
    assert done["accuracy"] > 0.6
    assert done["cohen_kappa"] > 0.2


def test_arena_race_runs_and_keeps_budgets_equal(client, session):
    start = client.post(
        f"/api/arena/{session}/start",
        json={"batch_size": 4, "strategy": "entropy", "holdout_fraction": 0.3, "seed": 3},
    )
    assert start.status_code == 200
    body = start.json()

    assert body["round_index"] == 0
    assert len(body["suggestions"]) == 4
    assert body["tracks"]["guided"]["n_labels"] == body["tracks"]["random"]["n_labels"]

    holdout = set(body["holdout"])
    assert holdout
    assert all(s["node_id"] not in holdout for s in body["suggestions"])

    for expected_round in range(1, 5):
        step = client.post(f"/api/arena/{session}/step")
        assert step.status_code == 200
        body = step.json()
        assert body["round_index"] == expected_round
        assert body["tracks"]["guided"]["n_labels"] == body["tracks"]["random"]["n_labels"]
        assert len(body["tracks"]["guided"]["newly_labeled"]) == 4

    guided_history = body["tracks"]["guided"]["history"]
    assert len(guided_history) == 5
    assert guided_history[-1]["n_labels"] > guided_history[0]["n_labels"]


def test_arena_requires_a_graph(client):
    response = client.post(
        "/api/datasets/generate",
        json={"dataset_type": "circles", "n_samples": 60, "noise": 0.05, "label_fraction": 0.1, "seed": 2},
    )
    fresh = response.json()["session_id"]

    started = client.post(f"/api/arena/{fresh}/start", json={"batch_size": 2})
    assert started.status_code == 400
    assert "Build a graph" in started.json()["detail"]


def test_rebuilding_the_graph_clears_stale_explanations(client, session):
    with client.websocket_connect(f"/ws/graph/{session}") as socket:
        socket.send_json({"method": "knn", "k": 4, "sigma": 0.4, "mutual": False, "sparsify_threshold": 0.0})
        while True:
            if socket.receive_json()["type"] == "build_done":
                break

    # The previous run's soft labels belonged to a graph that no longer exists.
    response = client.get(f"/api/explain/{session}/result")
    assert response.status_code == 400

    arena = client.get(f"/api/arena/{session}")
    assert arena.status_code == 400
