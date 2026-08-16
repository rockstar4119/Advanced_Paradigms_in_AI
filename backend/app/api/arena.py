from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.active_learning import STRATEGIES, ActiveLearningArena
from app.core.state import SessionState, session_store

router = APIRouter(prefix="/api/arena", tags=["arena"])


class StartArenaRequest(BaseModel):
    batch_size: int = Field(default=4, ge=1, le=25)
    strategy: Literal["entropy", "margin", "density_entropy", "random"] = "entropy"
    holdout_fraction: float = Field(default=0.3, ge=0.1, le=0.6)
    seed: Optional[int] = None


class SuggestionOut(BaseModel):
    node_id: int
    score: float
    entropy: float
    margin: float
    degree: float


class RoundPointOut(BaseModel):
    round_index: int
    n_labels: int
    accuracy: float
    mean_entropy: float


class TrackOut(BaseModel):
    name: str
    strategy: str
    n_labels: int
    accuracy: float
    mean_entropy: float
    history: List[RoundPointOut]
    predictions: List[int]
    confidence: List[float]
    entropy: List[float]
    observed: List[int]
    newly_labeled: List[int]


class ArenaOut(BaseModel):
    round_index: int
    batch_size: int
    strategy: str
    holdout: List[int]
    pool_size: int
    exhausted: bool
    n_classes: int
    tracks: Dict[str, TrackOut]
    suggestions: List[SuggestionOut]


def _require_graph(session_id: str) -> SessionState:
    session = session_store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="unknown session")
    if session.graph is None:
        raise HTTPException(status_code=400, detail="Build a graph before starting the arena")
    return session


def _require_arena(session_id: str) -> ActiveLearningArena:
    session = _require_graph(session_id)
    if session.arena is None:
        raise HTTPException(status_code=400, detail="Start the arena first")
    return session.arena  # type: ignore[return-value]


def _out(arena: ActiveLearningArena) -> ArenaOut:
    return ArenaOut(**asdict(arena.snapshot()))


@router.post("/{session_id}/start", response_model=ArenaOut)
def start_arena(session_id: str, request: StartArenaRequest) -> ArenaOut:
    session = _require_graph(session_id)
    if request.strategy not in STRATEGIES:
        raise HTTPException(status_code=400, detail=f"unknown strategy: {request.strategy}")

    if (session.observed_labels < 0).sum() < 4:
        raise HTTPException(
            status_code=400,
            detail="Not enough unlabeled nodes to run an arena — lower the label fraction.",
        )

    arena = ActiveLearningArena(
        adjacency=session.graph,
        y_true=session.dataset.y_true,
        n_classes=session.dataset.n_classes,
        initial_observed=session.observed_labels,
        batch_size=request.batch_size,
        strategy=request.strategy,
        holdout_fraction=request.holdout_fraction,
        seed=request.seed,
    )
    session.arena = arena
    return _out(arena)


@router.post("/{session_id}/step", response_model=ArenaOut)
def step_arena(session_id: str) -> ArenaOut:
    arena = _require_arena(session_id)
    if arena.exhausted():
        raise HTTPException(status_code=400, detail="Label budget exhausted — every node is spent")
    arena.step()
    return _out(arena)


@router.get("/{session_id}", response_model=ArenaOut)
def get_arena(session_id: str) -> ArenaOut:
    return _out(_require_arena(session_id))


@router.delete("/{session_id}")
def reset_arena(session_id: str) -> dict:
    session = _require_graph(session_id)
    session.arena = None
    return {"reset": session_id}
