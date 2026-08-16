from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.label_efficiency import LabelEfficiencyAnalyzer
from app.core.state import session_store

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


class LabelEfficiencyRequest(BaseModel):
    fractions: List[float] = Field(default_factory=lambda: [0.02, 0.05, 0.1, 0.2, 0.35, 0.5])
    seed: Optional[int] = None


class EfficiencyPointOut(BaseModel):
    label_fraction: float
    accuracy: float


class LabelEfficiencyResponse(BaseModel):
    points: List[EfficiencyPointOut]


@router.post("/{session_id}/label-efficiency", response_model=LabelEfficiencyResponse)
def run_label_efficiency(session_id: str, request: LabelEfficiencyRequest) -> LabelEfficiencyResponse:
    session = session_store.get(session_id)
    if session is None or session.graph is None:
        raise HTTPException(status_code=400, detail="Build a graph before running this experiment")

    analyzer = LabelEfficiencyAnalyzer()
    points = analyzer.sweep(session, request.fractions, request.seed)
    return LabelEfficiencyResponse(
        points=[EfficiencyPointOut(label_fraction=p.label_fraction, accuracy=p.accuracy) for p in points]
    )
