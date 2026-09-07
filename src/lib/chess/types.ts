export type MoveClassification =
  | 'masterstroke' // Brilliant (!!)
  | 'sharp'        // Great (!)
  | 'theoretical'  // Book (📖)
  | 'optimal'      // Best (★)
  | 'strong'       // Excellent (👍)
  | 'sound'        // Good (✓)
  | 'imprecise'    // Inaccuracy (?!)
  | 'mistake'      // Mistake (?)
  | 'miss'         // Miss (❌)
  | 'blunder'      // Blunder (??)
  // Backward compatibility aliases
  | 'book'
  | 'best'
  | 'good'
  | 'inaccuracy';

export interface EvaluatedMove {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  from: string;
  to: string;
  fen: string;
  previousFen: string;
  // Engine analysis fields
  evalScore?: number; // In centipawns from White's perspective (+150 = +1.5 for White)
  mateScore?: number; // In moves to mate (+3 = White mates in 3)
  bestMoveUci?: string;
  bestMoveSan?: string;
  classification?: MoveClassification;
  centipawnLoss?: number;
  // Refutation line calculated by Stockfish
  pvLine?: string[];
  // Opening Book Metadata
  openingName?: string;
  eco?: string;
  isBook?: boolean;
}

export interface GameMetadata {
  white: string;
  black: string;
  whiteRating?: number;
  blackRating?: number;
  result: string;
  date?: string;
  event?: string;
  userColor?: 'white' | 'black';
}
