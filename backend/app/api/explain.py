from __future__ import annotations

from dataclasses import asdict
from typing import List, Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.graph_explain import GraphExplainer
from app.core.influence import InfluenceAnalyzer, InfluenceResult
from app.core.result_explain import ResultExplainer
from app.core.state import SessionState, session_store

router = APIRouter(prefix="/api/explain", tags=["explain"])


# ----------------------------------------------------------------- responses


class LeakEdgeOut(BaseModel):
    source: int
    target: int
    weight: float
    source_class: int
    target_class: int


class HistogramOut(BaseModel):
    bin_edges: List[float]
    counts: List[int]


class ComponentOut(BaseModel):
    component_id: int
    size: int
    n_labeled: int
    classes_present: List[int]


class GraphExplanationOut(BaseModel):
    homophily_weighted: float
    homophily_unweighted: float
    n_cross_class_edges: int
    cross_class_weight_fraction: float
    top_leaks: List[LeakEdgeOut]
    degree_histogram: HistogramOut
    weight_histogram: HistogramOut
    isolated_nodes: List[int]
    weak_nodes: List[int]
    components: List[ComponentOut]
    n_unreachable: int
    node_degree: List[float]
    node_neighbors: List[int]
    node_local_homophily: List[float]


class SeedContributionOut(BaseModel):
    seed_node: int
    seed_class: int
    mass: float


class NodeExplanationOut(BaseModel):
    node_id: int
    predicted: int
    true_label: int
    soft_labels: List[float]
    entropy: float
    margin: float
    degree: float
    n_neighbors: int
    local_homophily: float
    reachable: bool
    top_seeds: List[SeedContributionOut]
    class_mass: List[float]


class SeedInfluenceOut(BaseModel):
    seed_node: int
    seed_class: int
    total_mass: float
    share: float
    n_nodes_dominated: int


class InfluenceSummaryOut(BaseModel):
    seed_influence: List[SeedInfluenceOut]
    unreachable: List[int]
    entropy: List[float]
    margin: List[float]
    redundant_seeds: List[int]


class CalibrationBinOut(BaseModel):
    lower: float
    upper: float
    count: int
    mean_confidence: float
    accuracy: float


class RiskCoveragePointOut(BaseModel):
    threshold: float
    coverage: float
    accuracy: float
    n_kept: int


class ConfidentErrorOut(BaseModel):
    node_id: int
    true_label: int
    predicted: int
    confidence: float
    margin: float
    local_homophily: float


class ErrorProfileOut(BaseModel):
    n_evaluated: int
    n_errors: int
    mean_margin_correct: float
    mean_margin_error: float
    mean_homophily_correct: float
    mean_homophily_error: float
    errors_in_lowest_margin_quartile: float
    unreachable_errors: int


class ResultExplanationOut(BaseModel):
    accuracy: float
    homophily_ceiling: float
    expected_calibration_error: float
    calibration: List[CalibrationBinOut]
    risk_coverage: List[RiskCoveragePointOut]
    error_profile: ErrorProfileOut
    confident_errors: List[ConfidentErrorOut]


# ------------------------------------------------------------------ helpers


def _require_graph(session_id: str) -> SessionState:
    session = session_store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="unknown session")
    if session.graph is None:
        raise HTTPException(status_code=400, detail="Build a graph first")
    return session


def _influence(session: SessionState) -> InfluenceResult:
    """The absorption solve is O(n^3), so it is computed once per graph."""
    if session.influence is None:
        session.influence = InfluenceAnalyzer().analyze(
            session.graph, session.observed_labels, session.dataset.n_classes
        )
    return session.influence  # type: ignore[return-value]


# ---------------------------------------------------------------- endpoints


@router.get("/{session_id}/graph", response_model=GraphExplanationOut)
def explain_graph(session_id: str) -> GraphExplanationOut:
    session = _require_graph(session_id)
    explanation = GraphExplainer().explain(
        session.graph, session.dataset.y_true, session.observed_labels
    )
    return GraphExplanationOut(**asdict(explanation))


@router.get("/{session_id}/influence", response_model=InfluenceSummaryOut)
def explain_influence(session_id: str) -> InfluenceSummaryOut:
    session = _require_graph(session_id)
    result = _influence(session)

    # A seed carrying almost no absorption mass is doing no work — its budget
    # would have been better spent elsewhere.
    threshold = 0.25 / max(len(result.seed_influence), 1)
    redundant = [s.seed_node for s in result.seed_influence if s.share < threshold]

    return InfluenceSummaryOut(
        seed_influence=[SeedInfluenceOut(**asdict(s)) for s in result.seed_influence],
        unreachable=result.unreachable,
        entropy=[float(v) for v in result.entropy],
        margin=[float(v) for v in result.margin],
        redundant_seeds=redundant,
    )


@router.get("/{session_id}/node/{node_id}", response_model=NodeExplanationOut)
def explain_node(session_id: str, node_id: int) -> NodeExplanationOut:
    session = _require_graph(session_id)
    n = session.graph.shape[0]
    if not 0 <= node_id < n:
        raise HTTPException(status_code=404, detail="unknown node")

    result = _influence(session)
    graph_explanation = GraphExplainer().explain(
        session.graph, session.dataset.y_true, session.observed_labels
    )

    # Prefer the soft labels the user actually watched; fall back to the exact
    # harmonic solution when the last run was mincut (or nothing has run yet).
    soft = session.last_soft_labels
    if soft is None:
        soft = InfluenceAnalyzer()._soft_from_absorption(
            result.absorption,
            session.observed_labels[result.labeled],
            session.dataset.n_classes,
        )

    explanation = InfluenceAnalyzer().explain_node(
        node_id=node_id,
        result=result,
        soft_labels=soft,
        y_true=session.dataset.y_true,
        observed=session.observed_labels,
        degree=np.array(graph_explanation.node_degree),
        n_neighbors=np.array(graph_explanation.node_neighbors),
        local_homophily=np.array(graph_explanation.node_local_homophily),
    )
    return NodeExplanationOut(**asdict(explanation))


@router.get("/{session_id}/result", response_model=ResultExplanationOut)
def explain_result(session_id: str) -> ResultExplanationOut:
    session = _require_graph(session_id)

    if session.last_predictions is None:
        raise HTTPException(status_code=400, detail="Run a propagation first")
    if session.last_soft_labels is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Calibration and selective prediction need soft labels. "
                "Mincut returns a hard partition with no confidence — run harmonic propagation."
            ),
        )

    result = _influence(session)
    graph_explanation = GraphExplainer().explain(
        session.graph, session.dataset.y_true, session.observed_labels
    )

    explanation = ResultExplainer().explain(
        soft_labels=session.last_soft_labels,
        y_true=session.dataset.y_true,
        y_pred=session.last_predictions,
        evaluated_mask=session.observed_labels < 0,
        margin=result.margin,
        local_homophily=np.array(graph_explanation.node_local_homophily),
        unreachable=result.unreachable,
    )

    return ResultExplanationOut(
        homophily_ceiling=graph_explanation.homophily_weighted,
        **asdict(explanation),
    )
