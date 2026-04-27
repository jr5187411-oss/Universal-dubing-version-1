const path = require('path');
const fs = require('fs');
const { processDubbingJob, getProgress, getOutputPath } = require('../services/ffmpegService');

const jobs = {}; // Simple in-memory job tracking for progress

exports.handleUpload = async (req, res) => {
  if (!req.files || !req.files.video) return res.status(400).json({ error: 'No file uploaded.' });
  const jobId = Date.now().toString();
  const inputPath = path.join(__dirname, '../uploads/', `${jobId}_${req.files.video.name}`);
  await req.files.video.mv(inputPath);
  jobs[jobId] = { progress: 0, status: 'Processing...' };

  // Start non-blocking processing
  processDubbingJob(inputPath, jobId, jobs)
    .catch(err => {
      jobs[jobId] = { progress: 0, status: `Failed: ${err.message}` };
    });

  res.json({ jobId });
};

exports.handleProgress = (req, res) => {
  const { id } = req.params;
  if (!jobs[id]) return res.status(404).json({ error: 'Job not found' });
  res.json(jobs[id]);
};

exports.handleDownload = (req, res) => {
  const { id } = req.params;
  const outputPath = getOutputPath(id);
  if (!fs.existsSync(outputPath)) return res.status(404).json({ error: 'File not ready' });
  res.download(outputPath, `dubbed_${id}.mp4`);
};
