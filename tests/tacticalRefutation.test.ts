import { describe, it, expect } from 'vitest';
import { formatRefutationLine } from '../src/lib/chess/featureExtractor';
import { buildFactLockedPrompt } from '../src/lib/ai/prompts';
import { generateHeuristicFallback } from '../src/lib/ai/client';

describe('Tactical Refutation & Concrete Piece Analysis (TDD)', () => {
  // Position from user game: White played 13. Rc1, leaving bishop on e3 attacked by Black's bishop on c5
  const sampleFenAfterRc1 = 'r2q1rk1/pp1n1pp1/2p1pn1p/2b1p3/4P3/P1N1BBP1/1PP2P1P/R1QR2K1 b - - 0 13';

  it('formats UCI pvLine into SAN moves with exact moving and captured piece names', () => {
    const pvUci = ['c5e3', 'f2e3', 'd8e7'];
    const result = formatRefutationLine(sampleFenAfterRc1, pvUci, 25);

    expect(result.moves.length).toBeGreaterThanOrEqual(2);
    // First move is Bxe3 (Black bishop captures White bishop on e3)
    expect(result.moves[0].san).toBe('Bxe3');
    expect(result.moves[0].capturedPieceName).toContain('bishop on e3');
    expect(result.moves[0].movingPieceName).toContain('bishop');
    expect(result.moves[0].fenAfter).toBeDefined();

    // Second move is fxe3
    expect(result.moves[1].san).toBe('fxe3');
    expect(result.lineSan).toContain('Bxe3');
    expect(result.lineSan).toContain('fxe3');
    expect(result.tacticalSummary).toContain('bishop');
  });

  it('enforces strict concreteness rules in AI prompt to prevent vague phrases', () => {
    const { system, user } = buildFactLockedPrompt({
      playerColor: 'white',
      moveSan: 'Rc1',
      fromSquare: 'a1',
      toSquare: 'c1',
      bestMoveSan: 'Qe2',
      bestMoveUci: 'd1e2',
      classification: 'mistake',
      centipawnLoss: 150,
      evalBefore: 0,
      evalAfter: -150,
      positionalNotes: ['Leaves White bishop on e3 vulnerable to capture.'],
      refutationMoves: ['13... Bxe3', '14. fxe3'],
      refutationLineSan: '13... Bxe3 14. fxe3',
      tacticalTarget: {
        square: 'e3',
        piece: 'White bishop on e3',
        threatenedBy: 'Black bishop on c5',
        outcome: 'Black captures the bishop on e3 with Bxe3',
      },
      silmanImbalance: 'Superior Minor Piece (Bishops vs. Knights)',
    });

    // System prompt must demand concrete piece names and forbid vague phrases
    expect(system).toMatch(/exact piece/i);
    expect(system).toMatch(/never use vague|forbid.*vague|do not say/i);
    expect(system).not.toContain('—'); // anti-slop law

    // User prompt must include concrete tactical target details and SAN refutation line
    expect(user).toContain('White bishop on e3');
    expect(user).toContain('Black bishop on c5');
    expect(user).toContain('13... Bxe3');
  });

  it('generates heuristic fallback with exact piece names and material details', () => {
    const tip = generateHeuristicFallback({
      playerColor: 'white',
      moveSan: 'Rc1',
      fromSquare: 'a1',
      toSquare: 'c1',
      bestMoveSan: 'Qe2',
      classification: 'mistake',
      centipawnLoss: 150,
      evalBefore: 0,
      evalAfter: -150,
      positionalNotes: ['Leaves White bishop on e3 vulnerable to capture.'],
      refutationMoves: ['13... Bxe3', '14. fxe3'],
      refutationLineSan: '13... Bxe3 14. fxe3',
      tacticalTarget: {
        square: 'e3',
        piece: 'bishop on e3',
        threatenedBy: 'bishop on c5',
        outcome: 'loses the bishop on e3 to 13... Bxe3',
      },
      silmanImbalance: 'Superior Minor Piece (Bishops vs. Knights)',
    });

    expect(tip.diagnosis).toContain('bishop on e3');
    expect(tip.whyEngineBetter).toContain('Qe2');
    expect(tip.whyEngineBetter).toContain('bishop on e3');
    expect(tip.whyEngineBetter).not.toContain('vulnerable piece or pawn');
    expect(tip.refutationSummary).toContain('13... Bxe3');
  });

  it('correctly classifies piece exchange (e.g. 7. Qxb6 axb6) without false blunder alerts', () => {
    // Position after 7. Qxb6 (White Queen is on b6, having captured Black Queen)
    const fenAfterQxb6 = 'r1n1kb1r/p4ppp/1Qpp1n2/4p3/3PP1b1/2P2N2/PP1N1PPP/R1B1KB1R b KQkq - 0 7';
    const pvUci = ['a7b6', 'd4e5', 'd6e5'];

    const result = formatRefutationLine(fenAfterQxb6, pvUci, 13, {
      from: 'b3',
      to: 'b6',
      san: 'Qxb6',
      capturedPieceType: 'q',
      centipawnLoss: 90,
      classification: 'imprecise',
    });

    expect(result.isExchange).toBe(true);
    expect(result.exchangeSummary).toContain('queens on b6');
    // Must NOT flag Queen as an undefended or threatened piece
    expect(result.threatenedPieceName).toBeUndefined();
    expect(result.threatenedSquare).toBeUndefined();
    expect(result.tacticalSummary).toContain('completing the exchange');
  });

  it('generates sensible trade diagnosis and pocket rule for queen trade inaccuracies', () => {
    const tip = generateHeuristicFallback({
      playerColor: 'white',
      moveSan: 'Qxb6',
      fromSquare: 'b3',
      toSquare: 'b6',
      bestMoveSan: 'dxe5',
      classification: 'imprecise',
      centipawnLoss: 90,
      evalBefore: 120,
      evalAfter: 30,
      positionalNotes: ['Trade of queens on b6.'],
      refutationMoves: ['7... axb6', '8. dxe5'],
      refutationLineSan: '7... axb6 8. dxe5',
      isExchange: true,
      exchangeSummary: 'Trade of queens on b6',
      silmanImbalance: 'Initiative',
    });

    // Diagnosis must acknowledge the trade, NOT claim the queen was hung or lost outright
    expect(tip.diagnosis).toContain('Trade of queens');
    expect(tip.diagnosis).not.toMatch(/hangs|leaves.*undefended|lost outright/i);

    // Why engine better must focus on initiative/tension, not avoiding losing a queen
    expect(tip.whyEngineBetter).toContain('dxe5');
    expect(tip.whyEngineBetter).not.toContain('avoids losing the queen');

    // Pocket rule must be about trades, tension, or opening files, NOT "check before capture"
    expect(tip.pocketRule).toMatch(/Beware Opening Files|Maintain the Tension/i);
    expect(tip.pocketRule).not.toMatch(/Check Before You Capture/i);
  });
});
