// Call ElevenLabs API, see https://api.elevenlabs.io/docs
const fs = require('fs');
const axios = require('axios');
const apiKey = process.env.ELEVEN_API_KEY;

exports.synthesize = async (text, outPath) => {
  // send text -> get voice audio buffer -> save
  const response = await axios.post(
    'https://api.elevenlabs.io/v1/text-to-speech/YOUR_VOICE_ID',
    { text, voice_settings: { stability: 0.4, similarity_boost: 1.0 }, model_id: 'eleven_multilingual_v2' },
    { headers: { 'xi-api-key': apiKey }, responseType: 'arraybuffer' }
  );
  fs.writeFileSync(outPath, response.data);
};
