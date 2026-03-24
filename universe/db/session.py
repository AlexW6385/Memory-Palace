"""
Async SQLAlchemy engine and session factory.
Uses connection pooling for both online query path and background write path.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from shared.config import get_settings

settings = get_settings()

# Online (read-heavy) engine — lower pool size, lower timeout
_online_engine: AsyncEngine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=settings.environment == "development",
)

# Background (write-heavy) engine — higher pool size
_write_engine: AsyncEngine = create_async_engine(
    settings.database_url,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    bind=_online_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

AsyncWriteSessionLocal = async_sessionmaker(
    bind=_write_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for online (read) path sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def get_write_session() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for background integration / write path sessions."""
    async with AsyncWriteSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def dispose_engines() -> None:
    """Called on app shutdown."""
    await _online_engine.dispose()
    await _write_engine.dispose()
