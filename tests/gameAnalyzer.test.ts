import { describe, it, expect, vi } from 'vitest';
import { analyzeGameMoves } from '../src/lib/chess/gameAnalyzer';
import { EvaluatedMove } from '../src/lib/chess/types';
import { EngineEvaluation } from '../src/lib/chess/engineWorker';
import { getClassificationSummary } from '../src/lib/chess/evalClassifier';

describe('Game Batch Analysis Engine (TDD)', () => {
  // Mock game with 4 moves: 2 opening book moves and 2 non-book moves
  const sampleMoves: EvaluatedMove[] = [
    {
      ply: 1,
      moveNumber: 1,
      color: 'w',
      san: 'e4',
      from: 'e2',
      to: 'e4',
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      previousFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      isBook: true,
      classification: 'theoretical',
      centipawnLoss: 0,
    },
    {
      ply: 2,
      moveNumber: 1,
      color: 'b',
      san: 'e5',
      from: 'e7',
      to: 'e5',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      previousFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      isBook: true,
      classification: 'theoretical',
      centipawnLoss: 0,
    },
    {
      ply: 3,
      moveNumber: 2,
      color: 'w',
      san: 'h4', // Out of book move
      from: 'h2',
      to: 'h4',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P2P/8/PPPP1PP1/RNBQKBNR b KQkq - 0 2',
      previousFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    },
    {
      ply: 4,
      moveNumber: 2,
      color: 'b',
      san: 'h5', // Out of book move
      from: 'h7',
      to: 'h5',
      fen: 'rnbqkbnr/pppp1pp1/8/4p2p/4P2P/8/PPPP1PP1/RNBQKBNR w KQkq - 0 3',
      previousFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P2P/8/PPPP1PP1/RNBQKBNR b KQkq - 0 2',
    },
  ];

  it('skips engine evaluation for book moves and only evaluates non-book moves', async () => {
    const mockEvaluator = vi.fn(async (fen: string): Promise<EngineEvaluation> => {
      return {
        fen,
        depth: 14,
        evalScore: 30,
        bestMoveUci: 'd2d4',
        isComplete: true,
      };
    });

    const analyzed = await analyzeGameMoves(sampleMoves, {
      evaluator: mockEvaluator,
    });

    // Moves 1 and 2 are book moves, so mockEvaluator should only be called for moves 3 and 4
    expect(mockEvaluator).toHaveBeenCalledTimes(2);

    // Check that book moves remained theoretical with 0 loss and have evalScore 0
    expect(analyzed[0].classification).toBe('theoretical');
    expect(analyzed[0].centipawnLoss).toBe(0);
    expect(analyzed[0].evalScore).toBe(0);
    expect(analyzed[1].classification).toBe('theoretical');
    expect(analyzed[1].centipawnLoss).toBe(0);
    expect(analyzed[1].evalScore).toBe(0);

    // Check that non-book moves received evaluations and classifications
    expect(analyzed[2].evalScore).toBeDefined();
    expect(analyzed[2].classification).toBeDefined();
    expect(analyzed[3].evalScore).toBeDefined();
    expect(analyzed[3].classification).toBeDefined();
  });

  it('emits progress callbacks as each move is analyzed', async () => {
    const progressUpdates: number[] = [];
    const mockEvaluator = async (fen: string): Promise<EngineEvaluation> => ({
      fen,
      depth: 14,
      evalScore: 20,
      bestMoveUci: 'g1f3',
      isComplete: true,
    });

    await analyzeGameMoves(sampleMoves, {
      evaluator: mockEvaluator,
      onProgress: (p) => {
        progressUpdates.push(p.current);
      },
    });

    // Should receive progress for all 4 moves
    expect(progressUpdates).toEqual([1, 2, 3, 4]);
  });

  it('supports cancellation during batch analysis', async () => {
    let cancelTriggered = false;
    let evalCount = 0;

    const mockEvaluator = async (fen: string): Promise<EngineEvaluation> => {
      evalCount++;
      return { fen, depth: 14, evalScore: 10, isComplete: true };
    };

    const analyzed = await analyzeGameMoves(sampleMoves, {
      evaluator: mockEvaluator,
      shouldCancel: () => cancelTriggered,
      onProgress: (p) => {
        if (p.current === 3) {
          cancelTriggered = true; // cancel after move 3
        }
      },
    });

    // Move 4 should not have been evaluated
    expect(evalCount).toBe(1); // only move 3 was evaluated before cancel
    expect(analyzed[3].evalScore).toBeUndefined();
  });

  it('produces complete game review summary once batch analysis completes', async () => {
    const mockEvaluator = async (fen: string): Promise<EngineEvaluation> => ({
      fen,
      depth: 14,
      evalScore: 25,
      bestMoveUci: 'd2d4',
      isComplete: true,
    });

    const analyzed = await analyzeGameMoves(sampleMoves, {
      evaluator: mockEvaluator,
    });

    const summary = getClassificationSummary(analyzed);
    expect(summary.whiteAccuracy).toBeGreaterThan(0);
    expect(summary.blackAccuracy).toBeGreaterThan(0);
    expect(summary.items.length).toBe(10);
  });

  it('passes fast-pass evaluation options (depth and movetime) to evaluator', async () => {
    const evalCalls: Array<{ fen: string; options?: any }> = [];
    const mockEvaluator = vi.fn(async (fen: string, options?: any): Promise<EngineEvaluation> => {
      evalCalls.push({ fen, options });
      return {
        fen,
        depth: options?.depth || 10,
        evalScore: 15,
        bestMoveUci: 'd2d4',
        isComplete: true,
      };
    });

    await analyzeGameMoves(sampleMoves, {
      depth: 10,
      movetime: 80,
      evaluator: mockEvaluator,
    });

    expect(mockEvaluator).toHaveBeenCalledTimes(2);
    expect(evalCalls[0].options).toEqual({ depth: 10, movetime: 80 });
    expect(evalCalls[1].options).toEqual({ depth: 10, movetime: 80 });
  });

  it('defaults to fast analysis settings (depth 10, movetime 80) when options are omitted', async () => {
    const evalCalls: Array<{ fen: string; options?: any }> = [];
    const mockEvaluator = vi.fn(async (fen: string, options?: any): Promise<EngineEvaluation> => {
      evalCalls.push({ fen, options });
      return {
        fen,
        depth: options?.depth || 10,
        evalScore: 15,
        bestMoveUci: 'd2d4',
        isComplete: true,
      };
    });

    await analyzeGameMoves(sampleMoves, {
      evaluator: mockEvaluator,
    });

    expect(mockEvaluator).toHaveBeenCalledTimes(2);
    expect(evalCalls[0].options).toEqual({ depth: 10, movetime: 80 });
    expect(evalCalls[1].options).toEqual({ depth: 10, movetime: 80 });
  });
});
