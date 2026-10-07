"""Failure evidence for owned CPU recovery fixtures, never production directories."""
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3


def timeout_packet(context, route, last_http):
    data, root, ready = context
    data, root = data.resolve(), root.resolve()
    if not data.is_relative_to(root):
        raise ValueError("Recovery evidence must stay inside its owned fixture directory")
    packet = {"at":datetime.now(timezone.utc).isoformat(),"route":route,"last_http":last_http,
              "owned_data":str(data),"api_ready":str(ready),"durable_job":None,"markers":{},"io":[]}
    identifier = route.rsplit("/",1)[-1]
    try:
        with sqlite3.connect(data.joinpath("app.sqlite").as_uri()+"?mode=ro",uri=True,timeout=1) as database:
            database.row_factory = sqlite3.Row
            row = database.execute("SELECT id,status,inputs,provenance,runtime_proof,recovery_cursor,result_refs,error,updated_at FROM jobs WHERE id=?",(identifier,)).fetchone()
            if row is not None:
                packet["durable_job"] = dict(row)
                for key in ["inputs","provenance","runtime_proof","recovery_cursor","result_refs","error"]:
                    packet["durable_job"][key] = json.loads(row[key]) if row[key] else None
    except sqlite3.Error as error:
        packet["database_read_error"] = str(error)
    for path in root.glob("*.jsonl"):
        packet["io"].append({"source":path.name,"records":path.read_text(encoding="utf-8").splitlines()})
    for pattern in ["*.fault","*.readback-fault","*.cursor-fault","*.cursor-readback-fault","*.startup-delay.json","*.admission-cursor.json"]:
        for path in root.glob(pattern):
            packet["markers"][path.name] = path.read_text(encoding="utf-8")
    output = root / ("timeout-"+identifier+".json")
    output.write_text(json.dumps(packet,indent=2)+"\n",encoding="utf-8")
    return output
