from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
import uuid
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

ROOT = Path(__file__).parent / "builder_workspace"
ROOT.mkdir(exist_ok=True)
app = FastAPI(title="Said EXE Local Builder")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
jobs: Dict[str, dict] = {}


def build_job(job_id: str, source: Path, name: str) -> None:
    job_dir = ROOT / job_id; output = job_dir / "dist"; output.mkdir(exist_ok=True)
    jobs[job_id].update(status="building", progress=15)
    try:
        command = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--windowed", "--name", name, "--distpath", str(output), str(source)]
        subprocess.run(command, cwd=job_dir, check=True, capture_output=True, text=True, timeout=900)
        result = output / f"{name}.exe"
        if not result.exists(): raise RuntimeError("لم يتم إنشاء الملف الناتج")
        jobs[job_id].update(status="completed", progress=100, download=f"/jobs/{job_id}/download")
    except Exception as exc:
        jobs[job_id].update(status="failed", progress=100, error=str(exc))


@app.get("/health")
def health():
    return {"status": "ok", "service": "Said EXE Local Builder"}


@app.post("/jobs")
def create_job(file: UploadFile = File(...), name: str = "SaidEXE"):
    if not file.filename or not file.filename.lower().endswith(".py"):
        raise HTTPException(status_code=400, detail="اختر ملف Python بامتداد .py")
    job_id = uuid.uuid4().hex
    job_dir = ROOT / job_id; job_dir.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(ch for ch in Path(file.filename).stem if ch.isalnum() or ch in "-_ ").strip() or "SaidEXE"
    source = job_dir / f"{safe_name}.py"
    source.write_bytes(file.file.read())
    jobs[job_id] = {"id": job_id, "status": "queued", "progress": 5, "filename": file.filename}
    threading.Thread(target=build_job, args=(job_id, source, name), daemon=True).start()
    return jobs[job_id]


@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    if job_id not in jobs: raise HTTPException(status_code=404, detail="المهمة غير موجودة")
    return jobs[job_id]


@app.get("/jobs/{job_id}/download")
def download(job_id: str):
    job = jobs.get(job_id)
    if not job or job.get("status") != "completed": raise HTTPException(status_code=404, detail="الملف غير جاهز")
    path = ROOT / job_id / "dist" / "SaidEXE.exe"
    if not path.exists():
        matches = list((ROOT / job_id / "dist").glob("*.exe")); path = matches[0] if matches else path
    return FileResponse(path, filename=path.name, media_type="application/octet-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("SAID_EXE_PORT", "8765")))
