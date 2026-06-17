// Công cụ cắt ghi âm bằng Web Audio API thuần (không thêm thư viện)

const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

// Giải mã blob audio (webm/opus, ogg, mp4, wav...) thành AudioBuffer
const decodeAudioBlob = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } finally {
    await audioCtx.close();
  }
};

// Cắt một đoạn từ AudioBuffer, giữ nguyên số kênh + sample rate
const trimAudioBuffer = (audioBuffer, startSec, endSec) => {
  const { sampleRate, numberOfChannels, length } = audioBuffer;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(length, Math.ceil(endSec * sampleRate));
  const frameCount = Math.max(1, endSample - startSample);

  const newBuffer = new AudioBuffer({
    length: frameCount,
    sampleRate,
    numberOfChannels,
  });

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    const trimmed = channelData.slice(startSample, endSample);
    newBuffer.copyToChannel(trimmed, ch);
  }

  return newBuffer;
};

// Mã hoá AudioBuffer thành WAV PCM 16-bit Blob
const encodeWavBlob = (audioBuffer) => {
  const { sampleRate, numberOfChannels, length } = audioBuffer;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channel data
  const channels = [];
  for (let ch = 0; ch < numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

// Rút peaks RMS từ AudioBuffer (kênh 0, hoặc trộn trung bình nếu stereo)
const extractPeaks = (audioBuffer, bucketCount = 40) => {
  const { numberOfChannels, length } = audioBuffer;
  const channelData = audioBuffer.getChannelData(0);
  let samples;
  if (numberOfChannels === 1) {
    samples = channelData;
  } else {
    samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < numberOfChannels; ch++) {
        sum += audioBuffer.getChannelData(ch)[i];
      }
      samples[i] = sum / numberOfChannels;
    }
  }

  const bucketSize = Math.max(1, Math.floor(samples.length / bucketCount));
  const peaks = [];

  for (let i = 0; i < bucketCount; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, samples.length);
    const count = end - start;
    if (count === 0) { peaks.push(0); continue; }
    let sumSq = 0;
    for (let j = start; j < end; j++) {
      sumSq += samples[j] * samples[j];
    }
    peaks.push(Math.sqrt(sumSq / count));
  }

  const maxPeak = Math.max(...peaks, 0.001);
  return peaks.map((p) => Math.min(1, p / maxPeak));
};

// Giải mã blob rồi rút peaks, trả [] nếu lỗi
const getPeaksFromBlob = async (blob, bucketCount = 40) => {
  try {
    const audioBuffer = await decodeAudioBlob(blob);
    return extractPeaks(audioBuffer, bucketCount);
  } catch {
    return [];
  }
};

// Orchestrator: giải mã → cắt → mã hoá WAV, trả blob + duration + peaks
const trimVoiceToWav = async (blob, startSec, endSec, bucketCount = 40) => {
  const audioBuffer = await decodeAudioBlob(blob);
  const trimmed = trimAudioBuffer(audioBuffer, startSec, endSec);
  const wavBlob = encodeWavBlob(trimmed);
  const duration = Math.max(1, Math.ceil(trimmed.length / trimmed.sampleRate));
  const peaks = extractPeaks(trimmed, bucketCount);
  return { blob: wavBlob, duration, peaks };
};

export { decodeAudioBlob, trimAudioBuffer, encodeWavBlob, extractPeaks, getPeaksFromBlob, trimVoiceToWav };
