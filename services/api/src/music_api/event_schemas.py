"""Domain snapshots contain the same durable application Job returned by HTTP."""

from typing import Literal

from pydantic import BaseModel, Field

from music_api.schemas import JobRead


class JobEventRead(BaseModel):
    type: Literal["job.updated"] = "job.updated"
    sequence: int = Field(ge=0)
    job: JobRead
