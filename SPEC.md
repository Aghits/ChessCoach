# SPEC: ChessPrinciple AI

## Phase 0: Capability Map

| Module ID | Responsibility | Depends On |
|---|---|---|
| `settings-storage` | Local browser storage for user API keys (Gemini / Groq / OpenRouter) and active provider settings | — |
| `game-importer` | Fetch recent games via public Chess.com API or parse pasted PGN text | — |
| `board-evaluator` | Interactive chessboard UI + client-side Stockfish WASM worker (depth 16-18, centipawn deltas, blunder/mistake tags) | `game-importer` |
| `feature-extractor` | Deterministic positional fact extractor (pawn structures, loose pieces, outposts, material imbalances) via `chess.js` | `board-evaluator` |
| `coach-explainer` | LLM connector with fact-locked prompt, anti-hallucination regex guardrail, and "Diagnosis + Pocket Rule" card UI | `feature-extractor`, `settings-storage` |

**Build Order:** `settings-storage` → `game-importer` → `board-evaluator` → `feature-extractor` → `coach-explainer`

---

## 1. Objective
Build a zero-server-cost web application for 1600–2100 Elo club chess players. The app imports games from Chess.com, runs client-side Stockfish 16/17 WASM to identify critical turning points, extracts deterministic board imbalances, and generates actionable, memorable coaching tips ("Diagnosis + Actionable Pocket Rule") using free AI APIs (Google Gemini 2.5 Flash, Groq, or OpenRouter Free).

### Core User Stories:
1. As a 1800 player, I want to type my Chess.com username and review my latest Rapid/Blitz games without logging in or paying fees.
2. As a player reviewing a loss, I want to step through moves on an interactive board with an eval bar and immediate blunder/mistake indicators.
3. As a player on a mistake move, I want to click "Explain" and read a 2-sentence breakdown: a concrete diagnosis of the tactical/structural flaw, paired with a memorable pocket rule (e.g., "Loose Pieces Drop Off", "Opposite-Color Harmony", "Activate the Lazy Piece").
4. As a player wanting to verify the solution, I want to click the engine's suggested move and see the refutation played out on the board.

---

## 2. Tech Stack
* **Runtime & Bundler:** Vite 6 + React 19 + TypeScript
* **Styling:** Tailwind CSS (clean, functional design strictly avoiding AI-slop cliches like bloated gradients, cut-off glows, or unnecessary floating cards)
* **Chess State & Rules:** `chess.js` (v1.0.0-beta.6)
* **Board UI:** `react-chessboard`
* **Chess Engine:** Stockfish 16/17 NNUE compiled to WebAssembly (WASM via Web Worker)
* **LLM Client:** Lightweight OpenAI-compatible `fetch` wrapper supporting:
  - Google Gemini 2.5 Flash (via Google AI Studio OpenAI-compatible endpoint)
  - Groq Cloud
  - OpenRouter (`:free` models)
* **Icons:** Standard SVG / minimal icon set (custom or curated)

---

## 3. Commands
* **Dev Server:** `npm run dev` (Runs Vite on `http://localhost:5173`)
* **Build:** `npm run build` (`tsc -b && vite build`)
* **Preview:** `npm run preview`
* **Test:** `npm run test` (Vitest for feature-extractor and guardrail tests)
* **Lint:** `npm run lint` (ESLint)

---

## 4. Project Structure
```
d:/Antigravity Project/ChessCoach/
├── public/
│   ├── stockfish/
│   │   ├── stockfish.js         # Stockfish WASM loader
│   │   └── stockfish.wasm       # Stockfish compiled binary & NNUE
├── src/
│   ├── components/
│   │   ├── Board/
│   │   │   ├── ChessBoardView.tsx  # Board + Move navigation + Arrows
│   │   │   └── EvalBar.tsx         # Centipawn / Win-chance bar
│   │   ├── Coach/
│   │   │   ├── CoachCard.tsx       # Diagnosis + Actionable Pocket Rule card
│   │   │   └── MoveClassBadge.tsx  # Best / Inaccuracy / Mistake / Blunder badges
│   │   ├── Importer/
│   │   │   ├── ChessComModal.tsx   # Username input & recent game list
│   │   │   └── PgnInput.tsx        # Manual PGN paste area
│   │   └── Settings/
│   │       └── SettingsModal.tsx   # API key input & provider select
│   ├── lib/
│   │   ├── chess/
│   │   │   ├── engineWorker.ts     # Stockfish WASM Web Worker wrapper
│   │   │   ├── featureExtractor.ts # Deterministic pawn/imbalance/piece extractor
│   │   │   └── types.ts            # Chess evaluation & analysis types
│   │   ├── chesscom/
│   │   │   └── api.ts              # Chess.com public archives fetcher
│   │   └── ai/
│   │       ├── client.ts           # Unified OpenAI-compatible API client
│   │       ├── prompts.ts          # Fact-locked coaching prompt
│   │       └── guardrail.ts        # Regex square validation to eliminate hallucination
│   ├── App.tsx                     # Main layout & analysis workspace
│   ├── index.css                   # Tailwind styles
│   └── main.tsx                    # React root
├── docs/
│   └── ideas/
│       └── chess-coach-ai.md       # Idea refinement one-pager
├── tasks/
│   ├── plan.md                     # Implementation plan
│   └── todo.md                     # Sequential task list
├── package.json
├── tsconfig.json
├── vite.config.ts
└── SPEC.md
```

---

## 5. Code Style & Conventions

### Example: Deterministic Fact-Locked Prompt Construction
```typescript
// Strict type contract: LLM output must conform to this schema
export interface CoachingTip {
  category: 'Piece Coordination' | 'Pawn Structure' | 'Prophylaxis' | 'Tactics' | 'King Safety';
  diagnosis: string;   // 1-2 concrete sentences on the exact board consequence
  pocketRule: string;  // Punchy, memorable heuristic (e.g. "Loose Pieces Drop Off")
  refutationSummary: string; // Brief note on the engine's alternative
}

// Anti-hallucination validation
export function validateSquareMentions(text: string, allowedSquares: Set<string>): boolean {
  const squareMatches = text.match(/\b[a-h][1-8]\b/g) || [];
  for (const sq of squareMatches) {
    if (!allowedSquares.has(sq)) {
      console.warn(`Guardrail triggered: square ${sq} is not in active moveset.`);
      return false;
    }
  }
  return true;
}
```

* **Conventions:**
  - Strict TypeScript everywhere; no `any`.
  - Immutable state updates when handling FEN/PGN history.
  - Zero heavy third-party UI component libraries; lean Tailwind classes with clear semantic structure.
  - All web worker communication is promise-wrapped with timeouts to prevent hanging on heavy depth searches.

---

## 6. Testing Strategy
* **Unit Tests (`tests/featureExtractor.test.ts`):**
  - Verify detection of isolated queen pawn (IQP) on sample FENs.
  - Verify detection of loose/undefended pieces and knight outposts.
* **Unit Tests (`tests/guardrail.test.ts`):**
  - Verify that the guardrail accepts valid squares and rejects hallucinated squares.
* **Integration Verification:**
  - Mock Stockfish WASM UCI stream to ensure `eval` and `bestmove` are parsed correctly.

---

## 7. Boundaries

### Always Do:
* Perform deterministic feature extraction (`chess.js`) before sending anything to the LLM.
* Keep the UI responsive during engine calculations by delegating 100% of compute to a Web Worker.
* Store user API keys exclusively in browser `localStorage`, never transmitting them anywhere except directly to the chosen LLM provider.
* Adhere strictly to the Anti-Slop Design Law: no arbitrary decorative drop shadows, no bloated hero glow blobs, crisp typography, and full keyboard navigation.

### Ask First:
* Introducing any server-side proxy or backend database.
* Adding external heavyweight UI libraries or state management frameworks (Zustand/Redux).

### Never Do:
* Never let the LLM calculate chess moves or guess candidate lines.
* Never display raw ungrounded engine numbers without a human explanation.
* Never hardcode proprietary API keys in source files.

---

## 8. Success Criteria
1. **Import:** Typing a public Chess.com username loads their last 10 games in under 1 second.
2. **Analysis:** Stepping through a game triggers Stockfish WASM at depth 16+ within 600ms per move without UI jank.
3. **Coaching Quality:** At every inaccuracy/mistake, clicking "Explain" generates a structured response with:
   - A concrete diagnosis (referencing only actual played/engine squares).
   - An actionable pocket rule (e.g., LPDO, opposite-color harmony, active pieces).
4. **Anti-Hallucination:** 100% of generated squares in the diagnosis match the verified legal move context.
5. **Zero Hosting Cost:** Runs completely as a static client application on GitHub Pages / Vercel / Netlify with no backend server.

---

## 9. Assumptions Made
1. Modern browsers (Chrome, Firefox, Safari, Edge) supporting WebAssembly and Web Workers.
2. User provides their own free API key (Google Gemini from Google AI Studio, Groq, or OpenRouter) in the settings modal.
3. Chess.com public archives API remains open and CORS-accessible without auth tokens.
