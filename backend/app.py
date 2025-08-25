from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import subprocess
import os
import re

app = FastAPI()

# CORS middleware (allow your frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or restrict to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# regex to remove ANSI escape codes (spinners, cursor moves, colors, etc.)
ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

def stream_ollama(prompt: str):
    # clone current env and disable Ollama’s spinner
    env = os.environ.copy()
    env["OLLAMA_NOPROGRESS"] = "1"

    process = subprocess.Popen(
        ["ollama", "run", "codellama:7b-instruct", prompt],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env
    )

    # stream stdout line by line, cleaned
    for line in iter(process.stdout.readline, ''):
        clean_line = ansi_escape.sub('', line)
        if clean_line.strip():  # send only human-readable text
            yield clean_line

    process.stdout.close()
    process.wait()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/generate")
async def generate_code(prompt: str = Query(...), request: Request = None):
    client_ip = request.client.host if request else "unknown"
    print(f"Frontend request from: {client_ip}")  # for debug/logging

    return StreamingResponse(
        stream_ollama(prompt),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Transfer-Encoding": "chunked",
            "X-Accel-Buffering": "no"
        }
    )
