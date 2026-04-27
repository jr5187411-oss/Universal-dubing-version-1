const uploadBtn = document.getElementById('uploadBtn');
const videoInput = document.getElementById('videoInput');
const progressBar = document.getElementById('progressBar');
const statusDiv = document.getElementById('status');
const downloadLink = document.getElementById('downloadLink');

let interval, jobId;

uploadBtn.onclick = async () => {
  if (!videoInput.files[0]) return alert("Select a video first!");
  const formData = new FormData();
  formData.append('video', videoInput.files[0]);
  statusDiv.innerText = "Uploading...";
  uploadBtn.disabled = true;
  downloadLink.style.display = 'none';

  const resp = await fetch('/api/upload', { method: 'POST', body: formData });
  const { jobId: newJobId } = await resp.json();
  jobId = newJobId;
  updateProgress(0, 'Processing...');
  interval = setInterval(checkProgress, 1500);
};

async function checkProgress() {
  const resp = await fetch(`/api/progress/${jobId}`);
  const data = await resp.json();
  updateProgress(data.progress || 0, data.status || '');
  if (data.progress === 100 && data.download) {
    clearInterval(interval);
    statusDiv.innerText = "Done!";
    downloadLink.style.display = 'block';
    downloadLink.href = data.download;
    downloadLink.download = '';
    downloadLink.innerText = 'Download Dubbed Video';
    uploadBtn.disabled = false;
  }
  if (data.status && data.status.startsWith('Failed')) {
    statusDiv.innerText = data.status;
    clearInterval(interval);
    uploadBtn.disabled = false;
  }
}

function updateProgress(pct, text) {
  progressBar.innerHTML = `<div class="progress-bar-fill" style="width:${pct}%;"></div>`;
  statusDiv.innerText = text;
}
