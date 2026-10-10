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
        document["components"]["securitySchemes"] = {
            "DeviceBearer": {"type": "http", "scheme": "bearer", "bearerFormat": "64 lowercase hex characters",
                             "description": "Revocable 32-byte device credential. Required on every authenticated LAN HTTP/WS/Asset request; send in Authorization, never in a URL query."},
            "OwnerCSRF": {"type": "apiKey", "in": "header", "name": "X-Owner-CSRF",
                          "description": "Current process owner token from local GET /pairing/owner. Accepted only on the actual configured local socket. A present browser Origin must match the configured local API/Web allowlist; headerless local CLI calls still require this token."},
        }
        for path, operations in document["paths"].items():
            for method, operation in operations.items():
                if method not in {"get", "head", "post", "put", "patch", "delete", "options"}:
                    continue
                owner = path.startswith("/pairing/") and path != "/pairing/claim"
                anonymous = (path, method) in {("/connection", "get"), ("/pairing/claim", "post")}
                if owner:
                    operation["security"] = [] if method in {"get", "head"} else [{"OwnerCSRF": []}]
                    access = "Only the actual local listener can administer pairing. Device Bearer authorization never grants owner rights."
                    if method not in {"get", "head"}:
                        access += " X-Owner-CSRF is required. If Origin is present it must be an allowed local browser Origin; local CLI calls without Origin are supported."
                    operation["x-listener-access"] = "local-owner"
                elif anonymous:
                    operation["security"] = []
                    access = "Available without a device credential on the known local and LAN listeners; unknown socket bindings are rejected."
                    operation["x-listener-access"] = "anonymous"
                else:
                    operation["security"] = [{"DeviceBearer": []}] if path == "/device" else [{"DeviceBearer": []}, {}]
                    access = "Device Bearer authorization is required on the actual LAN listener. Existing local business consumers may omit it. Authentication runs before route/object lookup and every Asset GET/HEAD/Range request."
                    if path == "/device":
                        access = "Validate the submitted Device Bearer credential on either known listener. A revoked or unknown device is rejected."
                    operation["x-listener-access"] = "lan-device"
                operation["description"] = (operation.get("description", "") + "\n\n" + access).strip()
                if method == "post" and path in {"/projects", "/projects/{project_id}/jobs/generate", "/projects/{project_id}/jobs/{job_id}/retry"}:
                    operation["description"] += " Idempotency-Key must be a UUID for LAN writes and is optional for existing local callers. The same key and validated intent replay the original resource with status 200 before current Runtime readiness/retry checks. A different operation/target/input returns 409. Persist the key and frozen intent before sending; query GET /requests/{request_id} after an uncertain response."
                    operation["x-idempotency-required-on"] = "lan"
        document["x-websockets"] = {str(route): {
            "message": {"$ref": "#/components/schemas/JobEventRead"},
            "security": [{"DeviceBearer": []}, {}],
            "x-listener-access": "lan-device",
            "description": "LAN requires Authorization: Bearer in the handshake headers. Local business consumers remain compatible. Revoking the device closes active sockets with code 4401 without cancelling the Job.",
        }}
        return document
