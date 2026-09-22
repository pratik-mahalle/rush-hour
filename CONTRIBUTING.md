# Contributing to Rush Hour

Thanks for helping make voice billing more useful and reliable.

## Before changing code

For a substantial feature, open an issue describing the user problem and proposed scope. The project currently has two separate implementations: a native Mac assistant and a browser lab. State which one your contribution affects.

## Local checks

- Native changes: run `./mac-agent/test.sh` and `./mac-agent/build.sh` on macOS 14+.
- Web changes: run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`.
- Use no-key demo mode unless you intentionally want to use your own Sarvam credits.

## Helpful reports

Provide your OS, the starting bill, a synthetic instruction, expected result, actual result, and whether you used demo or live mode. Include the relevant model if known. Do not attach keys, real customer audio, personal bills, or screenshots containing sensitive data. Use recordings only when everyone involved has consented to the intended sharing.

## Implementation principles

- Application code owns prices and totals; model output never does.
- Validate the whole change before committing any part of it.
- Ask for clarification rather than guessing ambiguous quantities or variants.
- Keep demo fixtures visibly distinct from live model behavior.
- Do not claim support for an OS, printer, or language quality level without evidence.
- Add regression tests when fixing a billing or cancellation bug.

Submit a focused pull request explaining the behavior change, how it was checked, and remaining limitations. Contributions are provided under the repository's MIT license; third-party notices must be preserved.

## Security reports

Do not post exploitable vulnerabilities or credentials in public issues. Use GitHub's private vulnerability reporting feature if available on this repository.
