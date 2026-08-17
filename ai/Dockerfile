FROM python:3.12-slim AS base

LABEL maintainer="HomeLink-Ethiopia"
LABEL description="HomeLink AI Engine — rent estimation, recommendation, and fraud detection"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
