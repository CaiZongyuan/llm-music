"""Independent CPU process speaks HTTP/WS; no actual model, Torch or GPU work."""

PEER_SOURCE = '''
import asyncio, base64, json, os, socket, sys, threading
from pathlib import Path
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
import uvicorn
from music_api.fake_runtime import ABC, MIDI
from music_api.fake_generation import generation_fixture

app = FastAPI()
native = {}
sockets = {}
frames = []
payloads = {
    "/system_stats": {"system":{"comfyui_version":"0.39.0","python_version":"3.12.13","pytorch_version":"2.10.0+cu130"},
                      "devices":[{"name":"NVIDIA GeForce RTX 3070 Ti Laptop GPU","type":"cuda","index":0,"vram_total":8589934592}]},
    "/object_info": {name:{} for name in ["LoadAudio","YuE2Options","YuE2Transcribe","PreviewAny","YuE2GenerateSong","SaveAudio"]},
    "/models/checkpoints": [], "/models/audio_encoders": [],
}

@app.get("/fixture/state")
def state():
    return {"connected":len(sockets),"accepted":len(native),"frames":len(frames)}

@app.post("/fixture/control")
async def control(request: Request):
    value = await request.json()
    if value["action"] == "complete":
        for item in native.values(): item["complete"] = True
    elif value["action"] == "disconnect":
        for ws in list(sockets.values()): await ws.close(code=1012)
    else:
        frame = base64.b64decode(value["binary"]) if "binary" in value else json.dumps(value["json"])
        frames.append(value)
        for ws in list(sockets.values()):
            if isinstance(frame,bytes): await ws.send_bytes(frame)
            else: await ws.send_text(frame)
    return {"accepted":len(native)}

@app.websocket("/ws")
async def events(ws: WebSocket):
    client = ws.query_params["clientId"]
    await ws.accept()
    sockets[client] = ws
    owned = next(((handle,item) for handle,item in native.items() if item["client"] == client),None)
    if owned:
        handle,item = owned
        await ws.send_json({"type":"execution_start","data":{"prompt_id":handle}})
        await ws.send_json({"type":"executing","data":{"prompt_id":handle,"node":item["core"]}})
    try:
        while True: await ws.receive_text()
    except WebSocketDisconnect: pass
    finally: sockets.pop(client,None)

@app.post("/upload/image")
async def upload(request: Request):
    form = await request.form()
    incoming = form["image"]
    await incoming.read()
    return {"name":incoming.filename,"subfolder":str(form["subfolder"]),"type":"input"}

@app.post("/prompt")
async def submit(request: Request):
    value = await request.json()
    handle = "native-owned-" + str(len(native)+1)
    generate = "2" in value["prompt"]
    native[handle] = {"graph":value["prompt"],"client":value["client_id"],"core":"2" if generate else "transcribe",
                      "generate":generate,"complete":False,"result":generation_fixture() if generate else None}
    return {"prompt_id":handle}

def history(handle,item):
    result = item["result"]
    abc = next(artifact.data.decode() for artifact in result.artifacts if artifact.role == "abc") if result else ABC.decode()
    outputs = {"4" if item["generate"] else "score":{"text":[abc]}}
    if item["generate"]:
        prefix = os.path.normpath(item["graph"]["3"]["inputs"]["filename_prefix"])
        outputs["3"] = {"audio":[{"filename":os.path.basename(prefix)+"_00001.flac","subfolder":os.path.dirname(prefix),"type":"output"}]}
    return {"prompt":[0,handle,item["graph"],{"client_id":item["client"]},[]],"outputs":outputs,
            "status":{"status_str":"success","completed":True,"messages":[]}}

@app.get("/history")
def all_history():
    return {handle:history(handle,item) for handle,item in native.items() if item["complete"]}

@app.get("/history/{handle}")
def result_history(handle):
    return {handle:history(handle,native[handle])} if handle in native and native[handle]["complete"] else {}

@app.get("/queue")
def queue():
    return {"queue_running":[[0,handle,item["graph"],{"client_id":item["client"]},[]] for handle,item in native.items() if not item["complete"]],"queue_pending":[]}

@app.get("/view")
def view(request: Request):
    for handle,item in native.items():
        if not item["generate"]: continue
        descriptor = history(handle,item)["outputs"]["3"]["audio"][0]
        if dict(request.query_params) == descriptor:
            return Response(next(artifact.data for artifact in item["result"].artifacts if artifact.role == "audio"),media_type="audio/flac")
    return Response(status_code=404)

@app.post("/yue2/score/read")
async def read_score(request: Request):
    await request.json()
    return {"sheet":{"cut":False,"seconds":2,"bars":[{}],"notes":{"Vocal":[{"pitch":60,"length":1}]}}}

@app.post("/yue2/score/midi")
async def midi(request: Request):
    await request.json()
    return {"data":base64.b64encode(MIDI).decode()}

@app.post("/yue2/midi/tracks")
async def tracks(request: Request):
    await request.json()
    return {"parts":[{"notes":4}]}

@app.get("/{path:path}")
def get(path):
    return payloads["/"+path]

listener = socket.socket()
listener.bind(("127.0.0.1",0))
listener.listen()
Path(sys.argv[1]).write_text(json.dumps({"pid":os.getpid(),"port":listener.getsockname()[1]}),encoding="utf-8")
server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
def stop():
    sys.stdin.buffer.read(1)
    server.should_exit = True
threading.Thread(target=stop,daemon=True).start()
server.run(sockets=[listener])
'''
