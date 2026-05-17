# syntax=docker/dockerfile:1
FROM python:3.12-slim

# Instalar dependencias del sistema (necesarias para Prophet y otros)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Crear usuario no-root
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copiar dependencias primero (caching de capas Docker)
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# Copiar código fuente
COPY app/ ./app/

# Cambiar a usuario no-root
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
