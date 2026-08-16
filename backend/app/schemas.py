from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class GenerateDatasetRequest(BaseModel):
    dataset_type: Literal["two_moons", "circles", "blobs", "patient_zero"]
    n_samples: int = Field(default=200, ge=20, le=500)
    noise: float = Field(default=0.1, ge=0.0, le=1.0)
    imbalance_ratio: float = Field(default=0.5, ge=0.05, le=0.95)
    label_fraction: float = Field(default=0.1, ge=0.01, le=1.0)
    seed: Optional[int] = None


class NodeOut(BaseModel):
    id: int
    x: float
    y: float
    true_label: int
    observed_label: Optional[int]


class DatasetResponse(BaseModel):
    session_id: str
    nodes: List[NodeOut]
    n_classes: int


class GraphBuildParams(BaseModel):
    method: Literal["knn", "rbf"]
    k: int = Field(default=6, ge=1, le=50)
    sigma: float = Field(default=1.0, gt=0.0)
    mutual: bool = False
    sparsify_threshold: float = Field(default=0.0, ge=0.0, le=1.0)


class PropagationRunParams(BaseModel):
    algorithm: Literal["harmonic", "mincut"]
    max_iter: int = Field(default=200, ge=1, le=2000)
    tol: float = Field(default=1e-4, gt=0.0)
    source_class: int = 0
    sink_class: int = 1
