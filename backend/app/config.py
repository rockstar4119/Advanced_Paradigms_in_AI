import os
from dataclasses import dataclass


def _parse_cors_origins() -> tuple[str, ...]:
    env_origins = os.getenv("CORS_ORIGINS")
    if env_origins:
        return tuple(origin.strip() for origin in env_origins.split(",") if origin.strip())
    return (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    )


@dataclass(frozen=True)
class Settings:
    cors_origins: tuple[str, ...] = _parse_cors_origins()
    cors_origin_regex: str = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app"
    )
    max_dataset_size: int = int(os.getenv("MAX_DATASET_SIZE", "500"))
    default_k: int = int(os.getenv("DEFAULT_K", "6"))
    default_sigma: float = float(os.getenv("DEFAULT_SIGMA", "1.0"))
    default_max_iter: int = int(os.getenv("DEFAULT_MAX_ITER", "200"))
    default_tol: float = float(os.getenv("DEFAULT_TOL", "1e-4"))
    session_ttl_seconds: int = int(os.getenv("SESSION_TTL_SECONDS", "3600"))
    stream_delay_seconds: float = float(os.getenv("STREAM_DELAY_SECONDS", "0.01"))


settings = Settings()

