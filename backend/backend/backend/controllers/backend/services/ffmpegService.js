const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const whisperService = require('./whisperService');
const translationService = require('./translationService');
const elevenLabsService = require('./elevenLabsService');

const chunkLength = 5 * 60; // 5 minutes in seconds (300 s)
const outputDir = path.join(__dirname, '../output/');

function getOutputPath(jobId) {
  return path.join(outputDir, `${jobId}_dubbed.mp4`);
}

async function processDubbingJob(inputPath, jobId, jobs) {
  jobs[jobId] = { progress: 0, status: 'Extracting audio...' };

  // 1. Extract audio
  const audioPath = inputPath.replace(/\.\w+$/, '.wav');
  await runCommand(`ffmpeg -y -i "${inputPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`);

  // 2. Split audio into chunks
  jobs[jobId] = { progress: 5, status: 'Splitting audio...' };
  const chunkDir = path.join(outputDir, `${jobId}_chunks`);
  fs.mkdirSync(chunkDir, { recursive: true });
  const chunkPaths = await splitAudio(audioPath, chunkDir);

  // 3. Detect language + Whisper STT per chunk
  jobs[jobId] = { progress: 15, status: 'Transcribing and translating...' };
  let allTexts = [];
  let detectedLang = '';
  for (let i = 0; i < chunkPaths.length; i++) {
    try {
      jobs[jobId].progress = 15 + (i * 40 / chunkPaths.length);
      const { text, language } = await whisperService.speechToText(chunkPaths[i]);
      if (!detectedLang) detectedLang = language;
      allTexts.push(text);
    } catch {
      // Mark failed chunk
      allTexts.push('[FAILED CHUNK]');
    }
  }

  // 4. Translate to Urdu
  const fullText = allTexts.join(' ');
  const urduText = await translationService.translateToUrdu(fullText, detectedLang);

  // 5. Synthesize with ElevenLabs API, chunk-wise
  jobs[jobId] = { progress: 65, status: 'Synthesizing Urdu speech...' };
  const urduChunkPaths = [];
  for (let i = 0; i < chunkPaths.length; i++) {
    const urduChunkText = urduText.substring(i * chunkLength, (i+1) * chunkLength); // naive chunk
    const urduAudioPath = path.join(chunkDir, `urdu_chunk_${i}.mp3`);
    try {
      await elevenLabsService.synthesize(urduChunkText, urduAudioPath);
      urduChunkPaths.push(urduAudioPath);
    } catch (e) {
      urduChunkPaths.push(null); // handle failed chunk
    }
    jobs[jobId].progress = 65 + (i * 20 / chunkPaths.length);
  }

  // 6. Concatenate all audio
  jobs[jobId] = { progress: 85, status: 'Combining Urdu audio...' };
  const concatListPath = path.join(chunkDir, 'concat.txt');
  fs.writeFileSync(concatListPath, urduChunkPaths.filter(Boolean).map(p => `file '${p}'`).join('\n'));
  const finalAudioPath = path.join(outputDir, `${jobId}_urdu_final.mp3`);
  await runCommand(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${finalAudioPath}"`);

  // 7. Replace audio in original video
  jobs[jobId] = { progress: 95, status: 'Muxing final video...' };
  const outVideoPath = getOutputPath(jobId);
  await runCommand(`ffmpeg -y -i "${inputPath}" -i "${finalAudioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${outVideoPath}"`);

  jobs[jobId] = { progress: 100, status: 'Done', download: `/output/${jobId}_dubbed.mp4` };
}

async function splitAudio(audioPath, chunkDir) {
  // 1. Get total duration
  const duration = await getAudioDuration(audioPath);
  let chunkPaths = [];
  for (let start = 0, i = 0; start < duration; start += chunkLength, i++) {
    const outPath = path.join(chunkDir, `chunk_${i}.wav`);
    await runCommand(`ffmpeg -y -i "${audioPath}" -ss ${start} -t ${chunkLength} "${outPath}"`);
    chunkPaths.push(outPath);
  }
  return chunkPaths;
}

function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(parseFloat(stdout));
    });
  });
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || stdout || err));
      else resolve();
    });
  });
}

module.exports = { processDubbingJob, getProgress: () => {}, getOutputPath };
