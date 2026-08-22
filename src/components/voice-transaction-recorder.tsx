"use client";

import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/ui-icon";
import { canAnalyzeRecording } from "@/lib/extraction/retry-policy";

const MAX_RECORDING_SECONDS = 30;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const TARGET_SAMPLE_RATE = 16_000;

type RecorderStatus = "ready" | "recording" | "preview" | "analyzing";

type VoiceTransactionRecorderProps = {
  onAnalyze: (audio: File, isRetry?: boolean) => Promise<void>;
  onCancel: () => void;
};

function formatDuration(seconds: number): string {
  return `00:${String(Math.min(seconds, MAX_RECORDING_SECONDS)).padStart(2, "0")}`;
}

function preferredRecordingMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function encodeMonoWav(audioBuffer: AudioBuffer): Blob {
  const sampleRate = Math.min(audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
  const sampleCount = Math.ceil(audioBuffer.duration * sampleRate);
  const bytesPerSample = 2;
  const wavBuffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
  const view = new DataView(wavBuffer);
  const writeText = (offset: number, text: string) => {
    [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * bytesPerSample, true);

  const sourceChannels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  const sourceStep = audioBuffer.sampleRate / sampleRate;
  for (let targetIndex = 0; targetIndex < sampleCount; targetIndex += 1) {
    const sourceIndex = Math.min(Math.floor(targetIndex * sourceStep), audioBuffer.length - 1);
    const mixedSample = sourceChannels.reduce((sum, channel) => sum + channel[sourceIndex], 0) / sourceChannels.length;
    const normalizedSample = Math.max(-1, Math.min(1, mixedSample));
    view.setInt16(44 + targetIndex * bytesPerSample, normalizedSample * 0x7fff, true);
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

async function convertToWav(recording: Blob): Promise<File> {
  const audioContext = new AudioContext();
  try {
    const source = await recording.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(source.slice(0));
    const wav = encodeMonoWav(decoded);
    if (wav.size > MAX_AUDIO_BYTES) {
      throw new Error("Audio sau khi xử lý vượt quá 5 MB. Hãy ghi lại ngắn hơn.");
    }

    return new File([wav], "giao-dich.wav", { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

export function VoiceTransactionRecorder({ onAnalyze, onCancel }: VoiceTransactionRecorderProps) {
  const [status, setStatus] = useState<RecorderStatus>("ready");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisAttempts, setAnalysisAttempts] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);
  const discardOnStopRef = useRef(false);
  const audioUrlRef = useRef<string | null>(null);

  function clearTimers() {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    elapsedTimerRef.current = null;
    stopTimerRef.current = null;
  }

  function stopMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearAudioUrl() {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioUrl(null);
  }

  function resetPreview() {
    clearAudioUrl();
    setRecording(null);
    setElapsedSeconds(0);
  }

  function finishRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Trình duyệt này không hỗ trợ ghi âm. Hãy dùng Chrome Android hoặc nhập tay.");
      return;
    }

    clearTimers();
    resetPreview();
    setError(null);
    setElapsedSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = preferredRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardOnStopRef.current = false;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("error", () => {
        clearTimers();
        stopMicrophone();
        setStatus("ready");
        setError("Không thể hoàn tất ghi âm. Hãy thử lại hoặc nhập tay.");
      });
      recorder.addEventListener("stop", () => {
        clearTimers();
        stopMicrophone();
        recorderRef.current = null;

        if (discardOnStopRef.current) {
          discardOnStopRef.current = false;
          resetPreview();
          setStatus("ready");
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size === 0) {
          setStatus("ready");
          setError("Không nhận được âm thanh. Hãy kiểm tra microphone và ghi lại.");
          return;
        }

        const nextAudioUrl = URL.createObjectURL(blob);
        audioUrlRef.current = nextAudioUrl;
        setAudioUrl(nextAudioUrl);
        setRecording(blob);
        setStatus("preview");
      });

      startTimeRef.current = Date.now();
      recorder.start(250);
      setStatus("recording");
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds(Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - startTimeRef.current) / 1_000)));
      }, 250);
      stopTimerRef.current = setTimeout(finishRecording, MAX_RECORDING_SECONDS * 1_000);
    } catch (reason) {
      stopMicrophone();
      const message = reason instanceof DOMException && reason.name === "NotAllowedError"
        ? "Bạn chưa cho phép microphone. Hãy cấp quyền rồi thử lại hoặc nhập tay."
        : "Không thể mở microphone. Hãy thử lại hoặc nhập tay.";
      setError(message);
      setStatus("ready");
    }
  }

  function discardRecording() {
    setError(null);
    setAnalysisAttempts(0);
    clearTimers();
    if (recorderRef.current?.state === "recording" || recorderRef.current?.state === "paused") {
      discardOnStopRef.current = true;
      finishRecording();
      return;
    }

    resetPreview();
    setStatus("ready");
  }

  async function analyzeRecording() {
    if (!recording || !canAnalyzeRecording(analysisAttempts)) return;
    const isRetry = analysisAttempts > 0;
    setStatus("analyzing");
    setError(null);
    try {
      const wavFile = await convertToWav(recording);
      setAnalysisAttempts((attempts) => attempts + 1);
      await onAnalyze(wavFile, isRetry);
    } catch (reason) {
      setStatus("preview");
      setError(reason instanceof Error ? reason.message : "Không thể phân tích audio. Bạn có thể thử lại một lần, ghi lại hoặc nhập tay.");
    }
  }

  useEffect(() => () => {
    clearTimers();
    stopMicrophone();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  return (
    <section className="entry-form voice-recorder" aria-labelledby="voice-recorder-title">
      <div className="section-heading panel-heading">
        <div>
          <h1 id="voice-recorder-title">Ghi bằng giọng nói</h1>
          <p className="section-description">Nói một giao dịch trong tối đa 30 giây, sau đó kiểm tra bản nháp trước khi lưu.</p>
        </div>
        <span className="review-badge"><UiIcon name="check" size={15} /> Luôn cần xác nhận</span>
      </div>

      <p className="voice-example">Ví dụ: “Bán 2 ký xoài, tổng 80 nghìn.” Audio chỉ được giữ tạm trên thiết bị để phân tích, không lưu vào sổ hay server.</p>
      {error ? <p className="form-error" role="alert"><UiIcon name="alert" size={19} />{error}</p> : null}

      {status === "recording" ? (
        <div className="voice-status" role="status">
          <span className="recording-dot" aria-hidden="true" />
          <div className="soundwave-bars" aria-hidden="true">
            <span className="bar bar-1" />
            <span className="bar bar-2" />
            <span className="bar bar-3" />
            <span className="bar bar-4" />
            <span className="bar bar-5" />
          </div>
          <span>Đang ghi {formatDuration(elapsedSeconds)} / 00:30</span>
        </div>
      ) : null}

      {audioUrl ? (
        <div className="voice-preview">
          <p>Đã ghi {formatDuration(elapsedSeconds)}. Nghe lại trước khi phân tích.</p>
          <audio controls src={audioUrl} />
        </div>
      ) : null}

      <div className="voice-actions">
        {status === "ready" ? <button className="primary-button" type="button" onClick={() => void startRecording()}><UiIcon name="microphone" size={19} /> Bắt đầu ghi</button> : null}
        {status === "recording" ? <button className="primary-button" type="button" onClick={finishRecording}><UiIcon name="stop" size={18} /> Dừng ghi</button> : null}
        {status === "preview" ? <>
          <button className="secondary-button" type="button" onClick={discardRecording}>Ghi lại</button>
          {canAnalyzeRecording(analysisAttempts) ? (
            <button className="primary-button" type="button" onClick={() => void analyzeRecording()}>
              {analysisAttempts === 0 ? "Phân tích giao dịch" : "Thử lại lần cuối"} <UiIcon name="chevron-right" size={18} />
            </button>
          ) : (
            <p className="voice-retry-limit" role="status">Đã dùng tối đa 2 lần phân tích cho bản ghi này. Hãy ghi lại hoặc nhập tay.</p>
          )}
        </> : null}
        {status === "analyzing" ? <button className="primary-button" type="button" disabled>Đang phân tích…</button> : null}
        {status !== "analyzing" ? <button className="text-button" type="button" onClick={onCancel}><UiIcon name="pencil" size={17} /> Nhập tay thay thế</button> : null}
      </div>
      <p className="voice-disclosure"><UiIcon name="info" size={17} /> Ứng dụng không tự gọi lại audio khi có lỗi. Mỗi bản ghi có tối đa 2 lượt phân tích; sau đó hãy ghi lại hoặc nhập tay.</p>
    </section>
  );
}
