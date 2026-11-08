# Dockerfile for Upscaler Pro (Hugging Face Spaces & Cloud Container Ready)
FROM python:3.10-slim

# Install system dependencies (libgl1 for OpenCV / PIL image codecs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create user with UID 1000 for Hugging Face Spaces compatibility
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

# Copy dependency list and install
COPY --chown=user:user backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download Real-ESRGAN x4plus weights if available
RUN mkdir -p weights && \
    curl -L -o weights/RealESRGAN_x4plus.pth \
    https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth || true

# Copy backend code and frontend static assets
COPY --chown=user:user backend/ ./backend/
COPY --chown=user:user frontend/ ./frontend/

WORKDIR $HOME/app/backend

# Default port 7860 (Hugging Face Spaces standard)
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
