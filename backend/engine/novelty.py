"""
Novelty heads — behavioural baselines fitted on benign traffic only.

These live in the engine rather than in the training script because the fitted head is
pickled into ml/artifacts/base_detector.joblib and has to be importable when the API loads
it. A class defined in a training script pickles as `__main__.IsolationHead` and fails at
serve time, which is exactly what happened the first time.

Every head answers one question — "how far is this flow from normal?" — and none of them ever
sees an attack during fitting. That is what makes them able to flag a family nobody has
labelled yet, which is the capability PS#7 asks for and a supervised classifier cannot give.
"""
from __future__ import annotations

import numpy as np
from sklearn.covariance import EmpiricalCovariance
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import QuantileTransformer, StandardScaler

RANDOM_STATE = 42


class IsolationHead:
    """IsolationForest over rank-normalised benign traffic.

    The rank normalisation is the part that matters. CICFlowMeter features span orders of
    magnitude — byte counts, durations, inter-arrival times — and on standardised-but-raw
    features this head reached only 0.27 recall, because a handful of heavy-tailed dimensions
    dominated every distance. Mapping each feature onto its benign quantile first takes the
    head to 0.38 alone and lifts the union from 0.60 to 0.80, almost all of it from PortScan
    (0.04 to 0.52) — a quiet family that was previously buried under those tails.
    """

    name = "isolation_forest_quantile"
    description = ("IsolationForest over benign traffic rank-normalised to a normal "
                   "distribution; score is negative path length")

    def fit(self, benign_raw: np.ndarray) -> "IsolationHead":
        self.transform = QuantileTransformer(output_distribution="normal", n_quantiles=1000,
                                             subsample=200_000,
                                             random_state=RANDOM_STATE).fit(benign_raw)
        self.model = IsolationForest(n_estimators=150, max_samples=8192,
                                     random_state=RANDOM_STATE, n_jobs=-1
                                     ).fit(self.transform.transform(benign_raw))
        return self

    def score(self, X_raw: np.ndarray) -> np.ndarray:
        X_raw = np.asarray(X_raw, dtype=np.float32)
        out = np.empty(len(X_raw), dtype=np.float64)
        for start in range(0, len(X_raw), 100_000):
            chunk = X_raw[start:start + 100_000]
            out[start:start + 100_000] = -self.model.score_samples(self.transform.transform(chunk))
        return out


class MahalanobisHead:
    name = "mahalanobis"
    description = "Distance to the benign mean under the benign covariance (standardised)"

    def fit(self, benign: np.ndarray) -> "MahalanobisHead":
        self.scaler = StandardScaler().fit(benign)
        self.model = EmpiricalCovariance(assume_centered=False).fit(self.scaler.transform(benign))
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        return self.model.mahalanobis(self.scaler.transform(np.asarray(X, dtype=np.float32)))


class KnnHead:
    name = "knn_distance"
    description = "Mean distance to the k nearest benign flows"

    def __init__(self, k: int = 5, reference: int = 20_000):
        self.k, self.reference = k, reference

    def fit(self, benign: np.ndarray) -> "KnnHead":
        rng = np.random.default_rng(RANDOM_STATE)
        self.scaler = StandardScaler().fit(benign)
        scaled = self.scaler.transform(benign)
        sample = scaled[rng.choice(len(scaled), min(self.reference, len(scaled)), replace=False)]
        self.model = NearestNeighbors(n_neighbors=self.k, n_jobs=-1).fit(sample)
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        scaled = self.scaler.transform(np.asarray(X, dtype=np.float32))
        out = np.empty(len(scaled), dtype=np.float64)
        for start in range(0, len(scaled), 50_000):
            out[start:start + 50_000] = self.model.kneighbors(
                scaled[start:start + 50_000])[0].mean(axis=1)
        return out


CANDIDATES = (IsolationHead, MahalanobisHead, KnnHead)
