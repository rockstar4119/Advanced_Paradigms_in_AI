from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.core.graph_builder import GraphBuilder, KNNGraphBuilder, RBFGraphBuilder
from app.core.graph_metrics import GraphAnalyzer
from app.core.state import session_store
from app.schemas import GraphBuildParams

router = APIRouter()


class GraphBuildSocket:
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.analyzer = GraphAnalyzer()

    async def handle(self) -> None:
        await self.websocket.accept()
        session = session_store.get(self.session_id)
        if session is None:
            await self.websocket.send_json({"type": "error", "message": "unknown session"})
            await self.websocket.close()
            return

        try:
            raw_params = await self.websocket.receive_json()
            params = GraphBuildParams(**raw_params)
        except (WebSocketDisconnect, ValueError):
            return

        builder = self._make_builder(params)

        for edge in builder.build(session.dataset.X):
            await self.websocket.send_json(
                {
                    "type": "edge_added",
                    "source": edge.source,
                    "target": edge.target,
                    "weight": edge.weight,
                    "step": edge.step,
                }
            )
            await asyncio.sleep(settings.stream_delay_seconds)

        session.graph = builder.adjacency
        session.invalidate_graph_derived()
        stats = self.analyzer.analyze(builder.adjacency)
        await self.websocket.send_json(
            {
                "type": "build_done",
                "edge_count": stats.n_edges,
                "density": stats.density,
                "avg_degree": stats.avg_degree,
                "n_components": stats.n_components,
                "algebraic_connectivity": stats.algebraic_connectivity,
                "mean_edge_weight": stats.mean_edge_weight,
            }
        )
        await self.websocket.close()

    def _make_builder(self, params: GraphBuildParams) -> GraphBuilder:
        if params.method == "knn":
            return KNNGraphBuilder(k=params.k, sigma=params.sigma, mutual=params.mutual)
        return RBFGraphBuilder(sigma=params.sigma, sparsify_threshold=params.sparsify_threshold)


@router.websocket("/ws/graph/{session_id}")
async def graph_ws(websocket: WebSocket, session_id: str) -> None:
    await GraphBuildSocket(websocket, session_id).handle()
