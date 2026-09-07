# Changelog

All notable changes to ChessCoach will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-07

### Added
- **Game Review & PGN Import**: Import games directly from Chess.com by username or paste custom PGNs.
- **Stockfish 16 Lite Engine**: In-browser WASM engine for fast client-side positional evaluation and best-move analysis.
- **Silman Imbalances Framework**: Classification of positions across Material, Minor Pieces, Pawn Structure, Space, and Initiative.
- **AI Coach Explanations**: Grounded principle-based move explanations powered by OpenRouter / Gemini.
- **Anti-Hallucination Guardrail**: Deterministic attacker-defender extraction via chess.js and piece-on-square verification to eliminate phantom chess pieces.
- **Interactive Move Navigation**: Full move list with engine eval bar, move classification tags, and best move visual arrow.
