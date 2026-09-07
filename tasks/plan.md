# Technical Implementation Plan: ChessPrinciple AI

## Architecture Overview
ChessPrinciple AI is a client-side web application designed to run with zero server operational costs. It couples a WebAssembly Stockfish engine running in a Web Worker with a deterministic chess feature extractor and an OpenAI-compatible LLM connector.

```
┌────────────────────────────────────────────────────────┐
│                   React Frontend UI                    │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  ChessBoard & Eval   │    │  Coach "Pocket Rule" │  │
│  │      Component       │    │     Card Display     │  │
│  └──────────▲───────────┘    └──────────▲───────────┘  │
└─────────────┼───────────────────────────┼──────────────┘
              │                           │
              ▼                           ▼
    ┌──────────────────┐        ┌──────────────────┐
    │  Stockfish WASM  │        │ LLM Prompt &     │
    │    Web Worker    │        │ Anti-Hallucinate │
    │   (UCI stream)   │        │ Guardrail Client │
    └─────────┬────────┘        └─────────▲────────┘
              │                           │
              └───────────────┬───────────┘
                              ▼
                  ┌──────────────────────┐
                  │ Deterministic Pos.   │
                  │ Extractor (chess.js) │
                  └──────────────────────┘
```

---

## 1. Major Components & Dependencies

1. **`settings-storage`**:
   - Manages user API key for Google Gemini / Groq / OpenRouter in `localStorage`.
   - Dependency: None.

2. **`game-importer`**:
   - Calls `https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}` to fetch monthly game archives.
   - Parses PGN metadata (White, Black, Result, TimeControl, PGN text).
   - Dependency: None.

3. **`board-evaluator`**:
   - Hosts Stockfish 16/17 WASM in a dedicated Web Worker via standard UCI protocol (`position fen ...`, `go depth 16`).
   - Parses UCI output: `info depth 16 score cp 120 pv e2e4 ...`
   - Maps score deltas to move classifications:
     - Blunder: $\Delta \ge 2.0$ or missed mate
     - Mistake: $0.9 \le \Delta < 2.0$
     - Inaccuracy: $0.4 \le \Delta < 0.9$
     - Good / Best: $\Delta < 0.4$
   - Dependency: `game-importer`.

4. **`feature-extractor`**:
   - Deterministic board analysis using `chess.js`:
     - Checks pawn structures: Isolated Queen Pawn (d4/d5 without c/e pawns), doubled pawns, backward pawns, passed pawns.
     - Detects loose/undefended pieces (pieces attacked by nothing or defended equal to attacks).
     - Identifies piece outposts (squares on 4th–6th rank that cannot be attacked by opponent pawns).
     - Identifies bishop pair imbalances and color complex control.
   - Dependency: `board-evaluator`.

5. **`coach-explainer`**:
   - Assembles the fact-locked prompt with verified moves, eval delta, and structural features.
   - Dispatches request to the user's selected free provider.
   - Validates JSON output and executes square verification guardrail.
   - Renders the "Diagnosis + Actionable Pocket Rule" card.
   - Dependency: `feature-extractor`, `settings-storage`.

---

## 2. Implementation Order
1. **Phase 1 (Scaffolding & Core Types):** Initialize Vite + React + TypeScript + Tailwind CSS workspace. Configure base layout and project types.
2. **Phase 2 (Settings & Chess.com Importer):** Build API key storage and Chess.com game fetching modal.
3. **Phase 3 (Board & Stockfish WASM):** Set up Stockfish WASM in a Web Worker, integrate `react-chessboard` with `chess.js`, and build real-time eval bar + move scrubber.
4. **Phase 4 (Deterministic Feature Extractor):** Implement structural checks (isolated pawns, outposts, loose pieces) and test against standard test positions.
5. **Phase 5 (AI Coaching Engine & Guardrail):** Connect Gemini / Groq / OpenRouter API, create fact-locked prompt, add regex square guardrail, and build the "Diagnosis + Pocket Rule" UI card.
6. **Phase 6 (Verification & Polish):** End-to-end testing on real Chess.com games, performance verification, and Anti-Slop UI audit.

---

## 3. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Stockfish WASM files are large or slow to initialize | Use pre-compiled Stockfish 16 Lite / NNUE WASM (~5MB), lazy-load in background Web Worker, show subtle loading indicator until ready. |
| Chess.com API rate limiting or CORS blocking | Chess.com's public data API natively supports CORS (`Access-Control-Allow-Origin: *`). Add local caching in memory/sessionStorage so repeated clicks don't re-fetch. |
| LLM rate limits on free tiers (Gemini 15 RPM / OpenRouter) | Debounce explanation requests: only call the AI when the user explicitly clicks "Explain Move", rather than auto-calling for every move in the background. |
| UI thread freezing during deep search | Stockfish runs strictly inside a Web Worker. The main thread only receives non-blocking message events. |

---

## 4. Verification Checkpoints
- **Checkpoint 1:** Can fetch any public Chess.com user's recent games and load the PGN into `chess.js`.
- **Checkpoint 2:** Stockfish worker calculates depth 16 on any FEN and emits UCI eval within 1 second without dropping UI frames.
- **Checkpoint 3:** Feature extractor correctly identifies an isolated pawn and loose knight on a known test FEN.
- **Checkpoint 4:** Explaining a blunder returns valid JSON with zero hallucinated squares and renders both the Diagnosis and the Pocket Rule.
