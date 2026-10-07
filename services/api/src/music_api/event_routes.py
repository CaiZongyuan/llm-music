"""Scoped live Job snapshots; reconnect begins with fresh persisted state."""

import asyncio
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from music_api.database import Database
from music_api.job_events import JobEventBroker, TERMINAL
from music_api.job_models import Job
from music_api.jobs import job_read


router = APIRouter(tags=["Job events"])


async def wait_disconnect(websocket: WebSocket) -> None:
    while True:
        message = await websocket.receive()
        if message["type"] == "websocket.disconnect":
            return


@router.websocket("/projects/{project_id}/jobs/{job_id}/events")
async def job_events(websocket: WebSocket, project_id: UUID, job_id: UUID) -> None:
    broker: JobEventBroker = websocket.app.state.job_events
    database: Database = websocket.app.state.database
    with broker.subscribe(project_id, job_id) as subscription:
        with database.sessions() as session:
            job = session.scalar(select(Job).where(Job.id == str(job_id), Job.project_id == str(project_id)))
            if job is None:
                await websocket.close(code=4404, reason="Job does not exist in this Project.")
                return
            initial = broker.snapshot(job_read(job))
        await websocket.accept()
        await websocket.send_json(initial.model_dump(mode="json"))
        if initial.job.status in TERMINAL:
            await websocket.close()
            return
        disconnected = asyncio.create_task(wait_disconnect(websocket))
        pending = asyncio.create_task(subscription.queue.get())
        last = initial
        try:
            while True:
                done, _ = await asyncio.wait({disconnected, pending}, return_when=asyncio.FIRST_COMPLETED)
                if disconnected in done:
                    return
                value = pending.result()
                if value is None:
                    await websocket.close(code=1001)
                    return
                if value.job.updated_at >= last.job.updated_at and value.sequence > last.sequence:
                    await websocket.send_json(value.model_dump(mode="json"))
                    last = value
                    if value.job.status in TERMINAL:
                        await websocket.close()
                        return
                pending = asyncio.create_task(subscription.queue.get())
        except WebSocketDisconnect:
            return
        finally:
            for task in (disconnected, pending):
                task.cancel()
            await asyncio.gather(disconnected, pending, return_exceptions=True)
