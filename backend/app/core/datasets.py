from __future__ import annotations

import io
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Tuple

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


class PatientZeroGenerator(DatasetGenerator):
    """An outbreak, not a decision boundary.

    Every other generator here draws a shape and colours the two sides of it,
    so the label is a *function of position* and any classifier that can bend a
    line will find it. This one refuses to do that. People are scattered across
    a 2-D "lifestyle space" of a few communities, a contact network is laid on
    top of them (mostly nearest-neighbour contacts, plus a handful of long-haul
    flights that stitch distant communities together), and then a stochastic
    SIR-style cascade is run from a single index case. Who ends up infected is
    decided by *reachability through the contact network*, not by where they
    stand.

    That is the whole point. The studio builds its graph from geometry, so it
    recovers the local contacts but is blind to the flights — which leaves a
    seeded community across the map that no distance-based method can explain.
    Propagation still wins big on the bulk of the outbreak and then fails in a
    small, structured, *diagnosable* way: exactly the regime the interpretability
    panels (unreachable nodes, confident errors, local homophily) exist to
    expose. Turn the noise up and the communities bleed into each other; the
    flights are what stay stubbornly unlearnable.
    """

    N_COMMUNITIES = 4
    CONTACTS_PER_PERSON = 5
    #: Communities sit close enough on the ring that a k≈6 graph bridges them.
    #: At 2.6 the gaps were wider than the 6th-nearest neighbour two thirds of
    #: the time, so the graph arrived pre-split into four components and every
    #: algorithm "solved" it by never having to carry a label across a gap.
    RING_RADIUS = 1.9
    #: Attack rates outside this band make a boring picture (nothing spread /
    #: everything burned), so transmissibility is re-tuned until one lands here.
    TARGET_ATTACK_RATE = (0.25, 0.6)
    BETA_LADDER = (0.3, 0.45, 0.6, 0.75, 0.9)
    #: A cascade can fizzle by bad luck even at a workable beta, so the whole
    #: ladder is re-rolled a few times before settling for the closest miss.
    RESAMPLE_ATTEMPTS = 3
    #: Contacts transmit over a kernel a little wider than the median contact,
    #: which keeps R0 above 1 instead of stalling inside the first community.
    TRANSMISSION_SCALE = 1.3

    def generate(self, n_samples: int, noise: float, seed: Optional[int], **kwargs) -> Dataset:
        rng = np.random.default_rng(seed)
        X, community = self._social_space(rng, n_samples, noise)
        contacts = self._contact_network(rng, X, community)
        infected = self._run_outbreak(rng, contacts, X)
        return Dataset(X=X, y_true=infected.astype(int), n_classes=2)

    def _social_space(self, rng: np.random.Generator, n_samples: int, noise: float):
        """Communities on a ring — far enough apart that a flight between two of
        them is unmistakably a long-range jump in the projection."""
        angles = np.linspace(0.0, 2 * np.pi, self.N_COMMUNITIES, endpoint=False)
        centers = np.stack([self.RING_RADIUS * np.cos(angles), self.RING_RADIUS * np.sin(angles)], axis=1)

        community = rng.integers(0, self.N_COMMUNITIES, size=n_samples)
        spread = 0.5 + noise * 1.3
        X = centers[community] + rng.normal(scale=spread, size=(n_samples, 2))
        return X, community

    def _contact_network(
        self, rng: np.random.Generator, X: np.ndarray, community: np.ndarray
    ) -> List[List[Tuple[int, float]]]:
        """Each edge carries an *effective* contact distance, which is what the
        cascade transmits over. Flights are stored at close-contact distance:
        sharing a cabin is intimate no matter how far the cities are apart."""
        n = len(X)
        k = min(self.CONTACTS_PER_PERSON, n - 1)
        distances = np.linalg.norm(X[:, None, :] - X[None, :, :], axis=2)
        np.fill_diagonal(distances, np.inf)

        contacts: List[List[Tuple[int, float]]] = [[] for _ in range(n)]
        for i in range(n):
            for j in np.argsort(distances[i])[:k]:
                self._link(contacts, i, int(j), float(distances[i, int(j)]))

        typical = self._typical_contact_distance(distances, k)
        for _ in range(max(2, n // 70)):
            i = int(rng.integers(0, n))
            candidates = np.where(community != community[i])[0]
            if len(candidates) == 0:
                continue
            j = int(rng.choice(candidates))
            self._link(contacts, i, j, typical)

        return contacts

    def _run_outbreak(
        self, rng: np.random.Generator, contacts: List[List[Tuple[int, float]]], X: np.ndarray
    ) -> np.ndarray:
        index_case = self._index_case(contacts)
        tau = self._transmission_scale(X, contacts)

        best: Optional[np.ndarray] = None
        best_distance = np.inf
        low, high = self.TARGET_ATTACK_RATE
        midpoint = (low + high) / 2

        for _ in range(self.RESAMPLE_ATTEMPTS):
            for beta in self.BETA_LADDER:
                infected = self._cascade(rng, contacts, index_case, tau, beta)
                rate = float(infected.mean())
                if low <= rate <= high:
                    return self._ensure_both_classes(infected, index_case)
                if abs(rate - midpoint) < best_distance:
                    best_distance = abs(rate - midpoint)
                    best = infected

        return self._ensure_both_classes(best, index_case)

    def _cascade(
        self,
        rng: np.random.Generator,
        contacts: List[List[Tuple[int, float]]],
        index_case: int,
        tau: float,
        beta: float,
    ) -> np.ndarray:
        """Generation-by-generation spread. A contact at distance d transmits
        with probability ``beta * exp(-d^2 / 2 tau^2)`` — the same Gaussian
        kernel the graph builder uses for edge weights, which is why the
        geometry-built graph is a *good but incomplete* model of the truth."""
        infected = np.zeros(len(contacts), dtype=bool)
        infected[index_case] = True
        frontier = [index_case]

        while frontier:
            next_frontier = []
            for source in frontier:
                for target, distance in contacts[source]:
                    if infected[target]:
                        continue
                    probability = beta * np.exp(-(distance ** 2) / (2 * tau ** 2))
                    if rng.random() < probability:
                        infected[target] = True
                        next_frontier.append(target)
            frontier = next_frontier

        return infected

    def _index_case(self, contacts: List[List[Tuple[int, float]]]) -> int:
        """Patient zero is the best-connected person in the network — outbreaks
        that start on a hub are the ones worth simulating."""
        return int(np.argmax([len(c) for c in contacts]))

    def _transmission_scale(self, X: np.ndarray, contacts: List[List[Tuple[int, float]]]) -> float:
        lengths = [d for neighbours in contacts for _, d in neighbours]
        median = float(np.median(lengths)) if lengths else 1.0
        return median * self.TRANSMISSION_SCALE

    def _typical_contact_distance(self, distances: np.ndarray, k: int) -> float:
        nearest = np.sort(distances, axis=1)[:, :k]
        return float(np.median(nearest))

    def _ensure_both_classes(self, infected: Optional[np.ndarray], index_case: int) -> np.ndarray:
        """A degenerate cascade would leave a single-class dataset, which the
        label revealer and every downstream metric would rightly choke on."""
        if infected is None:
            raise ValueError("outbreak simulation produced no result")

        n_infected = int(infected.sum())
        if n_infected == 0:
            infected[index_case] = True
            n_infected = 1
        if n_infected == len(infected):
            infected[(index_case + len(infected) // 2) % len(infected)] = False

        return infected

    @staticmethod
    def _link(contacts: List[List[Tuple[int, float]]], i: int, j: int, distance: float) -> None:
        if i == j or any(target == j for target, _ in contacts[i]):
            return
        contacts[i].append((j, distance))
        contacts[j].append((i, distance))


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
    "patient_zero": PatientZeroGenerator(),
}
