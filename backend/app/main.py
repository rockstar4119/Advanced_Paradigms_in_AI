from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.arena import router as arena_router
from app.api.datasets import router as datasets_router
from app.api.experiments import router as experiments_router
from app.api.explain import router as explain_router
from app.config import settings
from app.ws.graph_ws import router as graph_ws_router
from app.ws.propagate_ws import router as propagate_ws_router


def create_app() -> FastAPI:
    app = FastAPI(title="Propagation Studio API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["system"])
    def root():
        return {
            "name": "Propagation Studio API",
            "version": "0.1.0",
            "status": "healthy",
            "docs": "/docs",
        }

    @app.get("/health", tags=["system"])
    def health_check():
        return {"status": "ok"}

    app.include_router(datasets_router)
    app.include_router(experiments_router)
    app.include_router(explain_router)
    app.include_router(arena_router)
    app.include_router(graph_ws_router)
    app.include_router(propagate_ws_router)

    return app


app = create_app()

if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port)
