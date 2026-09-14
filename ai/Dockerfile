# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — install dependencies into a clean layer
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# System deps needed to compile XGBoost / scikit-learn C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies first (maximise layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime — lean image with only what's needed to serve
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="HomeLink-Ethiopia"
LABEL description="HomeLink AI Engine — rent estimation, recommendation, and fraud detection"
LABEL version="1.1.0"

# libgomp1 is required at runtime by XGBoost
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source code
COPY main.py .
COPY src/ ./src/
COPY models/ ./models/
COPY data/ ./data/
COPY openapi.json .

# Create a non-root user for security
RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Healthcheck: verify the service responds within 10s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
