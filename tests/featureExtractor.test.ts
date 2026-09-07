import { describe, it, expect } from 'vitest';
import { extractPositionalFeatures, summarizeMoveDelta } from '../src/lib/chess/featureExtractor';

describe('Deterministic Feature Extractor', () => {
  it('correctly assesses starting position', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const features = extractPositionalFeatures(startFen);

    expect(features.material.whiteHasBishopPair).toBe(true);
    expect(features.material.blackHasBishopPair).toBe(true);
    expect(features.material.materialDeltaCp).toBe(0);
    expect(features.pawnStructure.whiteIsolatedFiles).toHaveLength(0);
    expect(features.pawnStructure.blackIsolatedFiles).toHaveLength(0);
    expect(features.pawnStructure.isIqpPresent).toBe(false);
    expect(features.tacticalSafety.whiteHangingPieces).toHaveLength(0);
  });

  it('detects an Isolated Queen Pawn (IQP)', () => {
    // Classic IQP on d5 for Black
    const iqpFen = 'r1bq1rk1/pp2bppp/2n1pn2/3P4/3P4/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 9';
    // After 9... exd5, d5 is isolated
    const afterExd5 = 'r1bq1rk1/pp2bppp/2n2n2/3p4/3P4/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 10';
    const features = extractPositionalFeatures(afterExd5);

    expect(features.pawnStructure.blackIsolatedFiles).toContain('d');
    expect(features.pawnStructure.isIqpPresent).toBe(true);

    const deltaNotes = summarizeMoveDelta(iqpFen, afterExd5, 'exd5');
    expect(deltaNotes.some(n => n.includes('isolated Black pawn on the d-file'))).toBe(true);
  });

  it('detects loose and hanging pieces', () => {
    // White knight on a4 is undefended (loose)
    const looseKnightFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/N3P3/5N2/PPPP1PPP/R1BQKB1R b KQkq - 0 4';
    const features = extractPositionalFeatures(looseKnightFen);

    const looseA4 = features.tacticalSafety.whiteLoosePieces.find(p => p.square === 'a4');
    expect(looseA4).toBeDefined();
    expect(looseA4?.piece).toBe('n');
  });
});
