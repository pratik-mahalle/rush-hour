# Rush Hour

A Hindi/English restaurant voice console built for investigating what happens between a spoken instruction and a correct order.

**Try first:** open the app and choose **Run the rush**. It runs a local, labeled demo with corrections, two customers, an ambiguous payment, and a resolved payment. Open **Event trace** to inspect the state before and after every turn.

## Run locally

Node.js 22.13 or later is required.

```sh
npm ci
npm run dev -- --port 5191
```

Open the local URL printed by the server. No API key is required for demo mode.

For real voice and free-form instructions, select **Connect Sarvam**, paste your key from https://dashboard.sarvam.ai/, and enable live mode. Requests consume your Sarvam credits. The key remains in browser memory for this tab and is sent to this app's same-origin server, then to Sarvam; it is not persisted or exported. Refreshing clears the key, order board, history, results, and traces.

## What works

- Five-item menu with fixed server-validated prices.
- Order tickets across New, Preparing, Ready, and Completed states.
- Paid, Unpaid, and Credit payment states; paid items cannot change until explicitly reopened.
- Atomic action batches: add, remove, annotate a quantity, transfer an item, update payment, and update kitchen status.
- Clarifications for ambiguous item variants, missing customers, and impossible quantities.
- Undo snapshots and immutable event history; JSON exports of the shift, trace, and evaluation results.
- Push-to-talk audio, limited to 20 seconds, sent to Saaras v4. Bulbul v3 reads replies; starting a new recording cancels the old speech request/playback.
- Optional synthetic noise mixed into microphone audio before transcription. It is not a calibrated SNR test or café recording.
- Audio upload (under 25 seconds / 8 MB). Its transcript is processed against the current board.
- Twelve hand-authored text scenarios with actual measured runtime, expected state, result inspection, and export. The same transaction engine validates both modes.
- A read-only WebMCP `read_order_board` tool in supporting browsers.

## Two explicitly different modes

**Demo rules:** a deliberately limited deterministic parser. Supports documented Hindi/English order patterns, quantities, cancellation, no-sugar variants, and payment commands. Unknown instructions ask for clarification. It does not call Sarvam and its evaluation scores are not model results. Examples:

```text
Ravi ke liye do chai
Add three samosas for Ravi
Ravi ek chai cancel
Ravi ke liye ek chai bina shakkar
Ravi ek chai bina shakkar cancel
Ravi paid
Meera udhaar mein daal
रवि के लिए दो चाय
```

**Sarvam mode:** recorded audio → `saaras:v4` → transcript → `sarvam-105b-conversations` → proposed JSON actions → Zod schemas and atomic reducer → committed state → `bulbul:v3`. Live errors are visible and do not fall back silently to demo rules. A configured key is not shown as verified; the first request reports account/model access failures.

## Architecture

```text
Browser microphone / typed instruction
              |
     /api/transcribe (audio only)
              |
     /api/agent + current state + recent conversation
              |
       Proposed structured action batch
              |
     Strict schemas + applyPlan transaction
              |
     Board + append-only trace + undo snapshot
              |
     /api/speak → interruptible audio playback
```

The model proposes operations rather than arbitrary order JSON. Menu prices never come from the model. `applyPlan` clones the state, validates all operations, and returns a new state only when the whole batch succeeds. Server and browser both apply the reducer. No audio or application data is stored in a database; this is a session-scoped playground, not a shared POS.

Key files:

- `lib/domain.ts`: schemas, transaction reducer, bounded demo parser.
- `lib/scenarios.ts`: scenarios and expected-state checks.
- `lib/use-rush-hour.ts`: session orchestration, microphone lifecycle, playback, evaluation, undo, export.
- `app/api/agent/route.ts`: model prompt, response parsing, server transaction validation.
- `app/api/transcribe/route.ts` and `app/api/speak/route.ts`: Sarvam speech adapters.
- `tests/domain.test.ts`: scenarios plus rollback, pricing, transfer, quantity, and payment invariants.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

The automated suite tests domain behavior and deterministic demo scenarios. It does **not** establish Sarvam model quality or speech accuracy. Run the lab in live mode with a valid API key to produce model measurements. Collect consented human recordings with reference transcripts before claiming ASR accuracy; none are fabricated or bundled here.

## Honest limits

This release uses short REST recordings, not continuous WebSocket streaming or automatic voice activity detection. Interruption stops output playback; it does not implement full-duplex turn detection. There is no overlapping-speaker attribution. Live Sarvam calls require the user's key and must be verified on that account. The initial sample orders are fictional and not measured usage.

State is held per tab. JSON exports are the preservation mechanism. The app does not take actual payments, reserve inventory, identify real customers, or handle concurrent cashiers. A production POS would need persistent authorized server state, idempotency, rate limits, conflict control, a payment provider, and audit retention.

## References

- Saaras: https://docs.sarvam.ai/api/getting-started/models/saaras
- Chat: https://docs.sarvam.ai/api-reference/chat/chat-completions-v1
- Speech input: https://docs.sarvam.ai/api-reference/speech-to-text/transcribe
- Speech output: https://docs.sarvam.ai/api-reference/text-to-speech/convert
