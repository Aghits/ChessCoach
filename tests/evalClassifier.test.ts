import { describe, it, expect } from 'vitest';
import {
  isBookMove,
  classifyMove,
  uciToSan,
  updateEvaluatedMove,
  calculatePlayerAccuracy,
  getClassificationSummary,
} from '../src/lib/chess/evalClassifier';

describe('Eval Classifier & Book Moves', () => {
  it('identifies standard opening book moves in early plies', () => {
    expect(isBookMove(1, 'e4')).toBe(true);
    expect(isBookMove(1, 'd4')).toBe(true);
    expect(isBookMove(2, 'e5')).toBe(true);
    expect(isBookMove(2, 'c5')).toBe(true);
    expect(isBookMove(3, 'Nf3')).toBe(true);
    expect(isBookMove(4, 'Nc6')).toBe(true);
    // Standard move 4 / move 5 setup moves
    expect(isBookMove(7, 'd3')).toBe(true);
    expect(isBookMove(8, 'Bg4')).toBe(true);
    expect(isBookMove(9, 'Be2')).toBe(true);
    // Non-book move
    expect(isBookMove(1, 'h4')).toBe(false);
    // Late ply move
    expect(isBookMove(20, 'e4')).toBe(false);
  });

  it('classifies 4. d3 as theoretical with 0 loss', () => {
    const res = classifyMove(160, undefined, 10, undefined, 'w', 7, 'd3', false);
    expect(res.classification).toBe('theoretical');
    expect(res.loss).toBe(0);
  });

  it('does not classify moves as blunders when the resulting position remains solid/equal', () => {
    // White was +180 and dropped to +10 (loss 170), but is still completely equal/sound (+0.10)
    const res = classifyMove(180, undefined, 10, undefined, 'w', 15, 'Nbd2', false);
    expect(res.classification).not.toBe('blunder');
    expect(['mistake', 'imprecise']).toContain(res.classification);
  });

  it('classifies equal position collapse to losing as blunder under Win% delta', () => {
    // White was equal (+20 cp) and played a move dropping to -150 cp (loss 170 cp).
    // In centipawns it is < 200, but win% drops from ~53% to ~30% into a losing state.
    const res = classifyMove(20, undefined, -150, undefined, 'w', 20, 'd5', false);
    expect(res.classification).toBe('blunder');
  });

  it('classifies dropping from a winning advantage into a clearly lost position as a blunder, not a miss', () => {
    // Player was winning (+2.40 cp, scoreBefore = 240) and played Ncxe4 losing 730 cp (-7.3), dropping to -4.90
    // (evalBefore = -240 from White's perspective, evalAfter = +490 from White's perspective)
    const res = classifyMove(-240, undefined, 490, undefined, 'b', 44, 'Ncxe4', false);
    expect(res.classification).toBe('blunder');
    expect(res.loss).toBe(730);
  });

  it('classifies out-of-book 3... c6 with moderate centipawn loss as a tactical slip/mistake, never a blunder', () => {
    // 1. e4 d6 2. Nc3 Nf6 3. Nf3 c6 (ply 6 for Black, out of book according to ecoBook.json)
    const currFen = 'rnbqkb1r/pp2pppp/2pp1n2/8/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 4';
    const prevFen = 'rnbqkb1r/pp2pppp/3p1n2/8/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 1 3';
    // Engine gave White +1.70 (+170) from +0.40 (+40), so Black dropped 130 cp
    const res = classifyMove(40, undefined, 170, undefined, 'b', 6, 'c6', false, prevFen, currFen);
    expect(res.classification).not.toBe('blunder');
    expect(['mistake', 'imprecise']).toContain(res.classification);
    expect(res.loss).toBe(130);
  });

  it('classifies centipawn loss in completely winning position as strong or sound under Win% delta', () => {
    // White was winning +700 cp and played a move dropping to +530 cp (loss 170 cp).
    // Centipawn loss is large, but winning probability drops < 3% (remains > 95% winning).
    const res = classifyMove(700, undefined, 530, undefined, 'w', 25, 'Qe3', false);
    expect(['strong', 'sound']).toContain(res.classification);
  });

  it('classifies missed wins as miss (Missed Tactic)', () => {
    // White was winning +3.50 and dropped to +0.10 (loss 340 cp)
    const res = classifyMove(350, undefined, 10, undefined, 'w', 15, 'Nbd2', false);
    expect(res.classification).toBe('miss');
    expect(res.loss).toBe(340);
  });

  it('classifies book moves with 0 loss and theoretical category', () => {
    const res = classifyMove(0, undefined, 40, undefined, 'w', 1, 'e4', false);
    expect(res.classification).toBe('theoretical');
    expect(res.loss).toBe(0);
  });

  it('classifies exact best move match as optimal with 0 loss', () => {
    const res = classifyMove(100, undefined, 100, undefined, 'w', 15, 'Rad8', true);
    expect(res.classification).toBe('optimal');
    expect(res.loss).toBe(0);
  });

  it('classifies quiet move with moderate centipawn loss as imprecise, not blunder', () => {
    // 8. a3: White eval dropped from +104 to +26 (loss of 78 centipawns)
    const res = classifyMove(104, undefined, 26, undefined, 'w', 15, 'a3', false);
    expect(res.classification).toBe('imprecise');
    expect(res.loss).toBe(78);
  });

  it('classifies sacrifice with winning position as masterstroke', () => {
    // White sacrifices a bishop (starting fen has B, played fen has B gone or traded down)
    const prevFen = 'r1bqk2r/pppp1ppp/2n5/4p3/1bB1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4';
    // Sacrifice bishop on f7 (Bxf7+)
    const playedFen = 'r1bqk2r/pppp1Bpp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4';
    const res = classifyMove(250, undefined, 250, undefined, 'w', 15, 'Bxf7+', true, prevFen, playedFen);
    expect(res.classification).toBe('masterstroke');
  });

  it('classifies only defensive resource under pressure as sharp', () => {
    // Position was unfavorable (-150), best move holds at -20
    const res = classifyMove(-150, undefined, -20, undefined, 'w', 18, 'Kf1', true);
    expect(res.classification).toBe('sharp');
  });

  it('updates shallow evaluation blunders when deeper search depth converges', () => {
    const targetMove: any = {
      ply: 15,
      moveNumber: 8,
      color: 'w',
      san: 'a3',
      from: 'a2',
      to: 'a3',
      fen: 'r2qkb1r/pp1n1ppp/2pp1n2/4p3/4P3/P1NP1B1P/1PP2PP1/R1BQK2R b KQkq - 0 8',
      previousFen: 'r2qkb1r/pp1n1ppp/2pp1n2/4p3/4P3/2NP1B1P/PPP2PP1/R1BQK2R w KQkq - 1 8',
      bestMoveUci: 'e1g1',
      bestMoveSan: 'O-O',
    };

    const prevMove: any = {
      ply: 14,
      moveNumber: 7,
      color: 'b',
      san: 'Nbd7',
      evalScore: 104, // White was +1.04 before 8. a3
    };

    // 1. Shallow depth 5 returns temporary noisy score (-108 cp from White's perspective)
    const shallowUpdated = updateEvaluatedMove(targetMove, prevMove, 15, {
      evalScore: -108,
      bestMoveUci: 'e1g1',
    });
    expect(shallowUpdated.classification).toBe('blunder');
    expect(shallowUpdated.centipawnLoss).toBe(212);

    // 2. Converged depth 16 returns accurate score (+26 cp from White's perspective)
    const deepUpdated = updateEvaluatedMove(shallowUpdated, prevMove, 15, {
      evalScore: 26,
      bestMoveUci: 'e1g1',
    });
    // It MUST NOT stay locked as a blunder! It must update to imprecise!
    expect(deepUpdated.classification).toBe('imprecise');
    expect(deepUpdated.centipawnLoss).toBe(78);

    // 3. When bestmove event arrives (evalScore: undefined), keep deep classification
    const completeUpdated = updateEvaluatedMove(deepUpdated, prevMove, 15, {
      bestMoveUci: 'e1g1',
    });
    expect(completeUpdated.classification).toBe('imprecise');
    expect(completeUpdated.centipawnLoss).toBe(78);
  });

  it('calculates game accuracy and aggregates 10 tiers for both colors', () => {
    const mockMoves: any[] = [
      { ply: 1, moveNumber: 1, color: 'w', san: 'e4', classification: 'theoretical', evalScore: 20 },
      { ply: 2, moveNumber: 1, color: 'b', san: 'e5', classification: 'theoretical', evalScore: 20 },
      { ply: 3, moveNumber: 2, color: 'w', san: 'Nf3', classification: 'optimal', evalScore: 25 },
      { ply: 4, moveNumber: 2, color: 'b', san: 'f6', classification: 'imprecise', evalScore: 120 },
      { ply: 5, moveNumber: 3, color: 'w', san: 'Nxe5', classification: 'masterstroke', evalScore: 280 },
      { ply: 6, moveNumber: 3, color: 'b', san: 'fxe5', classification: 'blunder', evalScore: 600 },
    ];

    const summary = getClassificationSummary(mockMoves);
    expect(summary.whiteAccuracy).toBeGreaterThanOrEqual(90);
    expect(summary.blackAccuracy).toBeLessThan(85);
    expect(summary.items).toHaveLength(10);

    const masterstroke = summary.items.find(i => i.key === 'masterstroke');
    expect(masterstroke?.whiteCount).toBe(1);
    expect(masterstroke?.blackCount).toBe(0);

    const blunder = summary.items.find(i => i.key === 'blunder');
    expect(blunder?.whiteCount).toBe(0);
    expect(blunder?.blackCount).toBe(1);
  });
});
