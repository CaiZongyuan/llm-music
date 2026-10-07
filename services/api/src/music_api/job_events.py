"""Bounded live notifications; persisted HTTP state remains the recovery source."""

import asyncio
from contextlib import contextmanager
from dataclasses import dataclass, field
import threading
from collections.abc import Iterator
from uuid import UUID

from music_api.event_schemas import JobEventRead
from music_api.schemas import JobRead


TERMINAL = {"completed", "failed", "cancelled"}
Key = tuple[UUID, UUID]


@dataclass(eq=False)
class JobSubscription:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[JobEventRead | None] = field(default_factory=lambda: asyncio.Queue(maxsize=32))
    closed: bool = False

    def deliver(self, value: JobEventRead | None) -> None:
        def enqueue() -> None:
            if self.closed:
                return
            if self.queue.full():
                self.queue.get_nowait()
            self.queue.put_nowait(value)

        self.loop.call_soon_threadsafe(enqueue)


@dataclass
class JobStream:
    subscribers: set[JobSubscription] = field(default_factory=set)
    latest: JobEventRead | None = None


class JobEventBroker:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.streams: dict[Key, JobStream] = {}

    @contextmanager
    def subscribe(self, project_id: UUID, job_id: UUID) -> Iterator[JobSubscription]:
        key = (project_id, job_id)
        subscription = JobSubscription(asyncio.get_running_loop())
        with self.lock:
            self.streams.setdefault(key, JobStream()).subscribers.add(subscription)
        try:
            yield subscription
        finally:
            with self.lock:
                subscription.closed = True
                stream = self.streams[key]
                stream.subscribers.remove(subscription)
                if not stream.subscribers:
                    del self.streams[key]

    def publish(self, job: JobRead) -> None:
        with self.lock:
            stream = self.streams.get((job.project_id, job.id))
            if stream is None:
                return
            latest = stream.latest
            if latest is not None:
                if job.updated_at < latest.job.updated_at or (latest.job.status in TERMINAL and job.status != latest.job.status):
                    return
                same = job.model_dump(exclude={"updated_at"}) == latest.job.model_dump(exclude={"updated_at"})
                if same:
                    stream.latest = latest.model_copy(update={"job": job.model_copy(deep=True)})
                    return
            value = JobEventRead(sequence=1 if latest is None else latest.sequence + 1, job=job.model_copy(deep=True))
            stream.latest = value
            for subscription in stream.subscribers:
                subscription.deliver(value)

    def snapshot(self, job: JobRead) -> JobEventRead:
        with self.lock:
            # A fresh DB read may be newer than its delayed observer. Publish it to
            # existing listeners before seeding this connection's initial snapshot.
            self.publish(job)
            value = self.streams[(job.project_id, job.id)].latest
            assert value is not None
            return value

    def close(self) -> None:
        with self.lock:
            for stream in self.streams.values():
                for subscription in stream.subscribers:
                    subscription.deliver(None)
