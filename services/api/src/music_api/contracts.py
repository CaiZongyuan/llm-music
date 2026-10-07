"""CPU-only discovery of the HTTP contract and registered Job event payload."""

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.models import Schema

from music_api.event_routes import job_events
from music_api.event_schemas import JobEventRead


class MusicAPI(FastAPI):
    def openapi(self) -> dict[str, Any]:
        document = super().openapi()
        if "x-websockets" in document:
            return document
        schemas = document["components"]["schemas"]
        event_schema = JobEventRead.model_json_schema(mode="serialization", ref_template="#/components/schemas/{model}")
        additions = event_schema.pop("$defs", {})
        additions["JobEventRead"] = event_schema
        for name, raw_schema in additions.items():
            # Use FastAPI's schema serialization policy, including omitted null defaults.
            schema = Schema.model_validate(raw_schema).model_dump(mode="json", by_alias=True, exclude_none=True)
            if name in schemas and schemas[name] != schema:
                self.openapi_schema = None
                raise ValueError(f"WebSocket schema collides with HTTP schema: {name}")
            schemas[name] = schema
        route = self.url_path_for(job_events.__name__, project_id="{project_id}", job_id="{job_id}")
        if route.protocol != "websocket":
            self.openapi_schema = None
            raise ValueError("Job event discovery resolved a non-WebSocket route")
        document["x-websockets"] = {str(route): {"message": {"$ref": "#/components/schemas/JobEventRead"}}}
        return document
