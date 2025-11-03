## Quick context for automated code assistants

This repository implements a circular audio waveform visualizer and player. The codebase is organized as a small web app (plain HTML/CSS/JS) with modern tooling (Vite) and automated tests (Vitest unit tests + Playwright E2E). Use this file as the single-source guide for making safe, effective edits.

Key locations
- `package.json` — npm scripts and primary dev/test commands. Important scripts: `dev`, `build`, `preview`, `test` (Vitest), `test:coverage`, `test:e2e` (Playwright).
- `js/` — primary application source. Look here first for behavior to change. Notable modules:
  - `js/audio-loader.js` — loads audio files and creates buffers
  - `js/waveform-data.js` — downsampling, caching and window preparation logic
  - `js/waveform-draw.js` & `js/spiral-waveform-player.js` — rendering and player wiring
  - `js/canvas-math.js` — geometric helpers (polar/cartesian conversions) used by rendering
  - `js/state-manager.js` — application state container and cloning logic
  - `js/utils.js` & `js/validation.js` — small pure helpers and validators, heavily tested
- `test/` — unit tests. Use this to learn expected behaviors and edge-cases. Tests are authoritative for small pure functions (e.g., `utils`, `canvas-math`, `waveform-data`).

Big-picture architecture (high level)
- Source of truth: `state-manager.js` keeps application state; UI modules read from it or receive slices via adapters (`audio-state-adapter.js`, `interaction-state-adapter.js`, `visual-state-adapter.js`).
- Audio flow: `audio-loader.js` -> WebAudio `AudioBuffer` -> `waveform-data.js` (downsample/cache) -> renderer (`waveform-draw.js` / `spiral-waveform-player.js`).
- Rendering flow: `canvas-math.js` provides coordinate math; `waveform-draw.js` converts downsampled waveform arrays into canvas draw calls. Keep heavy math in `canvas-math.js` so tests can cover it.

Project-specific conventions and patterns
- File prefixes: audio-*, waveform-*, canvas-*, ui-* correspond to clear responsibilities. Prefer new module names following this pattern.
- Pure functions in `js/utils.js`, `js/canvas-math.js` and `js/waveform-data.js` are unit-tested; prefer functional, side-effect-free implementations so tests remain simple.
- Web API objects (AudioBuffer, AudioContext, HTMLElement) are treated as external references in `state-manager.js` (they should not be deep-cloned). If adding clone logic, guard with `instanceof` checks.
- Tests use `happy-dom` for DOM-ish behavior and expect Node test environment to be shimmed for Web Audio objects; unit tests currently assume Audio globals may be absent — prefer adding test setup shims (see Testing notes below) rather than changing core code to satisfy Node test environment.

Module responsibility rules (refactored architecture)
- **Loader logic in audio-loader.js**: All file and URL loading, format detection, fetch/decode/fallback strategies. Never duplicate URL loading logic elsewhere.
- **Waveform generation/downsampling in waveform-data.js**: All waveform processing, placeholder generation, caching. Use `generatePlaceholderWaveform()` for synthetic waveforms.
- **Playback lifecycle in audio-playback.js**: Low-level WebAudio operations. Higher-level control in audio-controls.js.
- **No writes to `window.*` for functional state**: Use explicit debug methods (e.g., `player.getUrlAudioElement()`) behind dev-only flags. The `window.urlAudioElement` global is deprecated (kept for backward compatibility temporarily).

Testing & developer workflows (explicit commands and tips)
- Install: `npm install` (run once).
- Dev server: `npm run dev` (Vite) — fast hot-reload environment.
- Build: `npm run build`; analyze output: `npm run analyze` opens `dist/stats.html` (bundle visualizer).
- Unit tests: `npm test` (Vitest). Run a single file: `npx vitest run test/waveform-data.test.js`.
- Coverage: `npm run test:coverage` — outputs coverage into `coverage/` and `coverage/lcov-report/`.
- E2E: `npm run test:e2e` (Playwright). Playwright runs a local server and executes browser-driven tests; report is in `playwright-report/`.

Common pitfalls encountered in this repo
- Some tests (audio-related) fail under Node because Web Audio globals are not present. Add a test setup shim (e.g., `test/setup.js`) that sets `global.AudioBuffer` and `global.AudioContext` or install `web-audio-test-api` and expose its constructs to `global` in the setup file.
- Generated artifacts are present in the repository (e.g., `coverage/`, `playwright-report/`, `dist/`). Avoid editing these directly — they are build/test outputs and should be re-generated locally or in CI.
- **CRITICAL: Never add console.log statements inside animation loops or per-frame code** — these spam the console at 60fps and make debugging impossible. Instead:
  - Log only when state changes occur (use conditions like `if (stateChanged && !previousState)`)
  - Log only once using a flag (e.g., `if (!hasLoggedOnce) { console.log(...); hasLoggedOnce = true; }`)
  - Use event-based logging (log on mouseup/mousedown, not mousemove)
  - Prefer debugging with browser DevTools breakpoints over console logging in hot paths

Examples (how to make small, safe changes)
- Fix a bug in a pure util: edit `js/utils.js`, update or add a unit test under `test/` mirroring existing patterns, run `npm test` and ensure tests pass.
- Change rendering math: prefer adding helper functions to `js/canvas-math.js` and unit tests in `test/canvas-math.test.js` rather than directly changing `waveform-draw.js` rendering loops.
- Add a test shim (example `test/setup.js`):
  ```js
  // minimal shim for Audio globals used by tests
  class AudioBuffer {}
  class AudioContext {}
  global.AudioBuffer = AudioBuffer;
  global.AudioContext = AudioContext;
  ```
  Then add `setupFiles: 'test/setup.js'` to `vitest.config.js` or `package.json` test config.

Integration points & external dependencies
- Browser Web APIs: Web Audio (AudioContext/AudioBuffer), Canvas2D. Code expects to run in a browser for E2E flows.
- Dev/test tools: Vite (dev server + build), Vitest + happy-dom (unit tests), Playwright (`@playwright/test`) for E2E.
- Small utilities: `rollup-plugin-visualizer`, `vite-plugin-compression` used in the build pipeline.

Performance rules
- **Do not allocate full sample-rate arrays for visualization**: Downsample to 2k–8k samples via waveform-data.js helpers. Pass `targetSamples` parameter to control output size.
- **No console logging inside animation loops**: See "Common pitfalls" section above for correct logging patterns.
- **Use Float32Array for waveform data**: More efficient than standard arrays for large audio samples.

Testing rules
- **Add `test/setup.js` shim for WebAudio in node tests**: Mock AudioContext/AudioBuffer/AudioNode for unit tests.
- **Mock network and decode calls in loader tests**: Use `vi.fn()` to mock `fetch()` and `AudioContextManager.decodeAudioData()`.
- **Test new logic with focused unit tests**: Add tests for any moved or new functions (e.g., `generatePlaceholderWaveform`, `loadAudioFromUrl`).

When editing, prefer these safety checks
- Run unit tests (`npm test`) after changes. If audio-related tests fail, add/adjust the test setup shim rather than change production code to satisfy Node test environment.
- Re-run E2E (`npm run test:e2e`) only after unit tests are green — E2E is slower and brittle when UI changes are frequent.
- Avoid committing generated files (`coverage/`, `playwright-report/`, `dist/`, `node_modules/`, `test-results/`). These are now in `.gitignore`.

PR expectations
- **Small focused PRs per responsibility**: Separate PRs for loader changes, waveform changes, and UI changes rather than one large PR.
- **Include unit tests for moved logic**: If extracting a function, add tests for it (see `test/waveform-placeholder.test.js` for example).
- **Update docs to reflect module ownership**: Update ARCHITECTURE.md if changing module responsibilities.
- **No new global variables**: Keep state on module instances or use state-manager.js.

If you are an AI agent making a PR
- Keep changes small and focused. Add or update unit tests for all new logic. Reference the exact test file(s) you updated in the PR description.
- For visual or rendering changes, include screenshots or reference Playwright snapshots if updated.
- Mention any dev-tool changes (e.g., adding `web-audio-test-api` or a new setup file) in the PR and ensure `npm install` is enough to reproduce locally.
- Run `npm test` and `npm run test:e2e` before submitting. All tests should pass.

Questions for maintainers (leave in PR body)
- Should generated artifacts (`coverage/`, `playwright-report/`, `dist/`) be removed from the repo and added to `.gitignore`? There are committed reports present which bloat the history.
- Do you prefer the minimal Audio shim in tests or a proper `web-audio-test-api` dependency for more realistic audio tests?

If anything here is unclear or you want this shortened/expanded, tell me which areas to update (architecture, tests, or workflows) and I will iterate.
