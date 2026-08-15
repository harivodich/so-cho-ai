import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import { addDeterministicWhiteNoise } from "./wav-noise.mjs";

function testWav(samples) {
  const byteLength = samples.length * 4;
  const wav = Buffer.alloc(58 + byteLength);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8, "ascii");
  wav.writeUInt32LE(18, 16);
  wav.writeUInt16LE(3, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16_000, 24);
  wav.writeUInt32LE(64_000, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(32, 34);
  wav.writeUInt16LE(0, 36);
  wav.write("fact", 38, "ascii");
  wav.writeUInt32LE(4, 42);
  wav.writeUInt32LE(samples.length, 46);
  wav.write("data", 50, "ascii");
  wav.writeUInt32LE(byteLength, 54);
  samples.forEach((sample, index) => wav.writeFloatLE(sample, 58 + index * 4));
  return wav;
}

const input = testWav([0.1, -0.2, 0.3, -0.4]);
const first = addDeterministicWhiteNoise(input, { seed: 42, snrDb: 20 });
const second = addDeterministicWhiteNoise(input, { seed: 42, snrDb: 20 });
assert.deepEqual(first, second);
assert.notDeepEqual(first, input);
assert.throws(() => addDeterministicWhiteNoise(Buffer.from("not wav"), { seed: 1, snrDb: 20 }));
console.log("wav-noise tests passed");
