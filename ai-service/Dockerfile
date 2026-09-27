# HomeLink AI Service — rent estimation, matching, fraud detection
# FastAPI implementing the same models as the backend's heuristic fallback
# (Sprint 1/6 architecture: standalone AI microservice).
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN addgroup --system homelink && adduser --system --ingroup homelink homelink
USER homelink

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD wget -qO- http://localhost:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
