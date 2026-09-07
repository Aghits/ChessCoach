# Tasks: ChessPrinciple AI

- [x] Task 1: Initialize Project & Base Styling
  - Acceptance: Vite + React 19 + TypeScript + Tailwind CSS project initialized and builds cleanly (`npm run build`).
  - Verify: Run `npm run build` with zero TypeScript or build errors.
  - Files: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `src/index.css`, `src/main.tsx`

- [x] Task 2: Settings & Provider Storage (`settings-storage`)
  - Acceptance: User can open settings modal, choose between Google Gemini, Groq, or OpenRouter Free, input API key, and persist to `localStorage`.
  - Verify: Save key, refresh page, key remains saved in state/storage.
  - Files: `src/lib/settings/storage.ts`, `src/components/Settings/SettingsModal.tsx`

- [x] Task 3: Chess.com Game Importer (`game-importer`)
  - Acceptance: User can enter a Chess.com username, fetch the current/previous month's archives, view a list of recent games with opponent/result/speed, and select one to load into the board.
  - Verify: Enter a real Chess.com handle (e.g., `hikaru`), verify recent games list loads with metadata and valid PGNs.
  - Files: `src/lib/chesscom/api.ts`, `src/components/Importer/ChessComModal.tsx`, `src/components/Importer/PgnInput.tsx`

- [x] Task 4: Interactive Board & Move Navigation (`board-evaluator`)
  - Acceptance: Board renders pieces cleanly, allows clicking/scrubbing through move history (forward, backward, jump to move), flips board orientation, and shows move list with current turn indicator.
  - Verify: Load PGN, click next/previous buttons and arrow keys, board updates correctly with legal positions.
  - Files: `src/components/Board/ChessBoardView.tsx`, `src/components/Board/MoveList.tsx`, `src/lib/chess/types.ts`

- [x] Task 5: Stockfish WASM Web Worker & Eval Bar (`board-evaluator`)
  - Acceptance: Stockfish WASM initializes in a Web Worker, streams depth evaluation, updates an interactive vertical eval bar, and tags moves as Best, Inaccuracy, Mistake, or Blunder.
  - Verify: Move to a known blunder position, verify eval bar flips and move gets tagged with appropriate badge.
  - Files: `public/stockfish/stockfish.js`, `src/lib/chess/engineWorker.ts`, `src/components/Board/EvalBar.tsx`

- [x] Task 6: Deterministic Positional Feature Extractor (`feature-extractor`)
  - Acceptance: Analyzes FEN with `chess.js` and extracts: isolated pawns, doubled pawns, outpost squares, loose/undefended pieces, and bishop pair status.
  - Verify: Unit test with known FENs (e.g. French Winawer, IQP position) returns expected feature flags.
  - Files: `src/lib/chess/featureExtractor.ts`, `tests/featureExtractor.test.ts`

- [x] Task 7: AI Prompt Engine, Anti-Hallucination Guardrail & Coaching Card (`coach-explainer`)
  - Acceptance: Sends fact-locked prompt to Gemini/Groq/OpenRouter, verifies mentioned squares using regex guardrail, and renders the "Diagnosis + Actionable Pocket Rule" card in the UI.
  - Verify: Click "Explain" on a blunder, card displays 2-sentence diagnosis, bold pocket rule, and suggested engine refutation.
  - Files: `src/lib/ai/client.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/guardrail.ts`, `src/components/Coach/CoachCard.tsx`

- [x] Task 8: End-to-End Verification & Anti-Slop Design Audit
  - Acceptance: Complete user flow (fetch game -> review blunders -> receive actionable coaching rule -> test engine move) works smoothly with zero console errors. Design audited against anti-slop rules (clean typography, zero gratuitous glows/pill gradients).
  - Verify: Test real Chess.com game import, verify full keyboard navigation, verify clean build.
  - Files: `src/App.tsx`, `walkthrough.md`
