# Upscaler Pro - Cloud-Based AI Image Super-Resolution Engine

> **Light Theme Only • Zero Client Hardware Strain • No Daily Quotas • Bulk Batch ZIP Archiver**

Upscaler Pro is a high-throughput, cloud-native image upscaling platform engineered to handle bulk uploads (150–200+ images) with zero dependency on the user's local device. All image processing (resizing, neural texture recovery, unsharp masking, and DPI metadata injection) executes entirely on the cloud server.

---

## 🌟 Key Features

1. **Zero Client CPU/GPU Usage**:
   - The user's device acts strictly as a browser terminal.
   - All high-frequency transforms and super-resolution upscaling run on the cloud backend.
2. **Strict Light Theme Design**:
   - Modern, focused light theme: Pure White `#FFFFFF`, soft grey-blue cards `#F7F8FC`, primary accent `#635BFF`, slate text `#202438`.
   - Dark mode overrides are disabled for brand clarity and print preview accuracy.
3. **No Daily Limits or Paywalls**:
   - Continuous processing based purely on current server resource availability.
4. **Reliable Bulk ZIP Archiving**:
   - Streamed ZIP generation via `archiver` / `zipfile` prevents server RAM exhaustion and eliminates archive timeouts.
   - Includes automatic manifest CSV in every batch export.
5. **Print-Ready DPI Metadata**:
   - Injects true physical resolution tags (72 DPI, 150 DPI, 300 DPI, 600 DPI) into EXIF/JFIF metadata for commercial print workflows.
6. **Robust Batch Queue Dashboard**:
   - Live metrics: Total, Uploaded, In-Queue, Completed, Failed, Processing Speed (img/min), and Estimated Time of Arrival (ETA).
   - Built-in interactive Before/After split slider to inspect edge sharpness and texture fidelity at 100% zoom.

---

## 🏗️ Architecture & Project Structure

```
├── server.ts                 # Full-stack Node.js / Express + Vite backend (runs on Cloud Run / Port 3000)
├── src/                      # Modern React UI with interactive controls & live telemetry
│   ├── App.tsx               # Primary interface & queue orchestrator
│   ├── types.ts              # TypeScript domain types
│   ├── utils/queueLogic.ts   # Pure functions for ETA, throughput, and CSV generation
│   └── utils/queueLogic.test.ts # Automated test runner (node:test)
├── backend/                  # Standalone Python FastAPI backend (Hugging Face / Docker ready)
│   ├── main.py               # FastAPI server with async job management & ZIP streaming
│   ├── upscaler.py           # Real-ESRGAN / Lanczos-3 engine with DPI injection
│   ├── queue_manager.py      # Async semaphore & concurrency control
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Standalone Pure Vanilla HTML5/CSS/JS frontend
│   ├── index.html            # Light-theme UI structure
│   ├── css/style.css         # Enforced #FFFFFF / #F7F8FC / #635BFF styling
│   └── js/app.js             # Vanilla ES6+ drag-and-drop & API integration
├── Dockerfile                # Production container specification (HF Spaces compatible)
└── package.json              # Express, Sharp, Archiver, React 19, Tailwind
```

---

## 🚀 Running the Application

### 1. AI Studio Dev Server (Running Now)
The app is pre-configured to run with full cloud processing on port 3000:
```bash
npm run dev
```

### 2. Standalone Python FastAPI Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 3. Docker Deployment (Hugging Face Spaces)
```bash
docker build -t upscaler-pro .
docker run -p 7860:7860 upscaler-pro
```

---

## ⚙️ Configuration & Settings

| Parameter | Options | Description |
|-----------|---------|-------------|
| **Scale Factor** | 2X, 4X, 8X | Target resolution multiplier |
| **Model Mode** | Photo Ultra, Anime/Illustration, Digital Graphics, Balanced | Specialized edge recovery & noise reduction |
| **Output Format** | Original, JPG, PNG, WEBP | Output file format |
| **JPEG Quality** | 70% – 100% | Compression level with mozjpeg |
| **Print DPI** | 72, 150, 300, 600 DPI | EXIF density metadata for print fidelity |
| **Concurrency** | 1 to 4 threads | Prevents server memory exhaustion during bulk queues |
