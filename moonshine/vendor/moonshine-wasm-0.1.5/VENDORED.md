# Vendored: @moonshine-ai/moonshine-wasm 0.1.5

- Source: `npm pack @moonshine-ai/moonshine-wasm@0.1.5` (published 2026-08-24, MIT)
- Copied: `dist/*.js`, `dist/moonshine.mjs`, `dist/moonshine.wasm`, `README.md`
- Left out: `*.d.ts`, `*.map`
- Kept in the repo (not loaded from a CDN) so that the pthread workers
  (`new Worker(moonshine.mjs)`) are created from the same origin.
