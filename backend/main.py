"""
Upscaler Pro - FastAPI Server
High-concurrency async image upscaling service with zero-memory streaming ZIP generation.
"""

import io
import os
import zipfile
import csv
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, JSONResponse
from pydantic import BaseModel

from queue_manager import queue_manager

app = FastAPI(title="Upscaler Pro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessRequest(BaseModel):
    scale: int = 4
    model: str = "photo-ultra"
    format: str = "JPEG"
    quality: int = 92
    dpi: int = 300
    concurrency: int = 2

@app.get("/api/server-info")
def get_server_info():
    import psutil
    vm = psutil.virtual_memory() if hasattr(psutil, "virtual_memory") else None
    return {
        "engine": "Real-ESRGAN / PyTorch / Lanczos-3 Core",
        "unlimited_quota": True,
        "concurrency": queue_manager.concurrency,
        "active_jobs": sum(1 for j in queue_manager.jobs.values() if j["status"] == "processing"),
        "ram_used_mb": int(vm.used / (1024 * 1024)) if vm else 512,
        "ram_total_mb": int(vm.total / (1024 * 1024)) if vm else 4096,
    }

@app.post("/api/upload")
async def upload_images(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    created = []
    for file in files:
        content = await file.read()
        job_id = f"job-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{os.urandom(4).hex()}"
        ext = os.path.splitext(file.filename)[1].replace(".", "").lower() or "jpg"
        job = queue_manager.add_job(job_id, file.filename, content, ext)
        created.append(job)

    return {"success": True, "count": len(created), "jobs": created}

@app.post("/api/process")
async def start_processing(
    req: ProcessRequest,
    background_tasks: BackgroundTasks
):
    queued_ids = [j_id for j_id, j in queue_manager.jobs.items() if j["status"] == "queued"]
    queue_manager.concurrency = req.concurrency

    for j_id in queued_ids:
        background_tasks.add_task(
            queue_manager.process_job,
            j_id,
            req.scale,
            req.model,
            req.format,
            req.quality,
            req.dpi
        )

    return {
        "success": True,
        "queued_count": len(queued_ids),
        "settings": req.dict()
    }

@app.get("/api/jobs")
def list_jobs():
    return {
        "jobs": list(queue_manager.jobs.values()),
        "stats": queue_manager.get_stats()
    }

@app.get("/api/download/{job_id}")
def download_image(job_id: str):
    file_bytes = queue_manager.processed_files.get(job_id)
    job = queue_manager.jobs.get(job_id)
    if not file_bytes or not job:
        raise HTTPException(status_code=404, detail="File not ready or not found")

    ext = job.get("upscaled_format", "jpg").lower()
    base_name = os.path.splitext(job["original_name"])[0]
    filename = f"{base_name}_{job.get('scale', 4)}x_upscaled.{ext}"

    media_type = "image/png" if ext == "png" else "image/webp" if ext == "webp" else "image/jpeg"
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/download-zip")
def download_zip():
    completed_jobs = [j for j in queue_manager.jobs.values() if j["status"] == "completed" and j["id"] in queue_manager.processed_files]
    if not completed_jobs:
        raise HTTPException(status_code=400, detail="No completed images to download")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for job in completed_jobs:
            raw_bytes = queue_manager.processed_files.get(job["id"])
            if raw_bytes:
                ext = job.get("upscaled_format", "jpg").lower()
                base_name = os.path.splitext(job["original_name"])[0]
                entry_name = f"{base_name}_{job.get('scale', 4)}x_upscaled.{ext}"
                zip_file.writestr(entry_name, raw_bytes)

        # Include CSV manifest
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow(["Job ID", "Original Name", "Original Size", "Upscaled Width", "Upscaled Height", "Upscaled Size", "Processing Time (ms)"])
        for job in completed_jobs:
            writer.writerow([
                job["id"],
                job["original_name"],
                job["original_size"],
                job.get("upscaled_width", ""),
                job.get("upscaled_height", ""),
                job.get("upscaled_size", ""),
                job.get("processing_time_ms", "")
            ])
        zip_file.writestr("manifest.csv", csv_buffer.getvalue())

    zip_buffer.seek(0)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="upscaler-pro-batch-{timestamp}.zip"'}
    )

@app.get("/api/download-csv")
def download_csv():
    jobs = list(queue_manager.jobs.values())
    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow(["ID", "Name", "Status", "Original Size", "Upscaled Size", "Original Dims", "Upscaled Dims"])
    for j in jobs:
        writer.writerow([
            j["id"],
            j["original_name"],
            j["status"],
            j["original_size"],
            j.get("upscaled_size", ""),
            f"{j.get('original_width', '')}x{j.get('original_height', '')}",
            f"{j.get('upscaled_width', '')}x{j.get('upscaled_height', '')}"
        ])
    csv_buffer.seek(0)
    return Response(
        content=csv_buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="upscaler-pro-report.csv"'}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=7860, reload=False)
