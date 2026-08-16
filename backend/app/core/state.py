from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional

import numpy as np

from app.core.datasets import Dataset


@dataclass
class SessionState:
    session_id: str
    dataset: Dataset
    coords: np.ndarray
    observed_labels: np.ndarray
    graph: Optional[np.ndarray] = None
    created_at: float = field(default_factory=time.time)

    # Last finished propagation run, kept so the interpretability endpoints can
    # explain what the user actually watched rather than re-running it.
    last_algorithm: Optional[str] = None
    last_soft_labels: Optional[np.ndarray] = None
    last_predictions: Optional[np.ndarray] = None

    # Cached O(n^3) absorption solve, and the active-learning arena.
    influence: Optional[object] = None
    arena: Optional[object] = None

    def invalidate_graph_derived(self) -> None:
        """Called when the graph is rebuilt — every cached result is now stale."""
        self.last_algorithm = None
        self.last_soft_labels = None
        self.last_predictions = None
        self.influence = None
        self.arena = None


class SessionStore:
    def __init__(self, ttl_seconds: int = 3600):
        self._sessions: Dict[str, SessionState] = {}
        self.ttl_seconds = ttl_seconds

    def create(self, dataset: Dataset, coords: np.ndarray, observed_labels: np.ndarray) -> SessionState:
        session_id = str(uuid.uuid4())
        session = SessionState(
            session_id=session_id,
            dataset=dataset,
            coords=coords,
            observed_labels=observed_labels,
        )
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Optional[SessionState]:
        self._evict_expired()
        return self._sessions.get(session_id)

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def _evict_expired(self) -> None:
        now = time.time()
        expired = [
            sid for sid, session in self._sessions.items()
            if now - session.created_at > self.ttl_seconds
        ]
        for sid in expired:
            self._sessions.pop(sid, None)


session_store = SessionStore()
