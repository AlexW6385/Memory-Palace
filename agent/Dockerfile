FROM python:3.12-slim

WORKDIR /app

# System deps
# pymupdf (fitz) needs some system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc curl && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install poetry==1.8.3 && poetry config virtualenvs.create false

# Copy dependency files
COPY agent/pyproject.toml ./pyproject.toml
RUN poetry install --no-dev --no-interaction

# Copy shared package first (dependency of agent)
COPY shared/ /app/shared/

# Copy service code
COPY agent/ /app/agent/
# Also need Universe models for DB inserts (Integration step)
COPY universe/db/ /app/universe/db/
COPY universe/services/ /app/universe/services/
COPY universe/search/ /app/universe/search/
COPY universe/cache/ /app/universe/cache/

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "agent.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
