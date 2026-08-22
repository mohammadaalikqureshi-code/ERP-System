"""Shared pagination helpers.

Every list endpoint returns the same envelope, so the frontend's table
component works with any of them without special cases:

    {"items": [...], "total": 137, "page": 2, "pageSize": 20, "totalPages": 7}
"""

import math
from typing import Generic, List, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

T = TypeVar("T")


class PageParams(BaseModel):
    """Query parameters for a paged list. Use with `Depends(page_params)`."""

    page: int = Field(1, ge=1)
    page_size: int = Field(default=settings.DEFAULT_PAGE_SIZE, ge=1)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(
        settings.DEFAULT_PAGE_SIZE,
        ge=1,
        le=settings.MAX_PAGE_SIZE,
        alias="pageSize",
        description="Rows per page",
    ),
) -> PageParams:
    """FastAPI dependency that reads and clamps pagination query parameters."""
    return PageParams(page=page, page_size=min(page_size, settings.MAX_PAGE_SIZE))


class Page(BaseModel, Generic[T]):
    items: List[T] = []
    total: int = 0
    page: int = 1
    page_size: int = Field(settings.DEFAULT_PAGE_SIZE, serialization_alias="pageSize")
    total_pages: int = Field(1, serialization_alias="totalPages")

    model_config = {"populate_by_name": True}

    @classmethod
    def build(cls, items: Sequence[T], total: int, params: PageParams) -> "Page[T]":
        return cls(
            items=list(items),
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=max(1, math.ceil(total / params.page_size)) if total else 1,
        )


async def paginate(db: AsyncSession, statement: Select, params: PageParams) -> tuple[list, int]:
    """Run a query for one page and return `(rows, total)`.

    The count reuses the same filters, so the total always matches the rows.
    """
    count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total = (await db.execute(count_statement)).scalar() or 0

    result = await db.execute(statement.offset(params.offset).limit(params.page_size))
    return list(result.scalars().all()), int(total)
