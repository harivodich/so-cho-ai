export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type ImageValidationResult =
  | { valid: true }
  | { valid: false; status: 400 | 413; message: string };

export function validateImageUpload(size: number, mimeType: string): ImageValidationResult {
  if (!Number.isFinite(size) || size <= 0) {
    return { valid: false, status: 400, message: "Chưa nhận được file ảnh hóa đơn." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { valid: false, status: 400, message: "Ảnh phải là JPG, PNG hoặc WebP." };
  }
  if (size > MAX_IMAGE_BYTES) {
    return { valid: false, status: 413, message: "Ảnh vượt quá 5 MB. Hãy chọn ảnh rõ và nhẹ hơn." };
  }
  return { valid: true };
}
