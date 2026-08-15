import { Buffer } from "node:buffer";

function readFourCc(buffer, offset) {
  return buffer.toString("ascii", offset, offset + 4);
}

function assertRange(buffer, offset, length, label) {
  if (offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error(`WAV ${label} vượt quá kích thước tệp.`);
  }
}

/**
 * Returns a copy of a mono 32-bit IEEE-float WAV with deterministic white noise.
 * FLEURS vi_vn clips use this format. Other formats are rejected rather than
 * silently corrupting audio.
 */
export function addDeterministicWhiteNoise(wavBytes, { seed, snrDb }) {
  const output = Buffer.from(wavBytes);
  if (output.length < 12 || readFourCc(output, 0) !== "RIFF" || readFourCc(output, 8) !== "WAVE") {
    throw new Error("Chỉ hỗ trợ WAV RIFF hợp lệ.");
  }

  let format;
  let dataOffset;
  let dataLength;
  for (let offset = 12; offset + 8 <= output.length;) {
    const chunkId = readFourCc(output, offset);
    const chunkLength = output.readUInt32LE(offset + 4);
    const contentOffset = offset + 8;
    assertRange(output, contentOffset, chunkLength, `chunk ${chunkId}`);
    if (chunkId === "fmt ") {
      if (chunkLength < 16) throw new Error("WAV thiếu fmt chunk hợp lệ.");
      format = {
        audioFormat: output.readUInt16LE(contentOffset),
        channels: output.readUInt16LE(contentOffset + 2),
        bitsPerSample: output.readUInt16LE(contentOffset + 14),
      };
    }
    if (chunkId === "data") {
      dataOffset = contentOffset;
      dataLength = chunkLength;
      break;
    }
    offset = contentOffset + chunkLength + (chunkLength % 2);
  }

  if (!format || dataOffset === undefined || dataLength === undefined) throw new Error("WAV thiếu fmt hoặc data chunk.");
  if (format.audioFormat !== 3 || format.channels !== 1 || format.bitsPerSample !== 32 || dataLength % 4 !== 0) {
    throw new Error("Chỉ hỗ trợ WAV IEEE-float 32-bit mono để tạo nhiễu có kiểm soát.");
  }

  const sampleCount = dataLength / 4;
  let energy = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = output.readFloatLE(dataOffset + index * 4);
    if (!Number.isFinite(sample)) throw new Error("WAV chứa sample không hợp lệ.");
    energy += sample * sample;
  }
  const signalRms = Math.sqrt(energy / sampleCount);
  if (signalRms === 0) throw new Error("Không thể thêm nhiễu vào WAV im lặng.");
  const targetNoiseRms = signalRms / (10 ** (snrDb / 20));

  let state = seed >>> 0 || 1;
  const nextRandom = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
  const rawNoise = new Float64Array(sampleCount);
  let noiseEnergy = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const value = nextRandom() * 2 - 1;
    rawNoise[index] = value;
    noiseEnergy += value * value;
  }
  const scale = targetNoiseRms / Math.sqrt(noiseEnergy / sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const original = output.readFloatLE(dataOffset + index * 4);
    output.writeFloatLE(Math.max(-1, Math.min(1, original + rawNoise[index] * scale)), dataOffset + index * 4);
  }
  return output;
}
