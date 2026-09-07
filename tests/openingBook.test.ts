import { describe, it, expect } from 'vitest';
import {
  getOpeningByFen,
  isBookPosition,
  shouldAnalyzeMove,
} from '../src/lib/chess/openingBook';

describe('Opening Book & ECO Recognition (TDD)', () => {
  it('identifies King Pawn Opening (1. e4)', () => {
    // FEN after 1. e4: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const opening = getOpeningByFen(fen);
    expect(opening).not.toBeNull();
    expect(opening?.eco).toBeDefined();
    expect(isBookPosition(fen)).toBe(true);
  });

  it('identifies Sicilian Defense (1. e4 c5)', () => {
    // FEN after 1. e4 c5: rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2
    const fen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const opening = getOpeningByFen(fen);
    expect(opening).not.toBeNull();
    expect(opening?.name).toContain('Sicilian Defense');
    expect(opening?.eco).toBe('B20');
  });

  it('identifies deep opening line (Sicilian Najdorf 5... a6)', () => {
    // FEN after 1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6
    const fen = 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6';
    const opening = getOpeningByFen(fen);
    expect(opening).not.toBeNull();
    expect(opening?.name).toBe('Sicilian Defense: Najdorf Variation');
    expect(opening?.eco).toBe('B90');
    expect(isBookPosition(fen)).toBe(true);
  });

  it('identifies Ruy Lopez (1. e4 e5 2. Nf3 Nc6 3. Bb5)', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
    const opening = getOpeningByFen(fen);
    expect(opening).not.toBeNull();
    expect(opening?.name).toContain('Ruy Lopez');
    expect(isBookPosition(fen)).toBe(true);
  });

  it('detects when position goes out of book', () => {
    // Absurd random pawn moves
    const absurdFen = 'rnbqkbnr/1pppppp1/8/p6p/PPP4P/8/3PPPP1/RNBQKBNR b KQkq - 0 3';
    expect(isBookPosition(absurdFen)).toBe(false);
    expect(getOpeningByFen(absurdFen)).toBeNull();
  });

  it('flags opening book moves as NOT requiring tactical analysis', () => {
    const bookFen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(shouldAnalyzeMove(bookFen)).toBe(false);

    // Endgame / out of book position should be analyzed
    expect(shouldAnalyzeMove('8/8/4k3/8/8/4K3/8/8 w - - 0 1')).toBe(true);
  });

  it('marks moves in parsePgn as theoretical opening book moves with ECO codes', async () => {
    const { parsePgn } = await import('../src/lib/chess/pgnParser');
    const pgn = '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6';
    const parsed = parsePgn(pgn);

    // First move (1. e4)
    expect(parsed.moves[0].classification).toBe('theoretical');
    expect(parsed.moves[0].isBook).toBe(true);
    expect(parsed.moves[0].centipawnLoss).toBe(0);

    // 5... a6 (Sicilian Najdorf)
    const moveA6 = parsed.moves.find(m => m.san === 'a6');
    expect(moveA6).toBeDefined();
    expect(moveA6?.classification).toBe('theoretical');
    expect(moveA6?.isBook).toBe(true);
    expect(moveA6?.openingName).toBe('Sicilian Defense: Najdorf Variation');
    expect(moveA6?.eco).toBe('B90');
  });

  it('classifies all moves and continuations along the opening book as theoretical with evalScore 0', async () => {
    const { parsePgn } = await import('../src/lib/chess/pgnParser');
    // Italian Game Giuoco Pianissimo line (11 plies in book) followed by non-book move
    const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3 d6 6. O-O h5';
    const parsed = parsePgn(pgn);

    // Moves 1 to 11 (plies 1-11) are book moves
    for (let i = 0; i < 11; i++) {
      const m = parsed.moves[i];
      expect(m.isBook).toBe(true);
      expect(m.classification).toBe('theoretical');
      expect(m.centipawnLoss).toBe(0);
      expect(m.evalScore).toBe(0);
    }

    // Move 12 (6... h5) is out of book
    expect(parsed.moves[11].isBook).toBe(false);
    expect(parsed.moves[11].classification).toBeUndefined();
  });
});

