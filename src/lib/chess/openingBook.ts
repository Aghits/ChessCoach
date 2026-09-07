import ecoBookData from './ecoBook.json';

export interface OpeningInfo {
  name: string;
  eco: string;
}

const bookDict: Record<string, OpeningInfo> = ecoBookData as Record<string, OpeningInfo>;

/**
 * Normalizes a FEN to pieces, active color, and castling availability.
 * Example: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" -> "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq"
 */
export function normalizeFen(fen: string): string {
  if (!fen) return '';
  return fen.trim().split(' ').slice(0, 3).join(' ');
}

/**
 * Returns the opening information (name and ECO code) for a given board FEN,
 * or null if the position is out of book.
 */
export function getOpeningByFen(fen: string): OpeningInfo | null {
  const norm = normalizeFen(fen);
  return bookDict[norm] || null;
}

/**
 * Checks whether a given position exists in the comprehensive ECO opening database.
 */
export function isBookPosition(fen: string): boolean {
  const norm = normalizeFen(fen);
  return norm in bookDict;
}

/**
 * Determines whether a position requires engine tactical analysis.
 * Opening book moves are considered theory and not something to analyze as tactical errors.
 */
export function shouldAnalyzeMove(fen: string): boolean {
  return !isBookPosition(fen);
}
