# Evaluation Lab: trích xuất giao dịch bằng AI

Thư mục này chứa bằng chứng tái chạy được cho luồng Gemini trích xuất giao dịch. Nó không chứa API key, audio thu từ người quen, giao dịch thật, số điện thoại hay dữ liệu cá nhân.

## Dataset và giới hạn

- `datasets/synthetic-text-v1.jsonl`: 60 câu do dự án tự soạn và gắn nhãn trước khi chạy model. Bao phủ bán, nhập, chi phí, `nghìn/ngàn/k`, `ký/kg/chục`, thiếu trường, câu ngoài phạm vi và hai giao dịch trong một câu.
- `manifests/synthetic-tts.jsonl`: 30 câu synthetic có thể được chuyển thành TTS. Audio sinh ra không commit.
- `manifests/fleurs-vi-negative-clear-noisy.jsonl`: 30 sample FLEURS public paired: 15 clip gốc rõ và 15 biến thể nhiễu trắng xác định 20 dB SNR; dùng làm negative control, không phải benchmark giao dịch.

Xem provenance, giấy phép và số mẫu tại `dataset-manifest.json`. Kết quả synthetic/public không đại diện đầy đủ cho môi trường chợ thực tế.

## Chạy không tốn Gemini

Lệnh này tạo fixture từ nhãn đã khóa, chạy runner và xuất kết quả JSON/Markdown. Nó chỉ kiểm tra pipeline metrics, không phải kết quả model.

```powershell
npm run eval:text:fixture
npm run eval:metrics
```

Output mặc định:

```text
evaluation/results/text-run.jsonl
evaluation/results/text-report.json
evaluation/results/text-report.md
```

## Chạy Gemini 2.5 Flash thật

Yêu cầu `.env.local` có `GEMINI_API_KEY`; đây là một lượt gọi Gemini cho mỗi mẫu. Model và prompt version được lưu trong report. Không chạy với dữ liệu chưa được phép sử dụng.

```powershell
npm run eval:text
```

Runner gửi structured-output request đến đúng `gemini-2.5-flash`, giữ lại cả kết quả sai, và viết output theo kiểu an toàn: report cũ không bị xóa cho đến khi run mới hoàn thành.

## Metrics được công bố

- Accuracy cho `type`, `amount`, `quantity`, `unitPrice`.
- Exact transaction accuracy: cả bốn trường đúng cùng lúc.
- Non-transaction rejection: câu ngoài phạm vi được trả về rỗng.
- Invalid JSON rate: response không parse được theo contract.
- Requires-human-review rate: kết quả sai, thiếu/cần kiểm tra, hoặc lỗi response.
- Nhóm lỗi theo trường và loại response.

Không gộp các metric thành một con số “voice accuracy”. Không dùng confidence do model tự khai. UI phải luôn yêu cầu người dùng xác nhận trước khi lưu.

## Voice benchmark không thu giọng người dùng

`synthetic-tts-v1` chỉ là bộ prompt project-authored để chạy khi dịch vụ TTS tạo được audio tiếng Việt hợp lệ. TTS hiện bị `content_blocked`, vì vậy không có metric transaction-audio nào được công bố.

Benchmark public đang dùng Google FLEURS `vi_vn` (CC-BY-4.0) làm **negative control**. Lệnh dưới đây tải 30 clip public, tạo 15 cặp rõ/nhiễu ở 20 dB SNR, gọi đúng API ứng dụng và xuất report:

```powershell
node evaluation/scripts/download-fleurs-vi-negative.mjs --limit 30 --scan-limit 198
node evaluation/scripts/build-fleurs-clear-noisy-manifest.mjs --pairs 15 --snr-db 20
$env:VOICE_EVAL_ID_TOKEN="<Firebase ID token cua tai khoan that>"
node evaluation/scripts/run-audio-eval.mjs --manifest evaluation/manifests/fleurs-vi-negative-clear-noisy.jsonl --output evaluation/results/fleurs-vi-negative-clear-noisy-run.jsonl --base-url http://127.0.0.1:3102 --limit 30
node evaluation/scripts/score-results.mjs --expected evaluation/manifests/fleurs-vi-negative-clear-noisy.jsonl --actual evaluation/results/fleurs-vi-negative-clear-noisy-run.jsonl --report evaluation/results/fleurs-vi-negative-clear-noisy-report.json
node evaluation/scripts/publish-audio-negative-report.mjs --source evaluation/results/fleurs-vi-negative-clear-noisy-report.json --output public/evaluation/fleurs-vi-negative-clear-noisy-latest.json
```

Xem provenance, giới hạn và cách diễn giải metric tại [`docs/voice-benchmark-protocol.md`](../docs/voice-benchmark-protocol.md). Common Voice chỉ còn là nguồn thay thế tùy chọn, không phải evidence đang công bố.
## Publish báo cáo thật lên UI

Chỉ publish sau khi `eval:text` gọi model thật. Script sẽ từ chối report có `model: "fixture"`.

```powershell
node evaluation/scripts/publish-text-report.mjs
# Hoặc chạy evaluation mới rồi publish liền:
npm run eval:text:publish
```

File public chỉ chứa metric, phiên bản model/prompt và thời điểm chạy; không chứa input, raw response hay API key.

## Trạng thái voice benchmark

Đã chạy 30 sample FLEURS public paired qua đúng `/api/extract` và Gemini 2.5 Flash. Kết quả: **29/30 (96,67%)** request hợp lệ được từ chối là ngoài phạm vi; rõ 14/15 (93,33%), nhiễu 15/15 (100%). 1/30 nhận HTTP 502 và được tính là failure, không được tính là từ chối đúng. Không có raw audio, transcript, speaker metadata hay API key trong artifact public.

Đây là kiểm tra khả năng từ chối câu tiếng Việt không phải giao dịch, **không phải** transaction-voice accuracy. Xem provenance, lệnh tái chạy và giới hạn tại `docs/voice-benchmark-protocol.md`; artifact đã khử dữ liệu tại `public/evaluation/fleurs-vi-negative-clear-noisy-latest.json`.

Gemini TTS vẫn trả `content_blocked` nên chưa có audio giao dịch synthetic hợp lệ. Vì vậy dự án không công bố accuracy trích xuất giao dịch bằng voice cho đến khi có báo cáo TTS transaction rõ/nhiễu tái chạy được.