"""HomeLink AI Engine: core machine-learning modules.

Package layout:
    - rent_estimator: monthly rent prediction in ETB.
    - recommend:      property recommendation for tenants.
    - fraud_detector: listing fraud-risk scoring.
"""

from src.fraud_detector import FraudDetector, FraudReport
from src.recommend import Recommendation, Recommender, rank_properties
from src.rent_estimator import RentEstimator, RentPrediction

__all__ = [
    "FraudDetector",
    "FraudReport",
    "Recommendation",
    "Recommender",
    "RentEstimator",
    "RentPrediction",
    "rank_properties",
]
