import { describe, it, expect } from 'vitest';
import { describeMoveDelta } from '../src/lib/chess/featureExtractor';
import { buildFactLockedPrompt } from '../src/lib/ai/prompts';
import { generateHeuristicFallback } from '../src/lib/ai/client';

describe('AI Coaching Advice & 14 Rules Framework (TDD)', () => {
  // Position from user game before 7. Qxb6
  const fenBeforeQxb6 = 'r1n1kb1r/p4ppp/1qpp1n2/4p3/3PP1b1/1QP2N2/PP1N1PPP/R1B1KB1R w KQkq - 0 7';

  it('RED: extracts verified concrete board deltas for both played and engine moves', () => {
    // 1. Played move: 7. Qxb6 (queen captures queen on b6)
    const playedDelta = describeMoveDelta(fenBeforeQxb6, 'Qxb6', 'b3b6');
    expect(playedDelta.pieceName).toBe('queen');
    expect(playedDelta.from).toBe('b3');
    expect(playedDelta.to).toBe('b6');
    expect(playedDelta.capturedPieceName).toBe('queen');
    expect(playedDelta.isCapture).toBe(true);

    // 2. Engine move: 7. dxe5 (pawn captures pawn on e5)
    const engineDelta = describeMoveDelta(fenBeforeQxb6, 'dxe5', 'd4e5');
    expect(engineDelta.pieceName).toBe('pawn');
    expect(engineDelta.from).toBe('d4');
    expect(engineDelta.to).toBe('e5');
    expect(engineDelta.capturedPieceName).toBe('pawn');
    expect(engineDelta.isCapture).toBe(true);
  });

  it('RED: embeds the 14 coaching rules and 5 priorities into the fact-locked prompt', () => {
    const prompt = buildFactLockedPrompt({
      playerColor: 'white',
      moveSan: 'Qxb6',
      fromSquare: 'b3',
      toSquare: 'b6',
      bestMoveSan: 'dxe5',
      bestMoveUci: 'd4e5',
      classification: 'imprecise',
      centipawnLoss: 90,
      evalBefore: 120,
      evalAfter: 30,
      positionalNotes: ['Trade of queens on b6.'],
      refutationMoves: ['7... axb6', '8. dxe5'],
      refutationLineSan: '7... axb6 8. dxe5',
      isExchange: true,
      exchangeSummary: 'Trade of queens on b6',
      silmanImbalance: 'Control of a Key File',
      playedMoveDelta: {
        pieceName: 'queen',
        from: 'b3',
        to: 'b6',
        capturedPieceName: 'queen',
        isCapture: true,
      },
      engineMoveDelta: {
        pieceName: 'pawn',
        from: 'd4',
        to: 'e5',
        capturedPieceName: 'pawn',
        isCapture: true,
      },
    });

    const system = prompt.system;

    // Must embed user coaching rules
    expect(system).toMatch(/Do not repeat Stockfish's evaluation without explaining the chess idea/i);
    expect(system).toMatch(/Do not dump variations/i);
    expect(system).toMatch(/Do not mention engine depth, nodes, centipawns/i);
    expect(system).toMatch(/The advice should tell the player what to DO/i);
    expect(system).toMatch(/The explanation must specifically compare the player's move with the better move/i);
    expect(system).toMatch(/Tactical issues override general strategic principles/i);
    expect(system).toMatch(/Never claim that a chess principle is absolute/i);
    expect(system).not.toContain('—'); // anti-slop law: no em dashes

    // Must output the clean user-approved schema
    expect(system).toContain('whyBetter');
    expect(system).toContain('moveDifference');
    expect(system).toContain('practicalPrinciple');

    // User prompt must include verified deltas
    expect(prompt.user).toContain('queen moves b3 -> b6');
    expect(prompt.user).toContain('pawn moves d4 -> e5');
  });

  it('RED: generates heuristic fallback matching the 14 rules and advice schema', () => {
    const output = generateHeuristicFallback({
      playerColor: 'white',
      moveSan: 'Qxb6',
      fromSquare: 'b3',
      toSquare: 'b6',
      bestMoveSan: 'dxe5',
      bestMoveUci: 'd4e5',
      classification: 'imprecise',
      centipawnLoss: 90,
      evalBefore: 120,
      evalAfter: 30,
      positionalNotes: ['Trade of queens on b6.'],
      refutationMoves: ['7... axb6', '8. dxe5'],
      refutationLineSan: '7... axb6 8. dxe5',
      isExchange: true,
      exchangeSummary: 'Trade of queens on b6',
      silmanImbalance: 'Control of a Key File',
      playedMoveDelta: {
        pieceName: 'queen',
        from: 'b3',
        to: 'b6',
        capturedPieceName: 'queen',
        isCapture: true,
      },
      engineMoveDelta: {
        pieceName: 'pawn',
        from: 'd4',
        to: 'e5',
        capturedPieceName: 'pawn',
        isCapture: true,
      },
    });

    // Validates structured advice output
    expect(output.whyBetter).toBeDefined();
    expect(output.moveDifference).toBeDefined();
    expect(output.practicalPrinciple).toBeDefined();

    // Must specifically compare player's move with better move
    expect(output.moveDifference).toContain('Qxb6');
    expect(output.moveDifference).toContain('dxe5');

    // Must not contain engine jargon
    expect(output.moveDifference).not.toMatch(/centipawn|depth|nodes/i);
    expect(output.whyBetter).not.toMatch(/centipawn|depth|nodes/i);

    // Practical principle must tell player what to do
    expect(output.practicalPrinciple).toMatch(/Avoid|Maintain|Keep|Beware/i);
  });

  it('states concrete fix directly when a move creates a concrete problem without general strategic preaching', () => {
    const prompt = buildFactLockedPrompt({
      playerColor: 'white',
      moveSan: 'Qe4',
      fromSquare: 'd4',
      toSquare: 'e4',
      bestMoveSan: 'f3',
      classification: 'mistake',
      centipawnLoss: 180,
      evalBefore: 100,
      evalAfter: -80,
      positionalNotes: ['Leaves pawn on e4 undefended.'],
      refutationMoves: ['Nxe4'],
      silmanImbalance: 'Material',
      tacticalTarget: {
        square: 'e4',
        piece: 'pawn on e4',
        threatenedBy: 'Black knight on f6',
        outcome: 'Nxe4 captures the pawn',
      },
    });

    // Prompt must instruct model to state concrete fix directly
    expect(prompt.system).toMatch(/When a move creates a concrete problem, state the concrete fix directly/i);
    expect(prompt.system).toMatch(/say "Defend the pawn.*not "Improve your queen placement"/i);

    // Heuristic fallback must say "Defend the pawn on e4" directly
    const tip = generateHeuristicFallback({
      playerColor: 'white',
      moveSan: 'Qd3',
      fromSquare: 'd1',
      toSquare: 'd3',
      bestMoveSan: 'f3',
      classification: 'blunder',
      centipawnLoss: 250,
      evalBefore: 50,
      evalAfter: -200,
      positionalNotes: ['Leaves e4 pawn undefended.'],
      refutationMoves: ['Nxe4'],
      silmanImbalance: 'Material',
      tacticalTarget: {
        square: 'e4',
        piece: 'pawn on e4',
        threatenedBy: 'knight on f6',
        outcome: 'captures pawn on e4',
      },
    });

    expect(tip.moveDifference).toMatch(/leaves pawn on e4 undefended.*defend pawn on e4 immediately/i);
    expect(tip.practicalPrinciple).toMatch(/Defend pawn on e4/i);
    expect(tip.practicalPrinciple).not.toMatch(/Support the center|Improve your queen placement/i);
  });
});
