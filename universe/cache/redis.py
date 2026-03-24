"""
Redis client, cache helpers, and distributed lock primitives for the Universe service.
"""
import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis

from shared.config import get_settings
from shared.logging_config import get_logger

log = get_logger(__name__)
settings = get_settings()

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=50,
        )
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


# ── Cache helpers ──────────────────────────────────────────────────────────────

async def cache_get(key: str) -> Any | None:
    r = get_redis()
    value = await r.get(key)
    if value is None:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


async def cache_set(key: str, value: Any, ttl: int) -> None:
    r = get_redis()
    await r.set(key, json.dumps(value, default=str), ex=ttl)


async def cache_delete(key: str) -> None:
    r = get_redis()
    await r.unlink(key)  # async non-blocking delete


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern."""
    r = get_redis()
    cursor = 0
    while True:
        cursor, keys = await r.scan(cursor, match=pattern, count=100)
        if keys:
            await r.unlink(*keys)
        if cursor == 0:
            break


# ── Node cache helpers ─────────────────────────────────────────────────────────

def _node_key(node_id: str) -> str:
    return f"node:{node_id}"


def _neighbors_key(node_id: str) -> str:
    return f"neighbors:{node_id}"


def _search_key(query: str, mode: str, limit: int) -> str:
    import hashlib
    h = hashlib.md5(f"{query}:{mode}:{limit}".encode()).hexdigest()[:12]
    return f"search:{h}"


async def get_cached_node(node_id: str) -> dict | None:
    return await cache_get(_node_key(node_id))


async def set_cached_node(node_id: str, data: dict) -> None:
    await cache_set(_node_key(node_id), data, settings.cache_ttl_node)


async def invalidate_node_cache(node_id: str) -> None:
    await cache_delete(_node_key(node_id))
    await cache_delete(_neighbors_key(node_id))
    log.debug("cache_invalidated", node_id=node_id)


async def get_cached_search(query: str, mode: str, limit: int) -> list | None:
    return await cache_get(_search_key(query, mode, limit))


async def set_cached_search(query: str, mode: str, limit: int, data: list) -> None:
    await cache_set(_search_key(query, mode, limit), data, settings.cache_ttl_search)


# ── Distributed Lock ──────────────────────────────────────────────────────────

class RedisLock:
    """
    Simple Redis distributed lock using SET NX PX with heartbeat renewal.
    Usage:
        async with RedisLock("lock:source:http://...", ttl=300) as acquired:
            if acquired:
                ...
    """

    def __init__(self, key: str, ttl: int, retry_count: int = 3, retry_delay: float = 0.5):
        self._key = key
        self._ttl = ttl
        self._retry_count = retry_count
        self._retry_delay = retry_delay
        self._token: str | None = None
        self._heartbeat_task: asyncio.Task | None = None

    async def acquire(self) -> bool:
        import secrets
        r = get_redis()
        self._token = secrets.token_hex(16)
        for attempt in range(self._retry_count):
            ok = await r.set(self._key, self._token, nx=True, ex=self._ttl)
            if ok:
                self._heartbeat_task = asyncio.create_task(self._heartbeat())
                log.debug("lock_acquired", key=self._key)
                return True
            if attempt < self._retry_count - 1:
                await asyncio.sleep(self._retry_delay * (2 ** attempt))
        log.warning("lock_not_acquired", key=self._key)
        return False

    async def release(self) -> None:
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._token is None:
            return
        r = get_redis()
        # Lua script: only release if we own the lock
        lua = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        end
        return 0
        """
        await r.eval(lua, 1, self._key, self._token)
        log.debug("lock_released", key=self._key)

    async def _heartbeat(self) -> None:
        """Renew lock TTL at half-life intervals."""
        interval = self._ttl / 2
        r = get_redis()
        try:
            while True:
                await asyncio.sleep(interval)
                await r.expire(self._key, self._ttl)
        except asyncio.CancelledError:
            pass

    async def __aenter__(self) -> bool:
        return await self.acquire()

    async def __aexit__(self, *_) -> None:
        await self.release()


def source_lock(canonical_url: str) -> RedisLock:
    return RedisLock(f"lock:source:{canonical_url}", ttl=settings.lock_ttl_source)


def node_merge_lock(node_id: str) -> RedisLock:
    return RedisLock(f"lock:node_merge:{node_id}", ttl=settings.lock_ttl_node_merge)


def expansion_lock(parent_node_id: str) -> RedisLock:
    return RedisLock(f"lock:expansion:{parent_node_id}", ttl=settings.lock_ttl_expansion)
