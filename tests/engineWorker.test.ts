import { describe, it, expect, vi } from 'vitest';
import { StockfishEngine } from '../src/lib/chess/engineWorker';

describe('Stockfish 18 Lite Engine Worker (TDD)', () => {
  it('correctly parses Stockfish 18 Lite UCI identity line and captures engine name', () => {
    const engine = new StockfishEngine();
    // Simulate engine output from Stockfish 18
    (engine as any).handleEngineOutput('id name Stockfish 18 Lite WASM');
    expect((engine as any).getEngineName?.()).toBe('Stockfish 18 Lite WASM');
  });

  it('correctly parses Stockfish 18 info depth line with NNUE eval and PV', () => {
    const engine = new StockfishEngine();
    const mockCallback = vi.fn();
    (engine as any).currentFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    (engine as any).currentCallback = mockCallback;

    // Stockfish 18 UCI info stream line
    const infoLine = 'info depth 10 seldepth 18 multipv 1 score cp 46 nodes 32689 nps 502907 hashfull 14 time 65 pv g1f3 g8f6 d2d4 e5d4';
    (engine as any).handleEngineOutput(infoLine);

    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
      depth: 10,
      evalScore: 46, // White's perspective on White turn
      bestMoveUci: 'g1f3',
      pvLine: ['g1f3', 'g8f6', 'd2d4', 'e5d4'],
      isComplete: false,
    }));
  });

  it('correctly inverts centipawn score to White perspective when Black to move', () => {
    const engine = new StockfishEngine();
    const mockCallback = vi.fn();
    // FEN with Black active color ('b')
    (engine as any).currentFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    (engine as any).currentCallback = mockCallback;

    // Engine reports cp 30 for Black's perspective
    const infoLine = 'info depth 8 score cp 30 pv e7e5 g1f3';
    (engine as any).handleEngineOutput(infoLine);

    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
      depth: 8,
      evalScore: -30, // -30 for White (+30 for Black)
      bestMoveUci: 'e7e5',
      pvLine: ['e7e5', 'g1f3'],
    }));
  });
});
