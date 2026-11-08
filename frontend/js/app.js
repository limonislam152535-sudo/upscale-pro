// Upscaler Pro - Pure Vanilla ES6 Client
const API_BASE = '/api';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const galleryGrid = document.getElementById('galleryGrid');

// Drag and drop events
['dragenter', 'dragover'].forEach(name => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach(name => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
  });
});

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFileUpload(e.dataTransfer.files);
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length > 0) {
    handleFileUpload(fileInput.files);
  }
});

async function handleFileUpload(files) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('images', files[i]);
  }

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      fetchJobs();
    }
  } catch (err) {
    console.error('Upload failed:', err);
  }
}

const dpiSelect = document.getElementById('dpiSelect');
const customDpiContainer = document.getElementById('customDpiContainer');
const customDpiInput = document.getElementById('customDpiInput');

if (dpiSelect) {
  dpiSelect.addEventListener('change', () => {
    if (dpiSelect.value === 'custom') {
      customDpiContainer.style.display = 'block';
    } else {
      customDpiContainer.style.display = 'none';
    }
  });
}

function getSelectedDpi() {
  if (dpiSelect && dpiSelect.value === 'custom') {
    const val = parseInt(customDpiInput?.value, 10);
    return isNaN(val) ? 300 : Math.min(1200, Math.max(1, val));
  }
  const val = parseInt(dpiSelect?.value, 10);
  return isNaN(val) ? 300 : Math.min(1200, Math.max(1, val));
}

async function startBatchProcessing() {
  const chosenDpi = getSelectedDpi();
  try {
    await fetch(`${API_BASE}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          scale: 4,
          model: 'photo-ultra',
          format: 'same',
          quality: 92,
          dpi: chosenDpi,
          concurrency: 2
        }
      })
    });
    fetchJobs();
  } catch (err) {
    console.error('Failed to start processing:', err);
  }
}

async function fetchJobs() {
  try {
    const res = await fetch(`${API_BASE}/jobs`);
    const data = await res.json();
    updateUI(data.jobs, data.stats);
  } catch (err) {
    console.error('Failed to fetch jobs:', err);
  }
}

function updateUI(jobs, stats) {
  if (stats) {
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-queued').innerText = stats.queued || 0;
    document.getElementById('stat-processing').innerText = stats.processing || 0;
    document.getElementById('stat-completed').innerText = stats.completed || 0;
    document.getElementById('stat-eta').innerText = (stats.estimatedRemainingTimeSec || 0) + 's';
  }

  galleryGrid.innerHTML = jobs.map(job => `
    <div class="image-card">
      <img class="image-preview" src="${job.status === 'completed' ? `${API_BASE}/image/${job.id}/upscaled` : `${API_BASE}/image/${job.id}/original`}" alt="${job.originalName}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'><rect width=\\'100\\' height=\\'100\\' fill=\\'%23eee\\'/></svg>'">
      <div class="card-body">
        <div class="card-title" title="${job.originalName}">${job.originalName}</div>
        <div style="font-size: 12px; color: var(--text-muted);">
          Status: <strong>${job.status.toUpperCase()}</strong>
          ${job.upscaledWidth ? ` • ${job.upscaledWidth}x${job.upscaledHeight}` : ''}
        </div>
        ${job.status === 'completed' ? `
          <a class="btn" style="text-decoration: none; justify-content: center; margin-top: auto;" href="${API_BASE}/download/${job.id}" download>Download Upscaled</a>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function downloadAllZip() {
  window.location.href = `${API_BASE}/download-zip`;
}

function downloadCsv() {
  window.location.href = `${API_BASE}/download-csv`;
}

async function clearCompleted() {
  await fetch(`${API_BASE}/jobs/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter: 'completed' })
  });
  fetchJobs();
}

// Initial fetch and polling
fetchJobs();
setInterval(fetchJobs, 2500);
