"use client";
/* eslint-disable @next/next/no-img-element -- local preview uses a blob URL before upload. */

import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/ui-icon";
import { MAX_IMAGE_BYTES, validateImageUpload } from "@/lib/extraction/image-validation";

type Props = {
  onAnalyze: (image: File, isRetry?: boolean) => Promise<void>;
  onCancel: () => void;
};

type Status = "ready" | "preview" | "analyzing";

export function ImageTransactionUploader({ onAnalyze, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  function clearPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setImage(null);
    setAttempts(0);
  }

  function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const nextImage = event.target.files?.[0] ?? null;
    event.target.value = "";
    setError(null);
    setAttempts(0);
    if (!nextImage) return;

    const validation = validateImageUpload(nextImage.size, nextImage.type);
    if (!validation.valid) {
      setError(validation.message);
      clearPreview();
      return;
    }

    clearPreview();
    const nextPreviewUrl = URL.createObjectURL(nextImage);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setImage(nextImage);
    setStatus("preview");
  }

  async function analyze() {
    if (!image || status === "analyzing") return;
    const isRetry = attempts > 0;
    setStatus("analyzing");
    setError(null);
    try {
      setAttempts((prev) => prev + 1);
      await onAnalyze(image, isRetry);
    } catch (reason) {
      setStatus("preview");
      setError(reason instanceof Error ? reason.message : "Không thể phân tích ảnh. Hãy thử ảnh khác hoặc nhập tay.");
    }
  }

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  return (
    <section className="entry-form image-uploader" aria-labelledby="image-uploader-title">
      <div className="section-heading panel-heading">
        <div>
          <h1 id="image-uploader-title">Chụp hóa đơn in</h1>
          <p className="section-description">Chỉ dùng hóa đơn chữ in rõ. Ảnh được giữ tạm để phân tích, không tự lưu vào sổ.</p>
        </div>
        <span className="review-badge"><UiIcon name="check" size={15} /> Luôn cần xác nhận</span>
      </div>

      <p className="voice-example">Mẹo: đặt hóa đơn ngay ngắn, đủ sáng, chụp trọn các dòng hàng. Chữ viết tay và ảnh mờ chỉ là beta, có thể bị từ chối.</p>
      {error ? <p className="form-error" role="alert"><UiIcon name="alert" size={19} />{error}</p> : null}

      {previewUrl ? (
        <figure className="image-preview">
          <img src={previewUrl} alt="Ảnh hóa đơn đã chọn để kiểm tra" />
          <figcaption>{image?.name} · {Math.ceil((image?.size ?? 0) / 1024)} KB</figcaption>
        </figure>
      ) : (
        <div className="image-empty-state">
          <UiIcon name="image" size={32} />
          <strong>Chưa chọn ảnh</strong>
          <span>JPG, PNG hoặc WebP · tối đa {MAX_IMAGE_BYTES / (1024 * 1024)} MB</span>
        </div>
      )}

      <input ref={inputRef} accept="image/jpeg,image/png,image/webp" capture="environment" className="visually-hidden" type="file" onChange={chooseImage} />
      <div className="voice-actions">
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()} disabled={status === "analyzing"}>
          <UiIcon name="image" size={19} /> {image ? "Chọn ảnh khác" : "Chụp hoặc chọn ảnh"}
        </button>
        {image ? (
          <button className="primary-button" type="button" onClick={() => void analyze()} disabled={status === "analyzing"}>
            {status === "analyzing" ? "Đang phân tích…" : "Phân tích hóa đơn"} <UiIcon name="chevron-right" size={18} />
          </button>
        ) : null}
        <button className="text-button" type="button" onClick={onCancel} disabled={status === "analyzing"}><UiIcon name="pencil" size={17} /> Nhập tay thay thế</button>
      </div>
      <p className="voice-disclosure"><UiIcon name="info" size={17} /> Kết quả luôn mở ở màn hình kiểm tra. Bạn tự sửa từng dòng rồi mới bấm lưu.</p>
    </section>
  );
}
