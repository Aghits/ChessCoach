import { Chess, PieceSymbol } from 'chess.js';

export interface AllowedBoardContext {
  playedMoveSquares: string[]; // e.g. ['e2', 'e4']
  bestMoveSquares: string[];   // e.g. ['d2', 'd4']
  pvSquares: string[];         // squares in engine PV line
  featureSquares: string[];    // squares mentioned in detected features (hanging pieces, isolated pawns, outposts)
  fens?: string[];             // verified board FEN states
}

const PIECE_TYPES: Record<string, PieceSymbol> = {
  pawn: 'p',
  knight: 'n',
  bishop: 'b',
  rook: 'r',
  queen: 'q',
  king: 'k',
};

export interface PieceValidationResult {
  isValid: boolean;
  invalidClaims: string[];
}

/**
 * Validates that any piece claims like "rook on b4" or "b4 rook" match an actual piece
 * in at least one of the verified board states (before move, after move, or after engine move).
 */
export function validatePiecePlacement(
  text: string,
  fens: string[]
): PieceValidationResult {
  if (!text || !fens || fens.length === 0) return { isValid: true, invalidClaims: [] };

  const validFens = fens.filter(Boolean);
  if (validFens.length === 0) return { isValid: true, invalidClaims: [] };

  const invalidClaims: string[] = [];

  // Pattern 1: [color] [piece] on/at [square] (e.g. "Black rook on b4" or "rook at b4")
  const pattern1 = /(?:(white|black)\s+)?\b(pawn|knight|bishop|rook|queen|king)\s+(?:on|at)\s+([a-h][1-8])\b/gi;
  let m1: RegExpExecArray | null;
  while ((m1 = pattern1.exec(text)) !== null) {
    checkClaim(m1[0], m1[1], m1[2], m1[3]);
  }

  // Pattern 2: [color] [square] [piece] (e.g. "b4 rook" or "Black h5 rook")
  const pattern2 = /(?:(white|black)\s+)?\b([a-h][1-8])\s+(pawn|knight|bishop|rook|queen|king)\b/gi;
  let m2: RegExpExecArray | null;
  while ((m2 = pattern2.exec(text)) !== null) {
    checkClaim(m2[0], m2[1], m2[3], m2[2]);
  }

  function checkClaim(fullText: string, colorStr: string | undefined, pieceStr: string, sq: string) {
    const expectedType = PIECE_TYPES[pieceStr.toLowerCase()];
    if (!expectedType) return;
    const expectedColor = colorStr ? (colorStr.toLowerCase() === 'white' ? 'w' : 'b') : null;

    const foundValid = validFens.some((fen) => {
      try {
        const c = new Chess(fen);
        const actual = c.get(sq as any);
        if (!actual) return false;
        if (actual.type !== expectedType) return false;
        if (expectedColor && actual.color !== expectedColor) return false;
        return true;
      } catch {
        return false;
      }
    });

    if (!foundValid) {
      invalidClaims.push(fullText);
    }
  }

  return {
    isValid: invalidClaims.length === 0,
    invalidClaims: Array.from(new Set(invalidClaims)),
  };
}

/**
 * Validates that any chessboard square ([a-h][1-8]) mentioned in the generated text
 * belongs to the verified board context. Returns true if clean, false if hallucinated squares are present.
 */
export function validateBoardSquares(
  text: string,
  context: AllowedBoardContext
): { isValid: boolean; hallucinatedSquares: string[] } {
  const allowed = new Set<string>([
    ...context.playedMoveSquares,
    ...context.bestMoveSquares,
    ...context.pvSquares,
    ...context.featureSquares,
  ]);

  const squareMatches = text.match(/\b[a-h][1-8]\b/g) || [];
  const uniqueMentioned = Array.from(new Set(squareMatches));
  const hallucinated: string[] = [];

  for (const sq of uniqueMentioned) {
    if (!allowed.has(sq)) {
      hallucinated.push(sq);
    }
  }

  return {
    isValid: hallucinated.length === 0,
    hallucinatedSquares: hallucinated,
  };
}

/**
 * Validates text against both square context and piece-on-square factual placements.
 */
export function validateExplanationText(
  text: string,
  context: AllowedBoardContext
): { isValid: boolean; reason?: string } {
  const squareCheck = validateBoardSquares(text, context);
  if (!squareCheck.isValid) {
    return {
      isValid: false,
      reason: `Mentioned squares not on board: ${squareCheck.hallucinatedSquares.join(', ')}`,
    };
  }

  if (context.fens && context.fens.length > 0) {
    const pieceCheck = validatePiecePlacement(text, context.fens);
    if (!pieceCheck.isValid) {
      return {
        isValid: false,
        reason: `Hallucinated piece placements: ${pieceCheck.invalidClaims.join(', ')}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Sanitizes or softens hallucinated square mentions if present.
 */
export function sanitizeHallucinations(text: string, hallucinatedSquares: string[]): string {
  let cleaned = text;
  for (const sq of hallucinatedSquares) {
    // Replace hallucinated square references like "knight on f7" -> "knight"
    const regex = new RegExp(`\\s*(?:on|to|from)?\\s*\\b${sq}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }
  return cleaned.trim();
}
