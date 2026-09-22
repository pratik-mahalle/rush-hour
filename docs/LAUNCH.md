# Launch drafts

These are drafts to edit and publish yourself. They describe the current prototype; receipt printing and phone support are roadmap items.

## LinkedIn

What if making a bill at a busy food counter started with “Do chai, ek samosa”?

I've open-sourced Rush Hour: a voice-first billing prototype powered by Sarvam AI.

The current Mac assistant lives in the menu bar. Click it, speak an order, correct a quantity, and ask for the total. A separate browser lab lets you inspect order changes and replay failure scenarios.

One design decision: the language model interprets the order, but application code owns prices and totals. Proposed changes are validated as a complete transaction before they reach the bill.

Built so far:
• Realtime voice input in the Mac assistant
• Order corrections, exact menu totals, undo, and saved bills
• A browser lab with transaction traces and text evaluation scenarios
• 45 automated billing/domain checks across the two implementations

It's an early prototype, not a production POS. Next I want to test it with shop owners, integrate one receipt printer, and learn whether Android or Windows is the right next platform.

Code and setup: https://github.com/pratik-mahalle/rush-hour

If you run a small food counter—or build voice applications—I'd value feedback on the workflow and where it breaks.

#OpenSource #VoiceAI #SarvamAI #BuildInPublic

## X / Twitter

I open-sourced Rush Hour: speak an order, correct it, hear the bill.

Built with Sarvam. The model interprets; code calculates.

Mac prototype + browser lab. Printer/Android support are next experiments.

https://github.com/pratik-mahalle/rush-hour

## Suggested demo video

Record a real interaction without hiding latency or failures:

1. Click the menu-bar icon and let the assistant ask for an order.
2. Say “Do chai, ek samosa.” Show the bill at ₹60.
3. Say “Ek chai hatao.” Show ₹40.
4. Ask for the total, then say “Next customer.”
5. End with the repository and a short “Early prototype” label.

Show “View bill” explicitly if you open the window; the icon itself starts voice. Do not imply a paper receipt prints yet. Use a synthetic order and keep API keys, personal data, and background conversations out of the recording. If live speech fails, show or explain the failure rather than labeling a local demo as a successful live run.
