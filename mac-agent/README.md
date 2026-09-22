# Rush Hour Counter — native Mac agent

A small, persistent restaurant counter assistant. Open it, connect Sarvam, start listening once, and speak orders without a record button. Closing the window leaves the app in the menu bar. It processes one current customer's bill and speaks the exact amount.

## Run

Build with `./mac-agent/build.sh` from the repository root, then open `mac-agent/build/Rush Hour Counter.app`. Requires macOS 14 or later and Xcode Command Line Tools. The build targets your Mac’s architecture and is locally ad-hoc signed, not notarized for public distribution. Prebuilt binaries are not included in this repository.

1. Right-click the Rush menu-bar icon, choose **Connection settings**, and save your own Sarvam API key. It is stored in macOS Keychain, not the source or web browser.
2. Click the Rush menu-bar icon (or reopen the app from the Dock). It connects the microphone, asks **“What would you like to order?”**, and listens without opening the bill window. Allow the microphone prompt on first use.
3. Say “do chai, ek samosa” → bill ₹60.
4. Say “ek chai hatao” → bill ₹40.
5. Say “total kitna hua?” → spoken total ₹40; the order stays open.
6. Say “next customer” → speaks final ₹40, saves a completed bill, starts a fresh bill.
7. Right-click the icon for **View bill**, **Pause listening**, or **Connection settings**. Launching the app, clicking its menu-bar icon, and reopening from the Dock invoke voice directly. If no key is configured, a spoken setup instruction tells you where to connect it; no panel opens automatically.

Use **Try a demo first** without an API key. The two example buttons, `total`, `undo`, and `next customer` exercise a bounded local fixture parser. Demo mode does not access the microphone, make API calls, play generated audio, or overwrite live bills. It does not represent tested speech recognition.

To rebuild (Xcode Command Line Tools required):

```sh
cd mac-agent
./build.sh
```

This compiles a small SwiftUI/AppKit app for the current machine's architecture. It has no third-party dependencies. It does not install itself or enable login startup. Add the app in macOS Login Items if you want it to launch at login; launching or clicking the app invokes voice and starts listening when a key is configured.

## Behavior

- A left-click invokes voice directly; a right-click opens controls. The bill window is created only when explicitly requested. Microphone capture continues with the window closed while the Mac is awake.
- The short activation prompt uses the Mac system voice without a TTS network request. Order confirmations and totals continue to use Sarvam Bulbul. The microphone is muted during the prompt to avoid hearing itself.
- Continuous 16 kHz mono PCM streaming to Sarvam Saaras v4's realtime WebSocket endpoint, with partial transcripts and server voice activity detection. Turns finish after 650 ms of silence.
- Sarvam 105B converts each final transcript into a restricted instruction. Current bill and recent turns accompany each request.
- Native validation applies every instruction atomically. Only menu SKUs, bounded integer quantities and explicit notes are allowed. Ambiguous variants and unsupported requests leave the bill unchanged.
- Prices and totals are computed in Swift. Model-supplied prices or unexpected fields are rejected.
- Bulbul v3 speaks confirmations and totals in English. Input auto-detection supports Hindi, Marathi and English, among other Sarvam languages.
- Live orders and the latest 50 completed bills are saved atomically in `~/Library/Application Support/RushHourCounter/bill.json`. This data is separate from the earlier web dashboard. Recent conversation and undo snapshots stay in memory.
- Undo includes the last checkout. Export produces a plain-text bill for the current order or the last completed one. Checkout does **not** record payment or charge anyone.
- Pause cancels the speech connection, pending reasoning, playback, and queued turns. Session IDs prevent late responses from mutating newer state.
- Sleep, microphone changes, network failure and audio backpressure pause listening with a visible message. Restart explicitly; unfinished bills are preserved.

## Current menu

| Item | Price |
| --- | ---: |
| Masala chai | ₹20 |
| Samosa | ₹20 |
| Vada pav | ₹30 |
| Filter coffee | ₹35 |
| Bun maska | ₹35 |

Menu definitions live in `Sources/Billing.swift`. This prototype has one current bill; it does not implement taxes, discounts, payments or multi-customer routing.

## Listening boundaries

This is an awake-Mac counter assistant, **not an offline wake-word engine**. While listening is on, ambient microphone audio goes to Sarvam and incurs your API usage. No raw audio is stored by this app. It has no “Hey Siri” OS integration. Microphone content is replaced with silence during spoken playback plus a 400 ms speaker-tail guard, so this first build is half-duplex and does not support talking over its reply. Unrelated speech is filtered by the order prompt, not a guaranteed speaker-isolation system. Use a close microphone in a busy shop.

It does not keep listening during sleep or a locked phone screen. No Android or iPhone app has been built yet. Background microphone behavior needs a separate native implementation for each platform.

## Validation

```sh
./test.sh
```

20 native billing tests cover the Hindi example, corrections, exact totals, checkout, quantity bounds, atomic rollback, variant ambiguity, malicious/invalid model fields, persisted state validation, and bounded receipt retention. Native UI checks exercised demo add → remove → checkout with ₹60 → ₹40 → fresh bill. The automated suite does not test live recognition, model quality, network latency or TTS; those require your own key and device testing. The demo is not a voice accuracy benchmark.

## Architecture and references

`AVAudioEngine` → `AVAudioConverter` → authenticated `URLSessionWebSocketTask` → final transcript queue → Sarvam chat → strict `BillPlan` → atomic `BillState` → Bulbul → `AVAudioPlayer`.

- [Sarvam realtime streaming protocol](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming)
- [Sarvam realtime endpoint and authentication](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe/realtime/ws)
- [Apple AVAudioEngine](https://developer.apple.com/documentation/avfaudio/avaudioengine)
- [Apple MenuBarExtra](https://developer.apple.com/documentation/swiftui/menubarextra)

Before sharing a downloadable release publicly, use Developer ID signing/notarization and test live audio on the target Macs.
