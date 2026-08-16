from __future__ import annotations

import numpy as np
from sklearn.decomposition import PCA


class LayoutProjector:
    def project(self, X: np.ndarray) -> np.ndarray:
        if X.shape[1] <= 2:
            coords = np.zeros((X.shape[0], 2))
            coords[:, : X.shape[1]] = X
            return coords
        return PCA(n_components=2).fit_transform(X)
