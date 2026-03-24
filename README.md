# Agent-assisted Knowledge Universe

A modular, event-driven knowledge system that ingests external human-authored content, understands it semantically via LLM, and weaves it into a searchable, explorable, and continuously expanding Knowledge Graph.

This project is divided into two fully decoupled microservices:
1. **Knowledge Universe System (Core A)** - The central brain, graph store, vector search engine, and real-time event broadcaster.
2. **Agent Ingestion & Integration System (Core B)** - The worker layer that scrapes, parses, understands (via LLM), and automatically integrates content into the Universe.

## Key Concurrency & Reliability Features

This system handles asynchronous ingestion at high scale with 6 concurrency guarantees:

1. **High-Throughput Pool**: Explicit per-skill concurrency limits via `asyncio.Semaphore` (e.g. max 10 Wikipedia concurrent fetches).
2. **Idempotency & Concurrent Writes**: `canonical_url` unique DB constraints, SHA-256 source checksums, and Arq `idempotency_key` prevent duplicate ingestion even if workers race.
3. **Database Consistency**: Optimistic locking (`version` column) on node updates, and atomic transaction encapsulation for the `Integration` pipeline step.
4. **Distributed Resource Locks**: Redis `SET NX PX` locks with heartbeat renewal guard source-fetching, node-merging, and graph expansion fan-outs.
5. **Read/Write Separation**: Online queries (`/nodes`, `/search`) run against a Fast Redis cache and read-pool. Background Kafka/Redis-Streams ingestion runs on a separate heavy write-pool.
6. **Failure Recovery**: Dead-letter queues (DLQ), exponential backoff retries, and `last_completed_step` checkpoints per task.

## Architecture

![Architecture](https://via.placeholder.com/800x400?text=Agent-assisted+Knowledge+Universe+Architecture)

The two services communicate strictly via:
- **Shared PostgreSQL/pgvector**
- **Redis Streams (Event Bus)**

## Getting Started

### 1. Requirements
- Docker and Docker Compose
- OpenAI API Key (for LLM understanding and `pgvector` embeddings)

### 2. Setup
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 3. Launch the Stack
```bash
docker compose up -d --build
```
This spins up:
- PostgreSQL (with `pgvector`)
- Redis (cache, locks, streams, worker queue)
- Universe API (port 8000)
- Agent API (port 8001)
- Agent Worker Pool (Arq)
- Nginx Reverse Proxy (port 80)

### 4. Endpoints via Nginx (localhost:80)

**Universe (Core A)**
- `GET /nodes` - List nodes
- `GET /search?q=graph&mode=hybrid` - Full-text + Semantic search
- `GET /graph/{id}/neighbors` - View a node's neighborhood
- `WS /ws` - WebSocket for real-time node/edge creation events

**Agent (Core B)**
- `POST /tasks/ingest` - Submit a new URL for ingestion
- `GET /tasks/{id}` - Check ingestion pipeline status
- `POST /tasks/explore` - Trigger directed agent exploration

## The 6-Step Knowledge Integration Pipeline

When you submit a URL to `/tasks/ingest`, the Agent Worker executes a strict 6-step idempotent pipeline:

1. **Acquisition**: Finds the correct Skill (`web`, `wiki`, `arxiv`, `pdf`) to download raw content.
2. **Normalization**: Canonicalizes URLs, deduplicates links, limits blocks.
3. **Understanding**: Uses Rule-based + LLM tiers to extract taxonomy, summary, and entities.
4. **Placement**: Vector-searches the Universe for near-duplicates. LLM decides whether to MERGE or CREATE new edges.
5. **Integration**: Atomically writes Nodes and Edges to PostgreSQL.
6. **Expansion**: Reactive fan-out to linked URLs based on the user-defined `depth` limit.

## Adding a New Skill

Create a new file in `agent/skills/` inheriting from `BaseSkill`.
Implement the 3-layer abstraction: `connect()`, `extract()`, and `map_to_schema()`.
Register it in `agent/skills/registry.py` with an explicit concurrency limit.
