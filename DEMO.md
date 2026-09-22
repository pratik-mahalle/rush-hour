# A 90-second Rush Hour demo

Start with a fresh shift using Reset → Start empty. For live speech, connect your Sarvam key first. The same script can be typed in demo mode.

1. **Place an order:** “Sharma ji ke liye do chai aur teen samose.” Expected: 2 chai, 3 samosa, ₹100.
2. **Change your mind:** “Sharma ji ek chai cancel.” Expected: 1 chai, 3 samosa, ₹80. No duplicate order.
3. **Add another customer:** “Priya ke liye do vada pav.” Expected: Priya ₹60; Sharma ji still ₹80.
4. **Introduce ambiguity:** “Unka payment ho gaya.” Expected: a question; neither payment state changes.
5. **Resolve explicitly:** “Sharma ji paid.” Expected: only Sharma ji marked paid.
6. **Inspect the trace:** open the clarification event. Show the empty actions array and identical before/after states. Open the cancellation to show exactly one item removed.
7. **Undo:** return to the floor and undo the payment change. Show the restored state and a new undo event.
8. **Evaluate:** open Break my agent, run all twelve text scenarios, expand a result, and export the run. Clearly identify whether this run uses local demo rules or Sarvam.

## Explain the engineering decision

“I separate language interpretation from state mutation. The model proposes typed actions. A deterministic reducer owns prices, quantities, payment invariants, and atomic commits. Ambiguous instructions ask questions before mutating the board. I can replay the same scenario and inspect both successful and failed outcomes.”

## What to measure next with real recordings

Report final-state success, incorrect mutation rate, clarification frequency, and p50/p95 time from recording stop to a committed response. Keep ASR and reasoning failures separate. Use a consented held-out set containing real speakers, accents, code-switches, and corrections. Publish sample size and failure examples. Do not present the local rule tests as model performance.

## Current project evidence

The repository includes executable transaction tests and twelve hand-authored text cases. There is no claimed human-audio benchmark, live Sarvam score, or verified production latency until you run those experiments with a valid key.
