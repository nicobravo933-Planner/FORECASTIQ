# syntax=docker/dockerfile:1
# Dockerfile — imagen CLOUD (EC2 t3.micro)
# Solo modelos estadísticos: MA, Holt-Winters, SARIMA
# Sin LightGBM, Nixtla, MLflow, Evidently — mantiene la imagen bajo ~400 MB

FROM python:3.12-slim

# Dependencias del sistema mínimas (sin gcc/g++ — no compilamos C extensions pesadas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Solo dependencias principales (sin heavy-ml group)
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

COPY app/ ./app/

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
