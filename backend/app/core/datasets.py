from __future__ import annotations

import io
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.datasets import make_circles, make_moons


@dataclass
class Dataset:
    X: np.ndarray
    y_true: np.ndarray
    n_classes: int


class DatasetGenerator(ABC):
    @abstractmethod
    def generate(self, n_samples: int, noise: float, seed: Optional[int], **kwargs) -> Dataset:
        raise NotImplementedError


class TwoMoonsGenerator(DatasetGenerator):
    def generate(self, n_samples: int, noise: float, seed: Optional[int], **kwargs) -> Dataset:
        X, y = make_moons(n_samples=n_samples, noise=noise, random_state=seed)
        return Dataset(X=X, y_true=y, n_classes=2)


class CirclesGenerator(DatasetGenerator):
    def generate(self, n_samples: int, noise: float, seed: Optional[int], **kwargs) -> Dataset:
        X, y = make_circles(n_samples=n_samples, noise=noise, factor=0.5, random_state=seed)
        return Dataset(X=X, y_true=y, n_classes=2)


class BlobsGenerator(DatasetGenerator):
    def generate(
        self,
        n_samples: int,
        noise: float,
        seed: Optional[int],
        imbalance_ratio: float = 0.5,
        **kwargs,
    ) -> Dataset:
        rng = np.random.default_rng(seed)
        n_a = max(5, int(n_samples * imbalance_ratio))
        n_b = max(5, n_samples - n_a)
        centers = np.array([[-2.0, 0.0], [2.0, 0.5]])
        std = 0.6 + noise * 1.5
        cluster_a = centers[0] + rng.normal(scale=std, size=(n_a, 2))
        cluster_b = centers[1] + rng.normal(scale=std, size=(n_b, 2))
        X = np.vstack([cluster_a, cluster_b])
        y = np.array([0] * n_a + [1] * n_b)
        return Dataset(X=X, y_true=y, n_classes=2)


class CSVDatasetLoader:
    def load(self, content: bytes, label_column: Optional[str] = None) -> Dataset:
        df = pd.read_csv(io.BytesIO(content))
        if label_column and label_column in df.columns:
            y_raw = df[label_column]
            feature_df = df.drop(columns=[label_column])
        else:
            y_raw = df.iloc[:, -1]
            feature_df = df.iloc[:, :-1]

        X = feature_df.select_dtypes(include=[np.number]).to_numpy(dtype=float)
        if X.shape[1] == 0:
            raise ValueError("CSV has no numeric feature columns")

        _, y = np.unique(y_raw.to_numpy(), return_inverse=True)
        n_classes = int(y.max()) + 1
        return Dataset(X=X, y_true=y, n_classes=n_classes)


class LabelRevealer:
    def reveal(self, y_true: np.ndarray, label_fraction: float, seed: Optional[int]) -> np.ndarray:
        rng = np.random.default_rng(seed)
        n = len(y_true)
        n_classes = int(y_true.max()) + 1
        observed = np.full(n, -1, dtype=int)

        for cls in range(n_classes):
            cls_indices = np.where(y_true == cls)[0]
            n_reveal = max(1, int(round(len(cls_indices) * label_fraction)))
            n_reveal = min(n_reveal, len(cls_indices))
            chosen = rng.choice(cls_indices, size=n_reveal, replace=False)
            observed[chosen] = y_true[chosen]

        return observed


DATASET_GENERATORS: dict[str, DatasetGenerator] = {
    "two_moons": TwoMoonsGenerator(),
    "circles": CirclesGenerator(),
    "blobs": BlobsGenerator(),
}
