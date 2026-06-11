# AGENTS.md

## Development Flow

This repository patches upstream Codex Desktop bundles after `app.asar` extraction.

Recommended Windows workflow:

```powershell
npm install
npm run sync -- --skip-mac
npm run patch:win
npm run dev
```

Daily development usually only needs:

```powershell
npm run dev
```

`npm run dev` repacks `src/win/_asar` into `app.asar`, copies it into the local Owl runtime cache, and launches Codex with isolated user data under `.codex-dev-user-data`.

## Patch Workflow

- Treat `src/{platform}/_asar` as extracted upstream output, not normal source.
- Make exploratory edits in `src/win/_asar` first.
- Once an edit works, move the logic into a repeatable `scripts/patch-*.js`.
- Add new patch scripts to `scripts/patch-all.js`.
- Verify with `node scripts/<patch>.js win --check`, then `npm run patch:win`.
- After any fresh `npm run sync -- --skip-mac`, run `npm run patch:win` before `npm run dev`.

For feature work, prefer this loop:

1. Copy modified files into a temp snapshot directory.
2. Re-run sync to get clean upstream output.
3. Compare the snapshot with clean `src/win/_asar`.
4. Convert the diff into a stable patch script.

Prefer AST or structural matching when possible. If string replacement is necessary, keep patterns short, unique, and idempotent.

## Notes

- Do not edit `.codex-runtime/win/app/resources/app.asar` directly; it is overwritten by `npm run dev`.
- `src/`, `.codex-runtime/`, `.codex-dev-user-data/`, and dev logs are local generated artifacts.
- Remote Control authentication warnings during dev are expected when the official ChatGPT remote-control websocket has no ChatGPT session.
