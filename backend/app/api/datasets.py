from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.datasets import DATASET_GENERATORS, BlobsGenerator, CSVDatasetLoader, Dataset, LabelRevealer
from app.core.dimensionality import LayoutProjector
from app.core.state import session_store
from app.schemas import DatasetResponse, GenerateDatasetRequest, NodeOut

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


class DatasetService:
    def __init__(self):
        self.projector = LayoutProjector()
        self.revealer = LabelRevealer()

    def generate(self, request: GenerateDatasetRequest) -> DatasetResponse:
        generator = DATASET_GENERATORS[request.dataset_type]
        kwargs = {}
        if isinstance(generator, BlobsGenerator):
            kwargs["imbalance_ratio"] = request.imbalance_ratio

        dataset = generator.generate(
            n_samples=request.n_samples,
            noise=request.noise,
            seed=request.seed,
            **kwargs,
        )
        return self._build_response(dataset, request.label_fraction, request.seed)

    def upload_csv(self, content: bytes, label_fraction: float, seed: Optional[int]) -> DatasetResponse:
        loader = CSVDatasetLoader()
        dataset = loader.load(content)
        return self._build_response(dataset, label_fraction, seed)

    def _build_response(self, dataset: Dataset, label_fraction: float, seed: Optional[int]) -> DatasetResponse:
        coords = self.projector.project(dataset.X)
        observed = self.revealer.reveal(dataset.y_true, label_fraction, seed)

        session = session_store.create(dataset, coords, observed)

        nodes = [
            NodeOut(
                id=i,
                x=float(coords[i, 0]),
                y=float(coords[i, 1]),
                true_label=int(dataset.y_true[i]),
                observed_label=int(observed[i]) if observed[i] >= 0 else None,
            )
            for i in range(len(dataset.y_true))
        ]
        return DatasetResponse(session_id=session.session_id, nodes=nodes, n_classes=dataset.n_classes)


dataset_service = DatasetService()


@router.post("/generate", response_model=DatasetResponse)
def generate_dataset(request: GenerateDatasetRequest) -> DatasetResponse:
    return dataset_service.generate(request)


@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    label_fraction: float = Form(0.1),
    seed: Optional[int] = Form(None),
) -> DatasetResponse:
    content = await file.read()
    try:
        return dataset_service.upload_csv(content, label_fraction, seed)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{session_id}")
def delete_session(session_id: str) -> dict:
    session_store.delete(session_id)
    return {"deleted": session_id}
