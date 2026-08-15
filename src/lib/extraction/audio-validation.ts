export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const supportedAudioTypes = new Set([
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
]);

export type AudioValidationResult =
  | { valid: true }
  | { valid: false; status: 413; message: string }
  | { valid: false; status: 415; message: string };

function normalizedMimeType(mimeType: string): string {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function validateAudioUpload(size: number, mimeType: string): AudioValidationResult {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_AUDIO_BYTES) {
    return { valid: false, status: 413, message: "Audio phải lớn hơn 0 và không quá 5 MB." };
  }

  if (!supportedAudioTypes.has(normalizedMimeType(mimeType))) {
    return {
      valid: false,
      status: 415,
      message: "Định dạng audio chưa hỗ trợ. Hãy ghi lại bằng trình duyệt hiện tại.",
    };
  }

  return { valid: true };
}
