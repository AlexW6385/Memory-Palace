FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc curl && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install poetry==1.8.3 && poetry config virtualenvs.create false

# Copy dependency files
COPY universe/pyproject.toml ./pyproject.toml
RUN poetry install --no-dev --no-interaction

# Copy shared package first (dependency of universe)
COPY shared/ /app/shared/

# Copy service code
COPY universe/ /app/universe/

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "universe.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
