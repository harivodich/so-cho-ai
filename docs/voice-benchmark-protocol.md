# Voice benchmark protocol

## Scope and evidence boundary

Every extracted draft still requires human confirmation before it can be saved. Voice evaluation therefore measures model/API behavior; it never authorizes auto-save.

The project keeps transaction extraction and public negative-control speech separate. They must never be merged into one “voice accuracy” number.

| Dataset | Purpose | License/provenance | What it can prove |
| --- | --- | --- | --- |
| `synthetic-tts-v1` | Transaction extraction accuracy | Project-authored Vietnamese transaction prompts; generated WAV files stay local | Controlled transaction accuracy only when valid Vietnamese TTS audio exists |
| `google-fleurs-vi-vn-validation` | Non-transaction rejection | Google FLEURS `vi_vn` validation, CC-BY-4.0 | Whether unrelated public Vietnamese speech is rejected; it does **not** measure market-transaction accuracy |

Audio files are held under `evaluation/inputs/` and ignored by Git. The generated manifest stores only clip path, transcript, source, license and a fixed `expected: null`; it omits speaker ID, gender and raw dataset metadata. The public artifact publishes only aggregate metrics, source and limits.

## Reproducible FLEURS download and run

No account is required for the public source used here. The downloader fetches 30 WAV clips through the public Hugging Face datasets-server API, filters transaction/price terms, and checks the 5 MB limit:

```powershell
node evaluation/scripts/download-fleurs-vi-negative.mjs --limit 30 --scan-limit 198
node evaluation/scripts/run-audio-eval.mjs `
  --manifest evaluation/manifests/fleurs-vi-negative.jsonl `
  --output evaluation/results/fleurs-vi-negative-run.jsonl `
  --base-url http://127.0.0.1:3102 --limit 30
node evaluation/scripts/score-results.mjs `
  --expected evaluation/manifests/fleurs-vi-negative.jsonl `
  --actual evaluation/results/fleurs-vi-negative-run.jsonl `
  --report evaluation/results/fleurs-vi-negative-report.json `
  --markdown evaluation/results/fleurs-vi-negative-report.md
node evaluation/scripts/publish-audio-negative-report.mjs
```

The runner creates and deletes an anonymous Firebase session and uses the same `/api/extract` boundary as the product. It does not retry requests automatically.

## Published run: 14/08/2026

Using `gemini-2.5-flash` through the product API, the paired FLEURS negative-control run produced:

- 30 evaluation samples: 15 original clear public clips and 15 deterministic white-noise variants of the same source clips at **20 dB SNR**; 0 transaction labels.
- 29/30 valid requests rejected as non-transactions: **96.67%**.
- Clear: 14/15 (**93.33%**); noisy: 15/15 (**100%**).
- 1/30 clear request returned HTTP 502 (`Gemini temporarily could not process this audio`) and is counted as a failure, not a correct rejection.
- 0 invalid JSON responses among successfully parsed API responses.

The sanitized report is [fleurs-vi-negative-clear-noisy-latest.json](../public/evaluation/fleurs-vi-negative-clear-noisy-latest.json). It contains no raw audio, transcript, speaker metadata, model response or API key.
## Current limitation

Gemini TTS returned `content_blocked` on 13/08/2026, so the project has no transaction-audio report and makes no transaction-voice accuracy claim. Public FLEURS negative-control data cannot substitute for a transaction benchmark.

## Clear versus noisy

The FLEURS run uses each source clip once unchanged and once with a deterministic white-noise transform at 20 dB SNR. `build-fleurs-clear-noisy-manifest.mjs` records its seed and SNR in the local manifest, while the public artifact contains only aggregate results. `score-results.mjs` publishes the total result and `byCondition.clear` / `byCondition.noisy`; the conditions are reported separately, not averaged away.

When valid transaction audio becomes available, its manifest must also set `condition` to `clear` or `noisy`, keep schema coverage the same in both groups, and fix expected labels before API calls. Never label a clip noisy merely because the model failed.