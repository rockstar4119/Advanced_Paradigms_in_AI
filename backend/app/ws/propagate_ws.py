from __future__ import annotations

import asyncio
from typing import Optional

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.core.label_propagation.harmonic import HarmonicPropagator
from app.core.label_propagation.mincut import (
    AugmentPathStep,
    ClassPhaseStep,
    FinalAssignmentStep,
    GraphMincutClassifier,
    MincutFoundStep,
    MincutStep,
    OneVsRestMincut,
)
from app.core.metrics import EvaluationResult, MetricsCalculator
from app.core.state import SessionState, session_store
from app.schemas import PropagationRunParams

router = APIRouter()


def _hard_metrics(result: EvaluationResult) -> dict:
    """The argmax-only scores, shared by both algorithms."""
    return {
        "accuracy": result.accuracy,
        "balanced_accuracy": result.balanced_accuracy,
        "macro_precision": result.macro_precision,
        "macro_recall": result.macro_recall,
        "macro_f1": result.macro_f1,
        "weighted_f1": result.weighted_f1,
        "cohen_kappa": result.cohen_kappa,
        "matthews_corrcoef": result.matthews_corrcoef,
        "n_evaluated": result.n_evaluated,
        "confusion_matrix": result.confusion_matrix,
        "per_class": [vars(m) for m in result.per_class],
    }


class PropagationSocket:
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.metrics = MetricsCalculator()

    async def handle(self) -> None:
        await self.websocket.accept()
        session = session_store.get(self.session_id)
        if session is None or session.graph is None:
            await self.websocket.send_json({"type": "error", "message": "graph not built"})
            await self.websocket.close()
            return

        try:
            raw_params = await self.websocket.receive_json()
            params = PropagationRunParams(**raw_params)
        except (WebSocketDisconnect, ValueError):
            return

        if params.algorithm == "harmonic":
            await self._run_harmonic(session, params)
        else:
            await self._run_mincut(session, params)

        await self.websocket.close()

    async def _run_harmonic(self, session: SessionState, params: PropagationRunParams) -> None:
        propagator = HarmonicPropagator(session.graph, max_iter=params.max_iter, tol=params.tol)
        y_pred = None
        soft_labels = None
        energy_trace = []

        for step in propagator.run(session.observed_labels, session.dataset.n_classes):
            y_pred = np.argmax(step.soft_labels, axis=1)
            soft_labels = step.soft_labels
            energy_trace.append(step.energy)
            await self.websocket.send_json(
                {
                    "type": "iteration",
                    "t": step.t,
                    "soft_labels": step.soft_labels.tolist(),
                    "energy": step.energy,
                }
            )
            await asyncio.sleep(settings.stream_delay_seconds)

        unlabeled_mask = session.observed_labels < 0
        result = self.metrics.evaluate(session.dataset.y_true, y_pred, unlabeled_mask)
        posterior = self.metrics.probabilistic(
            soft_labels, session.dataset.y_true, unlabeled_mask, result.accuracy
        )

        session.last_algorithm = "harmonic"
        session.last_soft_labels = soft_labels
        session.last_predictions = y_pred

        payload = {
            "type": "done",
            "labels": {int(i): int(y_pred[i]) for i in range(len(y_pred))},
            "energy_trace": energy_trace,
            **_hard_metrics(result),
        }
        if posterior is not None:
            payload.update(vars(posterior))

        await self.websocket.send_json(payload)

    async def _run_mincut(self, session: SessionState, params: PropagationRunParams) -> None:
        n_classes = session.dataset.n_classes
        y_pred = np.array(session.observed_labels, copy=True)

        if n_classes <= 2:
            source_nodes = [int(x) for x in np.where(session.observed_labels == params.source_class)[0]]
            sink_nodes = [int(x) for x in np.where(session.observed_labels == params.sink_class)[0]]
            classifier = GraphMincutClassifier(session.graph)
            for step in classifier.run(source_nodes, sink_nodes):
                await self._send_binary_step(step)
                if isinstance(step, MincutFoundStep):
                    y_pred[step.side_source] = params.source_class
                    y_pred[step.side_sink] = params.sink_class
        else:
            wrapper = OneVsRestMincut(session.graph)
            for item in wrapper.run(session.observed_labels, n_classes):
                if isinstance(item, ClassPhaseStep):
                    await self._send_binary_step(item.step, class_index=item.class_index)
                elif isinstance(item, FinalAssignmentStep):
                    for node, label in item.labels.items():
                        y_pred[node] = label

        unlabeled_mask = session.observed_labels < 0
        result = self.metrics.evaluate(session.dataset.y_true, y_pred, unlabeled_mask)

        # Mincut returns a hard partition, so there are no soft labels to store.
        session.last_algorithm = "mincut"
        session.last_soft_labels = None
        session.last_predictions = y_pred

        await self.websocket.send_json(
            {
                "type": "done",
                "labels": {int(i): int(y_pred[i]) for i in range(len(y_pred))},
                **_hard_metrics(result),
            }
        )

    async def _send_binary_step(self, step: MincutStep, class_index: Optional[int] = None) -> None:
        if isinstance(step, AugmentPathStep):
            payload = {
                "type": "augment_path",
                "path": step.path,
                "flow_added": step.flow_added,
                "total_flow": step.total_flow,
            }
        else:
            payload = {
                "type": "mincut_found",
                "cut_edges": step.cut_edges,
                "side_s": step.side_source,
                "side_t": step.side_sink,
            }
        if class_index is not None:
            payload["class_index"] = class_index
        await self.websocket.send_json(payload)
        await asyncio.sleep(settings.stream_delay_seconds)


@router.websocket("/ws/propagate/{session_id}")
async def propagate_ws(websocket: WebSocket, session_id: str) -> None:
    await PropagationSocket(websocket, session_id).handle()
