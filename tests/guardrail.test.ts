import { describe, it, expect } from 'vitest';
import { validateBoardSquares, sanitizeHallucinations, AllowedBoardContext } from '../src/lib/ai/guardrail';

describe('Anti-Hallucination Guardrail', () => {
  const sampleContext: AllowedBoardContext = {
    playedMoveSquares: ['e2', 'e4'],
    bestMoveSquares: ['d2', 'd4'],
    pvSquares: ['d4', 'd5', 'c4'],
    featureSquares: ['d5'], // isolated pawn on d5
  };

  it('approves text containing only verified squares', () => {
    const text = 'Moving to e4 allows Black to push d5, challenging White on d4.';
    const res = validateBoardSquares(text, sampleContext);
    expect(res.isValid).toBe(true);
    expect(res.hallucinatedSquares).toHaveLength(0);
  });

  it('detects hallucinated squares not present in the board context', () => {
    const text = 'White should move the knight to f7 and attack the rook on h8.';
    const res = validateBoardSquares(text, sampleContext);
    expect(res.isValid).toBe(false);
    expect(res.hallucinatedSquares).toContain('f7');
    expect(res.hallucinatedSquares).toContain('h8');
  });

  it('sanitizes hallucinated squares from text', () => {
    const text = 'The bishop on f7 is trapped.';
    const cleaned = sanitizeHallucinations(text, ['f7']);
    expect(cleaned).not.toContain('f7');
  });

  it('builds prompt that assumes player already knows principles and compares candidate moves by priority', async () => {
    const { buildFactLockedPrompt } = await import('../src/lib/ai/prompts');
    const { system, user } = buildFactLockedPrompt({
      playerColor: 'white',
      moveSan: 'Be2',
      fromSquare: 'f1',
      toSquare: 'e2',
      bestMoveSan: 'Nd5',
      bestMoveUci: 'c3d5',
      classification: 'imprecise',
      centipawnLoss: 65,
      evalBefore: 50,
      evalAfter: -15,
      positionalNotes: ['White knight controls d5 hole'],
      refutationMoves: ['exd5', 'cxd5'],
      silmanImbalance: 'Control of a Hole / Weak Square',
    });

    // Verify system instructions require assuming knowledge of principles & candidate comparison
    expect(system).toMatch(/principles/i);
    expect(system).toMatch(/candidate move|comparing|priority/i);
    expect(system).not.toContain('—'); // anti-slop law: no em dashes
    // Verify user prompt demands comparative diagnosis and priority reasoning
    expect(user).toContain('Be2');
    expect(user).toContain('Nd5');
    expect(user.toLowerCase()).toMatch(/priority|imbalance/);
  });

  it('detects hallucinated piece-on-square placements against actual FENs', async () => {
    const { validatePiecePlacement } = await import('../src/lib/ai/guardrail');
    // Position from user screenshot: White bishop on b5, Black rook on h5, White pawn on b4
    const fen = '4k2r/1p1n1p1p/3B1bp1/1B5r/1P1p4/2P5/P4PPP/R3K2R w KQk - 0 19';

    // True claim
    const validRes = validatePiecePlacement('Black rook on h5 attacks the White bishop on b5.', [fen]);
    expect(validRes.isValid).toBe(true);
    expect(validRes.invalidClaims).toHaveLength(0);

    // False claim from user screenshot
    const invalidRes = validatePiecePlacement('Playing c4 attacks the Black rook on b4.', [fen]);
    expect(invalidRes.isValid).toBe(false);
    expect(invalidRes.invalidClaims[0]).toMatch(/b4/);
  });

  it('includes activeBoardThreats and explicit refutation separation in prompt', async () => {
    const { buildFactLockedPrompt } = await import('../src/lib/ai/prompts');
    const { user, system } = buildFactLockedPrompt({
      playerColor: 'white',
      moveSan: 'O-O-O',
      fromSquare: 'e1',
      toSquare: 'c1',
      bestMoveSan: 'c4',
      bestMoveUci: 'c3c4',
      classification: 'miss',
      centipawnLoss: 330,
      evalBefore: 50,
      evalAfter: -280,
      positionalNotes: ['White bishop on b5 is loose'],
      refutationMoves: ['19... Rxb5', '20. Rxd4'],
      refutationLineSan: '19... Rxb5 20. Rxd4 Kd8 21. Re1',
      activeBoardThreats: ['White bishop on b5 is attacked by Black rook on h5 (undefended / hanging)'],
      engineMoveDelta: {
        pieceName: 'pawn',
        from: 'c3',
        to: 'c4',
        san: 'c4',
        isCapture: false,
        enemyPiecesAttacked: [],
      },
    });

    expect(user).toContain('Verified Board Threats');
    expect(user).toContain('White bishop on b5 is attacked by Black rook on h5');
    expect(user).toContain('Refutation of Player\'s Move: 19... Rxb5');
    expect(user).toContain('Does NOT attack any enemy piece');
    expect(system).toMatch(/Never invent piece positions or attacks/i);
  });
});
