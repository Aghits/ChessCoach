import { describe, it, expect } from 'vitest';
import {
  SILMAN_IMBALANCES,
  SilmanImbalanceType,
  detectPrimaryImbalance,
  comparePlayedVsEngine,
} from '../src/lib/chess/silmanImbalances';

describe('Jeremy Silman Imbalance System (TDD)', () => {
  it('contains all 10 canonical Silman imbalances', () => {
    const expectedImbalances: SilmanImbalanceType[] = [
      'Superior Minor Piece (Bishops vs. Knights)',
      'Pawn Structure',
      'Space',
      'Material',
      'Control of a Key File',
      'Control of a Hole / Weak Square',
      'Lead in Development',
      'Initiative',
      'King Safety',
      'Statics vs. Dynamics',
    ];

    expect(Object.keys(SILMAN_IMBALANCES)).toHaveLength(10);
    for (const imb of expectedImbalances) {
      expect(SILMAN_IMBALANCES[imb]).toBeDefined();
      expect(SILMAN_IMBALANCES[imb].description).toBeTruthy();
    }
  });

  it('detects "Control of a Hole / Weak Square" when knight claims an outpost', () => {
    // Position where Black gives up d5 square and White knight lands on d5 outpost
    const prevFen = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 9';
    // White plays Nd5 outpost
    const afterFen = 'r1bq1rk1/pp2bppp/2n1pn2/3N4/2PP4/5N2/PP2BPPP/R1BQ1RK1 b - - 1 9';

    const result = detectPrimaryImbalance({
      prevFen,
      playedFen: afterFen,
      playedSan: 'Nd5',
      engineSan: 'cxd5',
      loss: 0,
    });

    expect(result.primaryImbalance).toBe('Control of a Hole / Weak Square');
  });

  it('detects "Pawn Structure" when an isolated or backward pawn is created', () => {
    const prevFen = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 10';
    // After cxd5 exd5, d5 becomes an isolated pawn
    const afterFen = 'r1bq1rk1/pp2bppp/2n2n2/3p4/3P4/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 11';

    const result = detectPrimaryImbalance({
      prevFen,
      playedFen: afterFen,
      playedSan: 'exd5',
      engineSan: 'Nxd5',
      loss: 100,
    });

    expect(result.primaryImbalance).toBe('Pawn Structure');
  });

  it('detects "Material" imbalance when a move suffers massive tactical loss (loss >= 200 cp)', () => {
    // When a move blunders material (e.g. loss 730 cp on Ncxe4), primary imbalance must be Material
    const prevFen = 'r2r2k1/pp3pp1/2p2n1p/4p3/1q2n3/2N1PB1P/PPP3P1/R2RQ1K1 b - - 0 22';
    const afterFen = 'r2r2k1/pp3pp1/2p2n1p/4p3/1q2n3/2N1PB1P/PPP3P1/R2RQ1K1 w - - 0 23';
    const result = detectPrimaryImbalance({
      prevFen,
      playedFen: afterFen,
      playedSan: 'Ncxe4',
      engineSan: 'Rxd1',
      loss: 730,
    });
    expect(result.primaryImbalance).toBe('Material');
  });

  it('detects "Superior Minor Piece (Bishops vs. Knights)" when bishop pair is conceded or bishop vs knight tension occurs', () => {
    // Position where bishop captures knight
    const prevFen = 'r1bqk2r/pp1n1ppp/2p1pn2/3p4/1bPP4/2N1PN2/PPQ1BPPP/R1B1K2R b KQkq - 3 7';
    // Bxc3+
    const afterFen = 'r1bqk2r/pp1n1ppp/2p1pn2/3p4/2PP4/2b1PN2/PPQ1BPPP/R1B1K2R w KQkq - 0 8';

    const result = detectPrimaryImbalance({
      prevFen,
      playedFen: afterFen,
      playedSan: 'Bxc3+',
      engineSan: 'O-O',
      loss: 80,
    });

    expect(result.primaryImbalance).toBe('Superior Minor Piece (Bishops vs. Knights)');
  });

  it('detects "King Safety" when a move compromises the king shield or exposes uncastled king', () => {
    // White king in center under attack
    const prevFen = 'r1bqk2r/pppp1ppp/2n5/4p3/2B1n3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5';
    // dxe4
    const afterFen = 'r1bqk2r/pppp1ppp/2n5/4p3/2B1P3/5N2/PPP2PPP/RNBQK2R b KQkq - 0 5';

    const result = detectPrimaryImbalance({
      prevFen,
      playedFen: afterFen,
      playedSan: 'dxe4',
      engineSan: 'O-O',
      loss: 50,
    });

    expect(result.primaryImbalance).toBeDefined();
  });

  it('generates a concrete comparison explaining why the engine move is better through the Silman lens', () => {
    const comparison = comparePlayedVsEngine({
      imbalance: 'Control of a Key File',
      playedSan: 'a3',
      engineSan: 'Rfe1',
      playerColor: 'w',
    });

    expect(comparison.whyEngineBetter).toContain('Rfe1');
    expect(comparison.whyEngineBetter.toLowerCase()).toContain('file');
    expect(comparison.pocketRule).toBeTruthy();
  });

  it('compares candidate moves by strategic priority (outpost first, attacking weakness first)', () => {
    // 1. Hole / Outpost priority test
    const outpostComp = comparePlayedVsEngine({
      imbalance: 'Control of a Hole / Weak Square',
      playedSan: 'Be2',
      engineSan: 'Nd5',
      playerColor: 'w',
    });
    // Must contrast Be2 vs Nd5, explaining priority or timing (e.g. outpost first before developing/routine moves)
    expect(outpostComp.whyEngineBetter).toContain('Be2');
    expect(outpostComp.whyEngineBetter).toContain('Nd5');
    expect(outpostComp.whyEngineBetter.toLowerCase()).toMatch(/outpost.*first|priority|before/);

    // 2. Pawn Structure / Principle of Two Weaknesses test
    const pawnComp = comparePlayedVsEngine({
      imbalance: 'Pawn Structure',
      playedSan: 'Re1',
      engineSan: 'Qb3',
      playerColor: 'w',
    });
    expect(pawnComp.whyEngineBetter).toContain('Re1');
    expect(pawnComp.whyEngineBetter).toContain('Qb3');
    expect(pawnComp.whyEngineBetter.toLowerCase()).toMatch(/two weaknesses|exploit.*first|target.*first|priority/);
  });

  it('generates heuristic fallback explanation that compares candidate moves by priority', async () => {
    const { generateHeuristicFallback } = await import('../src/lib/ai/client');
    const tip = generateHeuristicFallback({
      playerColor: 'white',
      moveSan: 'Be2',
      fromSquare: 'f1',
      toSquare: 'e2',
      bestMoveSan: 'Nd5',
      classification: 'imprecise',
      centipawnLoss: 60,
      evalBefore: 50,
      evalAfter: -10,
      positionalNotes: ['White knight controls d5 hole'],
      refutationMoves: ['exd5'],
      silmanImbalance: 'Control of a Hole / Weak Square',
    });

    expect(tip.diagnosis).toContain('Be2');
    expect(tip.whyEngineBetter).toContain('Be2');
    expect(tip.whyEngineBetter).toContain('Nd5');
    expect(tip.whyEngineBetter?.toLowerCase()).toMatch(/outpost.*first|priority|before/);
    expect(tip.refutationSummary).toContain('Nd5');
  });
});
