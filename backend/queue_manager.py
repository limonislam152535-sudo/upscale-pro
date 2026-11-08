"""
Upscaler Pro - Async Queue & Concurrency Manager
Handles large bulk image queues (150-200+ images) safely without memory spikes.
"""

import asyncio
from typing import Dict, Any, List, Optional
from upscaler import engine

class JobQueueManager:
    def __init__(self, concurrency: int = 2):
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.job_files: Dict[str, bytes] = {}
        self.processed_files: Dict[str, bytes] = {}
        self.is_running = False

    def add_job(self, job_id: str, original_name: str, file_bytes: bytes, file_format: str) -> Dict[str, Any]:
        job_data = {
            "id": job_id,
            "original_name": original_name,
            "original_size": len(file_bytes),
            "original_format": file_format,
            "original_width": 0,
            "original_height": 0,
            "status": "queued",
            "progress": 0,
            "upscaled_width": 0,
            "upscaled_height": 0,
            "upscaled_size": 0,
            "upscaled_format": "",
            "processing_time_ms": 0,
            "error": None
        }
        self.jobs[job_id] = job_data
        self.job_files[job_id] = file_bytes
        return job_data

    async def process_job(
        self,
        job_id: str,
        scale: int = 4,
        model: str = "photo-ultra",
        output_format: str = "JPEG",
        quality: int = 92,
        dpi: int = 300
    ):
        async with self.semaphore:
            job = self.jobs.get(job_id)
            file_bytes = self.job_files.get(job_id)
            if not job or not file_bytes:
                return

            job["status"] = "processing"
            job["progress"] = 25

            try:
                loop = asyncio.get_event_loop()
                result_bytes, orig_dim, target_dim, duration_ms = await loop.run_in_executor(
                    None,
                    engine.upscale_image,
                    file_bytes,
                    scale,
                    model,
                    output_format,
                    quality,
                    dpi
                )

                job["progress"] = 100
                job["status"] = "completed"
                job["original_width"] = orig_dim[0]
                job["original_height"] = orig_dim[1]
                job["upscaled_width"] = target_dim[0]
                job["upscaled_height"] = target_dim[1]
                job["upscaled_size"] = len(result_bytes)
                job["upscaled_format"] = output_format
                job["processing_time_ms"] = duration_ms

                self.processed_files[job_id] = result_bytes

            except Exception as e:
                job["status"] = "failed"
                job["error"] = str(e)
                job["progress"] = 0

    def get_stats(self) -> Dict[str, Any]:
        all_jobs = list(self.jobs.values())
        completed = sum(1 for j in all_jobs if j["status"] == "completed")
        processing = sum(1 for j in all_jobs if j["status"] == "processing")
        queued = sum(1 for j in all_jobs if j["status"] == "queued")
        failed = sum(1 for j in all_jobs if j["status"] == "failed")

        total_proc_ms = sum(j.get("processing_time_ms", 0) for j in all_jobs if j["status"] == "completed")
        avg_ms = int(total_proc_ms / completed) if completed > 0 else 1800
        eta_sec = int(((queued + processing) / max(1, self.concurrency)) * (avg_ms / 1000))

        return {
            "total": len(all_jobs),
            "completed": completed,
            "processing": processing,
            "queued": queued,
            "failed": failed,
            "avg_processing_time_ms": avg_ms,
            "estimated_remaining_time_sec": eta_sec
        }

queue_manager = JobQueueManager(concurrency=2)
