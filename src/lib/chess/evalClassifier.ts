import { Chess } from 'chess.js';
import { MoveClassification, EvaluatedMove } from './types';
import { isBookPosition, getOpeningByFen } from './openingBook';

const COMMON_BOOK_MOVES = new Set([
  // Pawn moves
  'e4', 'd4', 'c4', 'Nf3', 'g3', 'b3', 'f4', 'Nc3',
  'e5', 'c5', 'e6', 'c6', 'd5', 'Nf6', 'g6', 'd6', 'b6', 'Nc6',
  'a3', 'a6', 'h3', 'h6', 'c3', 'd3', 'e3', 'b4', 'b5', 'g4', 'g5',
  // Minor piece moves & castling
  'Bc4', 'Bb5', 'Be2', 'Bd3', 'Bd2', 'Bb4', 'Be3', 'Bf4', 'Bg5', 'Bg2',
  'Be7', 'Bd6', 'Bd7', 'Bg7', 'Bb7', 'Be6', 'Bf5', 'Bg4',
  'Nbd2', 'Nbd7', 'Nd2', 'Nd7', 'Ne2', 'Ne7', 'O-O', 'O-O-O',
  // Standard opening captures
  'exd4', 'cxd4', 'Nxd4', 'exd5', 'cxd5', 'Nxd5', 'Bxf3', 'Bxf6', 'Qxf3', 'Qxf6'
]);

export function isBookMove(ply?: number, san?: string, fen?: string): boolean {
  if (fen) {
    return isBookPosition(fen);
  }
  return ply !== undefined && san !== undefined && ply <= 14 && COMMON_BOOK_MOVES.has(san);
}

const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 0,
};

export function getMaterialScore(fen: string, color: 'w' | 'b'): number {
  const position = fen.split(' ')[0];
  let total = 0;
  for (const char of position) {
    const isUpper = char === char.toUpperCase() && char !== char.toLowerCase();
    const pieceColor = isUpper ? 'w' : 'b';
    if (pieceColor === color) {
      const val = PIECE_VALUES[char.toLowerCase()] || 0;
      total += val;
    }
  }
  return total;
}

export function getPieceAtSquare(fen: string, square: string): string | null {
  if (!square || square.length !== 2) return null;
  const file = square.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
  const rank = 8 - parseInt(square[1], 10); // '8' -> 0, '1' -> 7
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;

  const rows = fen.split(' ')[0].split('/');
  if (rows.length !== 8) return null;

  const row = rows[rank];
  let currentFile = 0;
  for (const char of row) {
    if (char >= '1' && char <= '8') {
      currentFile += parseInt(char, 10);
    } else {
      if (currentFile === file) {
        return char;
      }
      currentFile++;
    }
  }
  return null;
}

export function isSacrificeMove(
  san?: string,
  prevFen?: string,
  currFen?: string,
  playerColor: 'w' | 'b' = 'w'
): boolean {
  if (!prevFen) return false;
  // 1. Material dropped on this move
  const matBefore = getMaterialScore(prevFen, playerColor);
  if (currFen) {
    const matAfter = getMaterialScore(currFen, playerColor);
    if (matAfter <= matBefore - 150) return true;
  }
  // 2. High-value piece captured lower-value piece (e.g. Bxf7, Rxf6, Qxf7)
  if (san && san.includes('x')) {
    const pieceChar = san[0];
    if (['N', 'B', 'R', 'Q'].includes(pieceChar)) {
      const destMatch = san.match(/([a-h][1-8])/);
      if (destMatch) {
        const destSquare = destMatch[1];
        const capturedPiece = getPieceAtSquare(prevFen, destSquare);
        if (capturedPiece) {
          const movingVal = PIECE_VALUES[pieceChar.toLowerCase()] || 0;
          const capturedVal = PIECE_VALUES[capturedPiece.toLowerCase()] || 0;
          if (movingVal - capturedVal >= 150) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function classifyMove(
  evalBefore: number | undefined,
  mateBefore: number | undefined,
  evalAfter: number | undefined,
  mateAfter: number | undefined,
  playerColor: 'w' | 'b',
  ply?: number,
  san?: string,
  isExactBestMatch?: boolean,
  prevFen?: string,
  currFen?: string
): { classification: MoveClassification; loss: number } {
  // 1. Standard opening book move: check ECO database or standard opening moves
  if ((currFen && isBookPosition(currFen)) || (ply !== undefined && san && isBookMove(ply, san, currFen))) {
    return { classification: 'theoretical', loss: 0 };
  }

  const isWhite = playerColor === 'w';

  // 2. Handle mates
  if (mateAfter !== undefined) {
    const oppMates = (isWhite && mateAfter < 0) || (!isWhite && mateAfter > 0);
    const oppHadMateBefore = (isWhite && mateBefore !== undefined && mateBefore < 0) ||
                             (!isWhite && mateBefore !== undefined && mateBefore > 0);

    if (oppMates && !oppHadMateBefore) {
      return { classification: 'blunder', loss: 800 };
    }
  }

  if (mateBefore !== undefined) {
    const playerHadMate = (isWhite && mateBefore > 0) || (!isWhite && mateBefore < 0);
    const playerStillMates = (isWhite && mateAfter !== undefined && mateAfter > 0) ||
                             (!isWhite && mateAfter !== undefined && mateAfter < 0);

    if (playerHadMate && !playerStillMates) {
      const scoreAfterVal = evalAfter !== undefined ? (isWhite ? evalAfter : -evalAfter) : 0;
      if (scoreAfterVal < -100) {
        return { classification: 'blunder', loss: 800 };
      }
      if (scoreAfterVal < 100) {
        return { classification: 'miss', loss: 600 };
      }
      return { classification: 'mistake', loss: 400 };
    }
  }

  if (evalBefore === undefined || evalAfter === undefined) {
    return { classification: 'sound', loss: 0 };
  }

  // Calculate scores from the perspective of the player making the move
  const scoreBefore = isWhite ? evalBefore : -evalBefore;
  const scoreAfter = isWhite ? evalAfter : -evalAfter;
  const loss = Math.max(0, scoreBefore - scoreAfter);

  // Calculate Win Probability Delta (CAPS model)
  const wpBefore = winProbability(scoreBefore);
  const wpAfter = winProbability(scoreAfter);
  const wpLoss = Math.max(0, wpBefore - wpAfter);

  // 3. Missed Tactic (miss):
  // Player had a winning advantage (scoreBefore >= 200 or mate), but let it vanish without collapsing into a lost position.
  // If the move collapses into a lost position (scoreAfter < -100), it is a Critical Blunder, NOT a Miss!
  if (scoreBefore >= 200 && scoreAfter < 100 && scoreAfter >= -100 && (loss >= 120 || wpLoss >= 0.18)) {
    return { classification: 'miss', loss };
  }

  // 4. Masterstroke (sacrifice where position remains strongly winning)
  if ((isExactBestMatch || wpLoss <= 0.02 || loss <= 10) && scoreAfter >= 150) {
    if (isSacrificeMove(san, prevFen, currFen, playerColor)) {
      return { classification: 'masterstroke', loss: 0 };
    }
  }

  // 5. Sharp Find:
  // Best move found in a difficult/unfavorable position (scoreBefore <= -50) that recovers/holds (scoreAfter >= -40)
  if ((isExactBestMatch || wpLoss <= 0.02 || loss <= 10) && scoreBefore <= -50 && scoreAfter >= -40) {
    return { classification: 'sharp', loss: 0 };
  }

  // 6. Optimal (Best move: top engine move or negligible win% change <= 1.5% or loss <= 10 cp)
  if (isExactBestMatch || wpLoss <= 0.015 || loss <= 10) {
    return { classification: 'optimal', loss };
  }

  // 7. Strong: <= 4% win probability loss
  if (wpLoss <= 0.04) {
    return { classification: 'strong', loss };
  }

  // 8. Sound: <= 8% win probability loss
  if (wpLoss <= 0.08) {
    return { classification: 'sound', loss };
  }

  // 9. Imprecise: 8% < wpLoss <= 16%
  if (wpLoss <= 0.16) {
    return { classification: 'imprecise', loss };
  }

  // 10. Critical Blunder:
  // Must represent a game-losing error into an unfavorable position:
  // - High centipawn loss (loss >= 160) AND substantial win% drop (wpLoss >= 0.22) into a lost position (scoreAfter <= -120)
  // - Or catastrophic material loss (loss >= 200 and wpLoss >= 0.25) into a lost position (scoreAfter < -50)
  // Note: Early opening safeguard (ply <= 12): developing or passive moves with moderate loss (< 200 cp)
  // are never blunders unless they hang major material (loss >= 200) or allow forced mate.
  const isEarlyOpening = ply !== undefined && ply <= 12;
  const isCatastrophicDrop = !isEarlyOpening && wpLoss >= 0.22 && loss >= 160 && scoreAfter <= -120;
  const isSevereBlunder = wpLoss >= 0.25 && loss >= 200 && scoreAfter < -50;
  if (isCatastrophicDrop || isSevereBlunder) {
    return { classification: 'blunder', loss };
  }

  // 11. Tactical Slip / Mistake: 16% < wpLoss <= 25%, or large drop that leaves position equal
  return { classification: 'mistake', loss };
}

/**
 * Calculates winning probability from centipawn score.
 * Formula: P(win) = 1 / (1 + 10^(-score / 400))
 */
export function winProbability(scoreCp: number): number {
  return 1 / (1 + Math.pow(10, -scoreCp / 400));
}

/**
 * Calculates move accuracy (0 - 100%) based on win probability delta.
 */
export function calculateMoveAccuracy(
  evalBefore: number | undefined,
  evalAfter: number | undefined,
  playerColor: 'w' | 'b',
  isBook?: boolean
): number {
  if (isBook) return 100;
  if (evalBefore === undefined || evalAfter === undefined) return 100;

  const scoreBefore = playerColor === 'w' ? evalBefore : -evalBefore;
  const scoreAfter = playerColor === 'w' ? evalAfter : -evalAfter;

  const cpLoss = Math.max(0, scoreBefore - scoreAfter);
  if (cpLoss <= 10) return 100;

  const wpBefore = winProbability(scoreBefore);
  const wpAfter = winProbability(scoreAfter);
  const wpLoss = Math.max(0, wpBefore - wpAfter);

  const acc = 100 * (1 - 2 * wpLoss);
  return Math.max(0, Math.min(100, Math.round(acc * 10) / 10));
}

/**
 * Calculates total game accuracy for a given player color ('w' or 'b').
 */
export function calculatePlayerAccuracy(moves: EvaluatedMove[], color: 'w' | 'b'): number {
  const playerMoves = moves.filter((m) => m.color === color);
  if (playerMoves.length === 0) return 100;

  let totalAccuracy = 0;
  let evaluatedCount = 0;

  for (let i = 0; i < playerMoves.length; i++) {
    const move = playerMoves[i];
    const isBook =
      move.classification === 'theoretical' ||
      move.classification === 'book' ||
      isBookMove(move.ply, move.san);

    const moveIndex = moves.findIndex((m) => m.ply === move.ply);
    const prevEval = moveIndex > 0 ? moves[moveIndex - 1]?.evalScore : 0;
    const currEval = move.evalScore;

    const acc = calculateMoveAccuracy(prevEval, currEval, color, isBook);
    totalAccuracy += acc;
    evaluatedCount++;
  }

  return evaluatedCount > 0 ? Math.round((totalAccuracy / evaluatedCount) * 10) / 10 : 100;
}

export interface ClassificationSummaryItem {
  key: MoveClassification;
  name: string;
  symbol: string;
  whiteCount: number;
  blackCount: number;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export function getClassificationSummary(moves: EvaluatedMove[]): {
  whiteAccuracy: number;
  blackAccuracy: number;
  items: ClassificationSummaryItem[];
} {
  const whiteAccuracy = calculatePlayerAccuracy(moves, 'w');
  const blackAccuracy = calculatePlayerAccuracy(moves, 'b');

  const counts: Record<string, { w: number; b: number }> = {
    masterstroke: { w: 0, b: 0 },
    sharp: { w: 0, b: 0 },
    theoretical: { w: 0, b: 0 },
    optimal: { w: 0, b: 0 },
    strong: { w: 0, b: 0 },
    sound: { w: 0, b: 0 },
    imprecise: { w: 0, b: 0 },
    mistake: { w: 0, b: 0 },
    miss: { w: 0, b: 0 },
    blunder: { w: 0, b: 0 },
  };

  for (const m of moves) {
    let cls = m.classification || 'sound';
    // Map aliases
    if (cls === 'book') cls = 'theoretical';
    else if (cls === 'best') cls = 'optimal';
    else if (cls === 'good') cls = 'sound';
    else if (cls === 'inaccuracy') cls = 'imprecise';

    if (counts[cls]) {
      counts[cls][m.color]++;
    }
  }

  const items: ClassificationSummaryItem[] = [
    {
      key: 'masterstroke',
      name: 'Masterstroke',
      symbol: '!!',
      whiteCount: counts.masterstroke.w,
      blackCount: counts.masterstroke.b,
      badgeBg: 'bg-teal-500',
      badgeBorder: 'border-teal-400',
      badgeText: 'text-white',
    },
    {
      key: 'sharp',
      name: 'Sharp Find',
      symbol: '!',
      whiteCount: counts.sharp.w,
      blackCount: counts.sharp.b,
      badgeBg: 'bg-blue-500',
      badgeBorder: 'border-blue-400',
      badgeText: 'text-white',
    },
    {
      key: 'theoretical',
      name: 'Theoretical',
      symbol: '📖',
      whiteCount: counts.theoretical.w,
      blackCount: counts.theoretical.b,
      badgeBg: 'bg-amber-800',
      badgeBorder: 'border-amber-600',
      badgeText: 'text-amber-100',
    },
    {
      key: 'optimal',
      name: 'Optimal',
      symbol: '★',
      whiteCount: counts.optimal.w,
      blackCount: counts.optimal.b,
      badgeBg: 'bg-emerald-600',
      badgeBorder: 'border-emerald-400',
      badgeText: 'text-white',
    },
    {
      key: 'strong',
      name: 'Strong',
      symbol: '👍',
      whiteCount: counts.strong.w,
      blackCount: counts.strong.b,
      badgeBg: 'bg-lime-600',
      badgeBorder: 'border-lime-400',
      badgeText: 'text-white',
    },
    {
      key: 'sound',
      name: 'Sound',
      symbol: '✓',
      whiteCount: counts.sound.w,
      blackCount: counts.sound.b,
      badgeBg: 'bg-teal-700',
      badgeBorder: 'border-teal-500',
      badgeText: 'text-teal-100',
    },
    {
      key: 'imprecise',
      name: 'Imprecise',
      symbol: '?!',
      whiteCount: counts.imprecise.w,
      blackCount: counts.imprecise.b,
      badgeBg: 'bg-yellow-500',
      badgeBorder: 'border-yellow-300',
      badgeText: 'text-zinc-950',
    },
    {
      key: 'mistake',
      name: 'Tactical Slip',
      symbol: '?',
      whiteCount: counts.mistake.w,
      blackCount: counts.mistake.b,
      badgeBg: 'bg-orange-500',
      badgeBorder: 'border-orange-400',
      badgeText: 'text-white',
    },
    {
      key: 'miss',
      name: 'Missed Tactic',
      symbol: '❌',
      whiteCount: counts.miss.w,
      blackCount: counts.miss.b,
      badgeBg: 'bg-rose-500',
      badgeBorder: 'border-rose-400',
      badgeText: 'text-white',
    },
    {
      key: 'blunder',
      name: 'Critical Blunder',
      symbol: '??',
      whiteCount: counts.blunder.w,
      blackCount: counts.blunder.b,
      badgeBg: 'bg-red-600',
      badgeBorder: 'border-red-400',
      badgeText: 'text-white',
    },
  ];

  return {
    whiteAccuracy,
    blackAccuracy,
    items,
  };
}

/**
 * Convert a UCI move string (e.g. "e2e4", "e7e8q") to Standard Algebraic Notation (SAN)
 * using the board state before the move.
 */
export function uciToSan(fen: string, uciMove: string): string {
  if (!uciMove || uciMove.length < 4) return uciMove;

  try {
    const chess = new Chess(fen);
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    const res = chess.move({ from, to, promotion });
    return res ? res.san : uciMove;
  } catch {
    return uciMove;
  }
}

/**
 * Updates an evaluated move's classification and centipawn loss dynamically as
 * Stockfish search depth increases, without freezing early shallow results.
 */
export function updateEvaluatedMove(
  target: EvaluatedMove,
  prevMove: EvaluatedMove | undefined,
  currentPly: number,
  evalData: {
    evalScore?: number;
    mateScore?: number;
    bestMoveUci?: string;
    pvLine?: string[];
  }
): EvaluatedMove {
  const opening = target.fen ? getOpeningByFen(target.fen) : null;
  const isBook = Boolean(
    opening ||
    (target.fen && isBookPosition(target.fen)) ||
    isBookMove(currentPly, target.san, target.fen)
  );

  // If it's a book move, keep theoretical status with 0 loss and attach opening metadata
  if (isBook) {
    return {
      ...target,
      evalScore: evalData.evalScore !== undefined ? evalData.evalScore : target.evalScore,
      mateScore: evalData.mateScore !== undefined ? evalData.mateScore : target.mateScore,
      classification: 'theoretical',
      centipawnLoss: 0,
      bestMoveSan: target.san,
      bestMoveUci: `${target.from}${target.to}`,
      pvLine: evalData.pvLine || target.pvLine,
      openingName: opening?.name || target.openingName,
      eco: opening?.eco || target.eco,
      isBook: true,
    };
  }

  const playedUci = `${target.from}${target.to}`;
  const isExactMatch = target.bestMoveUci ? target.bestMoveUci.startsWith(playedUci) : false;

  let classification = target.classification;
  let centipawnLoss = target.centipawnLoss;

  if (evalData.evalScore !== undefined) {
    const prevEvalScore = prevMove?.evalScore !== undefined ? prevMove.evalScore : 0;
    const prevMateScore = prevMove?.mateScore;

    const classified = classifyMove(
      prevEvalScore,
      prevMateScore,
      evalData.evalScore,
      evalData.mateScore,
      target.color,
      currentPly,
      target.san,
      isExactMatch,
      target.previousFen,
      target.fen
    );
    classification = classified.classification;
    centipawnLoss = classified.loss;
  }

  let bestUci = target.bestMoveUci;
  let bestSan = target.bestMoveSan;

  if (isExactMatch || classification === 'optimal' || classification === 'best') {
    bestUci = playedUci;
    bestSan = target.san;
  }

  return {
    ...target,
    evalScore: evalData.evalScore !== undefined ? evalData.evalScore : target.evalScore,
    mateScore: evalData.mateScore !== undefined ? evalData.mateScore : target.mateScore,
    bestMoveUci: bestUci,
    bestMoveSan: bestSan,
    classification,
    centipawnLoss,
    pvLine: evalData.pvLine || target.pvLine,
    openingName: opening?.name || target.openingName,
    eco: opening?.eco || target.eco,
    isBook: false,
  };
}

