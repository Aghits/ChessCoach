import { Chess, Square, PieceSymbol, Color } from 'chess.js';

export interface PositionalFeatures {
  material: {
    white: Record<PieceSymbol, number>;
    black: Record<PieceSymbol, number>;
    whiteHasBishopPair: boolean;
    blackHasBishopPair: boolean;
    materialDeltaCp: number; // positive = White has more material
  };
  pawnStructure: {
    whiteIsolatedFiles: string[]; // e.g. ['d']
    blackIsolatedFiles: string[];
    whiteDoubledFiles: string[];
    blackDoubledFiles: string[];
    whitePassedPawns: Square[];
    blackPassedPawns: Square[];
    isIqpPresent: boolean; // Isolated Queen Pawn on d4 or d5
  };
  tacticalSafety: {
    whiteLoosePieces: { square: Square; piece: PieceSymbol }[];
    blackLoosePieces: { square: Square; piece: PieceSymbol }[];
    whiteHangingPieces: { square: Square; piece: PieceSymbol }[];
    blackHangingPieces: { square: Square; piece: PieceSymbol }[];
  };
  keySquares: {
    openFiles: string[];
    whiteOutposts: Square[]; // squares safe from black pawns on 4th-6th rank
    blackOutposts: Square[]; // squares safe from white pawns on 3rd-5th rank
  };
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function extractPositionalFeatures(fen: string): PositionalFeatures {
  const chess = new Chess(fen);
  const board = chess.board();

  // 1. Material Count
  const whiteMat: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const blackMat: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

  const whitePawnsByFile: Record<string, number> = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0 };
  const blackPawnsByFile: Record<string, number> = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0 };

  const piecesList: { square: Square; color: Color; type: PieceSymbol }[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const sq = piece.square;
        piecesList.push({ square: sq, color: piece.color, type: piece.type });
        if (piece.color === 'w') {
          whiteMat[piece.type]++;
          if (piece.type === 'p') whitePawnsByFile[sq[0]]++;
        } else {
          blackMat[piece.type]++;
          if (piece.type === 'p') blackPawnsByFile[sq[0]]++;
        }
      }
    }
  }

  const pieceValues: Record<PieceSymbol, number> = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 0 };
  let materialDeltaCp = 0;
  for (const p of ['p', 'n', 'b', 'r', 'q'] as PieceSymbol[]) {
    materialDeltaCp += (whiteMat[p] - blackMat[p]) * pieceValues[p];
  }

  // 2. Pawn Structure
  const whiteIsolatedFiles: string[] = [];
  const blackIsolatedFiles: string[] = [];
  const whiteDoubledFiles: string[] = [];
  const blackDoubledFiles: string[] = [];

  for (let i = 0; i < 8; i++) {
    const file = FILES[i];
    const leftFile = i > 0 ? FILES[i - 1] : null;
    const rightFile = i < 7 ? FILES[i + 1] : null;

    // White isolated
    if (whitePawnsByFile[file] > 0) {
      const hasAdjacent = (leftFile && whitePawnsByFile[leftFile] > 0) || (rightFile && whitePawnsByFile[rightFile] > 0);
      if (!hasAdjacent) whiteIsolatedFiles.push(file);
      if (whitePawnsByFile[file] > 1) whiteDoubledFiles.push(file);
    }

    // Black isolated
    if (blackPawnsByFile[file] > 0) {
      const hasAdjacent = (leftFile && blackPawnsByFile[leftFile] > 0) || (rightFile && blackPawnsByFile[rightFile] > 0);
      if (!hasAdjacent) blackIsolatedFiles.push(file);
      if (blackPawnsByFile[file] > 1) blackDoubledFiles.push(file);
    }
  }

  // Passed Pawns
  const whitePassedPawns: Square[] = [];
  const blackPassedPawns: Square[] = [];

  for (const piece of piecesList) {
    if (piece.type === 'p') {
      const fIdx = FILES.indexOf(piece.square[0]);
      const rank = parseInt(piece.square[1], 10);

      if (piece.color === 'w') {
        // No black pawns on same file or adjacent files with rank > current rank
        let isPassed = true;
        for (let df = -1; df <= 1; df++) {
          const adjFile = FILES[fIdx + df];
          if (!adjFile) continue;
          for (let r = rank + 1; r <= 8; r++) {
            const checkSq = `${adjFile}${r}` as Square;
            const p = chess.get(checkSq);
            if (p && p.color === 'b' && p.type === 'p') {
              isPassed = false;
              break;
            }
          }
          if (!isPassed) break;
        }
        if (isPassed && rank >= 4) whitePassedPawns.push(piece.square);
      } else {
        // Black passed pawn: rank < current rank
        let isPassed = true;
        for (let df = -1; df <= 1; df++) {
          const adjFile = FILES[fIdx + df];
          if (!adjFile) continue;
          for (let r = rank - 1; r >= 1; r--) {
            const checkSq = `${adjFile}${r}` as Square;
            const p = chess.get(checkSq);
            if (p && p.color === 'w' && p.type === 'p') {
              isPassed = false;
              break;
            }
          }
          if (!isPassed) break;
        }
        if (isPassed && rank <= 5) blackPassedPawns.push(piece.square);
      }
    }
  }

  // 3. Tactical Loose & Hanging Pieces
  const whiteLoosePieces: { square: Square; piece: PieceSymbol }[] = [];
  const blackLoosePieces: { square: Square; piece: PieceSymbol }[] = [];
  const whiteHangingPieces: { square: Square; piece: PieceSymbol }[] = [];
  const blackHangingPieces: { square: Square; piece: PieceSymbol }[] = [];

  // Check defenders by temporarily checking attackers of both colors
  for (const item of piecesList) {
    if (item.type === 'k' || item.type === 'p') continue;

    // Check if attacked by opponent
    const opponentColor: Color = item.color === 'w' ? 'b' : 'w';
    const isAttacked = chess.isAttacked(item.square, opponentColor);

    // To check if defended by friendly piece:
    const isDefended = chess.isAttacked(item.square, item.color);

    if (!isDefended) {
      if (item.color === 'w') {
        whiteLoosePieces.push({ square: item.square, piece: item.type });
        if (isAttacked) whiteHangingPieces.push({ square: item.square, piece: item.type });
      } else {
        blackLoosePieces.push({ square: item.square, piece: item.type });
        if (isAttacked) blackHangingPieces.push({ square: item.square, piece: item.type });
      }
    }
  }

  // 4. Open Files & Outposts
  const openFiles: string[] = [];
  for (const file of FILES) {
    if (whitePawnsByFile[file] === 0 && blackPawnsByFile[file] === 0) {
      openFiles.push(file);
    }
  }

  // Outpost squares for knights: 4th-6th rank for white, 3rd-5th for black
  const whiteOutposts: Square[] = [];
  const blackOutposts: Square[] = [];

  for (let r = 4; r <= 6; r++) {
    for (let c = 1; c <= 6; c++) {
      const sq = `${FILES[c]}${r}` as Square;
      // White outpost: Cannot be attacked by black pawns from c-1, c+1
      const leftPawn = chess.get(`${FILES[c - 1]}7` as Square);
      const rightPawn = chess.get(`${FILES[c + 1]}7` as Square);
      if ((!leftPawn || leftPawn.type !== 'p') && (!rightPawn || rightPawn.type !== 'p')) {
        whiteOutposts.push(sq);
      }
    }
  }

  return {
    material: {
      white: whiteMat,
      black: blackMat,
      whiteHasBishopPair: whiteMat.b >= 2,
      blackHasBishopPair: blackMat.b >= 2,
      materialDeltaCp,
    },
    pawnStructure: {
      whiteIsolatedFiles,
      blackIsolatedFiles,
      whiteDoubledFiles,
      blackDoubledFiles,
      whitePassedPawns,
      blackPassedPawns,
      isIqpPresent: whiteIsolatedFiles.includes('d') || blackIsolatedFiles.includes('d'),
    },
    tacticalSafety: {
      whiteLoosePieces,
      blackLoosePieces,
      whiteHangingPieces,
      blackHangingPieces,
    },
    keySquares: {
      openFiles,
      whiteOutposts: whiteOutposts.slice(0, 3),
      blackOutposts: blackOutposts.slice(0, 3),
    },
  };
}

/**
 * Summarize positional diff between position before move and position after move.
 */
export function summarizeMoveDelta(prevFen: string, currentFen: string, moveSan: string): string[] {
  const before = extractPositionalFeatures(prevFen);
  const after = extractPositionalFeatures(currentFen);
  const notes: string[] = [];

  // Check new isolated pawns
  for (const f of after.pawnStructure.whiteIsolatedFiles) {
    if (!before.pawnStructure.whiteIsolatedFiles.includes(f)) {
      notes.push(`Creates an isolated White pawn on the ${f}-file.`);
    }
  }
  for (const f of after.pawnStructure.blackIsolatedFiles) {
    if (!before.pawnStructure.blackIsolatedFiles.includes(f)) {
      notes.push(`Creates an isolated Black pawn on the ${f}-file.`);
    }
  }

  // Check bishop pair lost
  if (before.material.whiteHasBishopPair && !after.material.whiteHasBishopPair) {
    notes.push('White concedes the bishop pair.');
  }
  if (before.material.blackHasBishopPair && !after.material.blackHasBishopPair) {
    notes.push('Black concedes the bishop pair.');
  }

  // Check loose/hanging pieces
  if (after.tacticalSafety.whiteHangingPieces.length > before.tacticalSafety.whiteHangingPieces.length) {
    const hanging = after.tacticalSafety.whiteHangingPieces.map(p => `${p.piece.toUpperCase()} on ${p.square}`).join(', ');
    notes.push(`Leaves White piece hanging: ${hanging}.`);
  }
  if (after.tacticalSafety.blackHangingPieces.length > before.tacticalSafety.blackHangingPieces.length) {
    const hanging = after.tacticalSafety.blackHangingPieces.map(p => `${p.piece.toUpperCase()} on ${p.square}`).join(', ');
    notes.push(`Leaves Black piece hanging: ${hanging}.`);
  }

  if (notes.length === 0) {
    notes.push(`Move ${moveSan} alters square control and piece placement.`);
  }

  return notes;
}

export interface FormattedRefutationMove {
  uci: string;
  san: string;
  moveNumber: number;
  color: 'w' | 'b';
  notation: string; // e.g. "13... Bxe3" or "14. fxe3"
  fenAfter: string;
  movingPieceName?: string;
  capturedPieceName?: string;
}

export interface RefutationDetails {
  moves: FormattedRefutationMove[];
  lineSan: string;
  tacticalSummary?: string;
  threatenedPieceName?: string;
  threatenedSquare?: string;
  attackerPieceName?: string;
  isExchange?: boolean;
  exchangeSummary?: string;
}

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export interface PlayedMoveContext {
  from?: string;
  to?: string;
  san?: string;
  capturedPieceType?: PieceSymbol;
  centipawnLoss?: number;
  classification?: string;
}

/**
 * Converts raw engine UCI moves (e.g. ["c5e3", "f2e3"]) into rich SAN moves
 * and identifies concrete moving/captured pieces on the board.
 */
export function formatRefutationLine(
  fen: string,
  pvUci: string[],
  startPly: number,
  playedMoveContext?: PlayedMoveContext
): RefutationDetails {
  if (!fen || !pvUci || pvUci.length === 0) {
    return { moves: [], lineSan: '' };
  }

  const moves: FormattedRefutationMove[] = [];
  const lineParts: string[] = [];
  let tacticalSummary: string | undefined;
  let threatenedPieceName: string | undefined;
  let threatenedSquare: string | undefined;
  let attackerPieceName: string | undefined;
  let isExchange = false;
  let exchangeSummary: string | undefined;

  try {
    const chess = new Chess(fen);
    let currentPly = startPly;

    for (const uci of pvUci) {
      if (!uci || uci.length < 4) break;
      const from = uci.substring(0, 2) as Square;
      const to = uci.substring(2, 4) as Square;
      const promo = uci.length > 4 ? uci[4] : undefined;

      const movingPiece = chess.get(from);
      const targetPiece = chess.get(to);

      const res = chess.move({ from, to, promotion: promo });
      if (!res) break;

      currentPly++;
      const moveNumber = Math.ceil(currentPly / 2);
      const color: 'w' | 'b' = res.color;
      const notation =
        color === 'b' && moves.length === 0
          ? `${moveNumber}... ${res.san}`
          : color === 'w'
          ? `${moveNumber}. ${res.san}`
          : res.san;

      const movingPieceName = movingPiece
        ? `${movingPiece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[movingPiece.type] || 'piece'}`
        : undefined;

      const capturedPieceName = targetPiece
        ? `${targetPiece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[targetPiece.type] || 'piece'} on ${to}`
        : undefined;

      if (!threatenedPieceName && targetPiece && moves.length === 0) {
        // Check if this first refutation move is a recapture/trade of the piece that just moved
        const isRecaptureOnSameSquare = Boolean(playedMoveContext?.to && playedMoveContext.to === to);
        const playedCapturedType = playedMoveContext?.capturedPieceType;
        const targetType = targetPiece.type;

        const isTradeOfPieces =
          isRecaptureOnSameSquare &&
          playedCapturedType !== undefined &&
          Math.abs(PIECE_VALUES[playedCapturedType] - PIECE_VALUES[targetType]) <= 1;

        if (isTradeOfPieces) {
          isExchange = true;
          exchangeSummary = `Trade of ${PIECE_NAMES[targetType]}s on ${to}`;
          tacticalSummary = `Recapture: ${movingPieceName || 'Opponent'} recaptures on ${to} (${res.san}), completing the exchange of ${PIECE_NAMES[targetType]}s.`;
        } else {
          // If not an equal trade, check if this is a minor positional slip (< 150 cp)
          const isHighLoss =
            (playedMoveContext?.centipawnLoss ?? 0) >= 150 ||
            playedMoveContext?.classification === 'blunder' ||
            playedMoveContext?.classification === 'miss' ||
            playedMoveContext?.classification === 'mistake';

          const isMajorPiece = PIECE_VALUES[targetType] >= 3;

          if (!isHighLoss && isMajorPiece && playedMoveContext) {
            // A low centipawn loss cannot be a free major piece blunder; treat as exchange / simplification
            isExchange = true;
            exchangeSummary = `Exchange involving ${PIECE_NAMES[targetType]} on ${to}`;
            tacticalSummary = `${movingPieceName || 'Piece'} recaptures on ${to} (${res.san}).`;
          } else {
            threatenedPieceName = `${targetPiece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[targetPiece.type]} on ${to}`;
            threatenedSquare = to;
            attackerPieceName = movingPieceName;
            tacticalSummary = `${movingPieceName || 'Piece'} captures ${threatenedPieceName}`;
          }
        }
      }

      moves.push({
        uci,
        san: res.san,
        moveNumber,
        color,
        notation,
        fenAfter: chess.fen(),
        movingPieceName,
        capturedPieceName,
      });

      lineParts.push(notation);
    }
  } catch (err) {
    console.warn('Failed to format refutation line:', err);
  }

  return {
    moves,
    lineSan: lineParts.join(' '),
    tacticalSummary,
    threatenedPieceName,
    threatenedSquare,
    attackerPieceName,
    isExchange,
    exchangeSummary,
  };
}

export interface ConcreteMoveDelta {
  pieceName: string;
  from: string;
  to: string;
  san: string;
  capturedPieceName?: string;
  isCapture: boolean;
  promotion?: string;
  inCheck?: boolean;
  squaresAttacked?: string[];
  enemyPiecesAttacked?: string[];
  friendlyPiecesDefended?: string[];
}

export interface ActiveBoardThreat {
  targetSquare: string;
  targetPiece: string;
  attackerSquare: string;
  attackerPiece: string;
  isDefended: boolean;
  summary: string;
}

/**
 * Deterministically extracts verified board threats and hanging pieces.
 */
export function extractBoardThreats(fen: string): ActiveBoardThreat[] {
  const threats: ActiveBoardThreat[] = [];
  try {
    const chess = new Chess(fen);
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece || piece.type === 'k') continue;
        const opponentColor: Color = piece.color === 'w' ? 'b' : 'w';
        const attackerSquares = chess.attackers(piece.square, opponentColor);
        if (attackerSquares.length > 0) {
          const defenderSquares = chess.attackers(piece.square, piece.color);
          const isDefended = defenderSquares.length > 0;
          for (const aSq of attackerSquares) {
            const attacker = chess.get(aSq);
            if (attacker) {
              const targetDesc = `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[piece.type] || piece.type} on ${piece.square}`;
              const attackerDesc = `${attacker.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[attacker.type] || attacker.type} on ${aSq}`;
              threats.push({
                targetSquare: piece.square,
                targetPiece: targetDesc,
                attackerSquare: aSq,
                attackerPiece: attackerDesc,
                isDefended,
                summary: `${targetDesc} is attacked by ${attackerDesc} (${isDefended ? 'defended' : 'undefended / hanging'})`,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to extract board threats:', err);
  }
  return threats;
}

/**
 * Deterministically extracts verified chess board changes for a move
 * from the position before the move, preventing LLM hallucinations.
 */
export function describeMoveDelta(
  fenBefore: string,
  moveSan: string,
  moveUci?: string
): ConcreteMoveDelta {
  try {
    const chess = new Chess(fenBefore);
    let moveRes = null;

    if (moveSan) {
      try {
        moveRes = chess.move(moveSan);
      } catch {}
    }

    if (!moveRes && moveUci && moveUci.length >= 4) {
      try {
        const from = moveUci.substring(0, 2) as Square;
        const to = moveUci.substring(2, 4) as Square;
        const promo = moveUci.length > 4 ? moveUci[4] : undefined;
        moveRes = chess.move({ from, to, promotion: promo });
      } catch {}
    }

    if (moveRes) {
      const pieceName = PIECE_NAMES[moveRes.piece] || 'piece';
      const capturedPieceName = moveRes.captured ? PIECE_NAMES[moveRes.captured] || 'piece' : undefined;
      const squaresAttacked: string[] = [];
      const enemyPiecesAttacked: string[] = [];
      const friendlyPiecesDefended: string[] = [];

      try {
        const toSq = moveRes.to as Square;
        const pieceColor = moveRes.color;
        const opponentColor = pieceColor === 'w' ? 'b' : 'w';
        for (const f of FILES) {
          for (let r = 1; r <= 8; r++) {
            const checkSq = `${f}${r}` as Square;
            const attackersOfSq = chess.attackers(checkSq, pieceColor);
            if (attackersOfSq.includes(toSq)) {
              squaresAttacked.push(checkSq);
              const target = chess.get(checkSq);
              if (target) {
                const desc = `${target.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[target.type] || target.type} on ${checkSq}`;
                if (target.color === opponentColor) {
                  enemyPiecesAttacked.push(desc);
                } else {
                  friendlyPiecesDefended.push(desc);
                }
              }
            }
          }
        }
      } catch {}

      return {
        pieceName,
        from: moveRes.from,
        to: moveRes.to,
        san: moveRes.san,
        capturedPieceName,
        isCapture: Boolean(moveRes.captured),
        promotion: moveRes.promotion,
        inCheck: chess.inCheck(),
        squaresAttacked,
        enemyPiecesAttacked,
        friendlyPiecesDefended,
      };
    }
  } catch (err) {
    console.warn('Failed to describe move delta:', err);
  }

  return {
    pieceName: 'piece',
    from: moveUci ? moveUci.substring(0, 2) : '',
    to: moveUci ? moveUci.substring(2, 4) : '',
    san: moveSan,
    isCapture: moveSan.includes('x'),
  };
}


