# ChessCoach

ChessCoach is a fast, client-side chess game review application and AI coach. It evaluates games using an in-browser Stockfish 16 WebAssembly engine and translates engine data into practical, memorable chess advice grounded in Jeremy Silman's imbalances framework.

---

## Features

- **Full Game Review**: Classifies every move automatically (Masterstroke, Optimal, Theoretical, Inaccuracy, Tactical Slip, Missed Tactic, Critical Blunder).
- **Client-Side Stockfish 16 Lite Engine**: Runs locally in Web Workers using WebAssembly with real-time evaluation and principal variation (PV) calculations.
- **Silman Imbalance Framework**: Detects key position imbalances across Material, Superior Minor Piece, Pawn Structure, Space, and Initiative.
- **Fact-Locked AI Coaching**: Explains the difference between candidate moves and provides practical pocket principles.
- **Anti-Hallucination Guardrails**: Deterministic attack geometry extraction via `chess.js` and multi-state board validation prevent the AI from inventing phantom pieces or impossible attacks.
- **Chess.com Game Importer**: Fetch and review recent games directly by username or paste custom PGNs.
- **Deterministic Offline Fallback**: Fully functional without an API key using built-in positional heuristic engines.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Chess Logic & Board**: `chess.js`, `react-chessboard`
- **Engine**: Stockfish 16 Lite (WASM / Web Worker)
- **Testing**: Vitest (69 automated unit tests)

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Aghits/ChessCoach.git
   cd ChessCoach
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite dev server with Hot Module Replacement |
| `npm run build` | Compiles TypeScript and builds optimized production bundle |
| `npm run test` | Runs the full Vitest automated test suite |
| `npm run preview` | Previews the production build locally |

---

## AI Configuration

ChessCoach supports several AI providers:
- **OpenRouter** (Default preset: `openrouter/free`)
- **Google Gemini** (`gemini-2.5-flash`)
- **Groq Cloud** (`llama-3.3-70b-versatile`)
- **Custom OpenAI-compatible endpoints**

### Setting Your API Key

1. Click the **Settings** gear icon in the top header.
2. Select your provider, paste your API key, and click **Save Settings**.
3. Keys are stored locally in your browser's private `localStorage` and are never committed or transmitted to any third-party server.

Alternatively, you can provide an optional `.env` file:
```env
VITE_AI_API_KEY=your_key_here
```

---

## Architecture & Anti-Hallucination Guardrail

Large Language Models often struggle with 64-square spatial geometry. ChessCoach uses a layered architecture to guarantee factual accuracy:

1. **Deterministic Feature Extraction**: Before the AI is called, `chess.js` computes exact attacker-defender relationships, hanging pieces, and move attack vectors.
2. **Fact-Locked Prompting**: The system prompt separates the blunder's refutation from the engine's recommendation and restricts the model to verified board facts.
3. **Piece-on-Square Guardrail**: Validates generated claims against board states (before move, after move, and after engine line). Any response referencing phantom pieces is automatically intercepted and routed to the deterministic engine heuristic.

---

## License

MIT
