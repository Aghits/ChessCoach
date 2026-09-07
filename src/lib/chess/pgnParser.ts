import { Chess } from 'chess.js';
import { EvaluatedMove, GameMetadata } from './types';
import { getOpeningByFen, isBookPosition } from './openingBook';

export interface ParsedGameResult {
  moves: EvaluatedMove[];
  metadata: GameMetadata;
  initialFen: string;
}

export function parsePgn(pgnString: string, userColorPreference?: 'white' | 'black'): ParsedGameResult {
  const chess = new Chess();
  chess.loadPgn(pgnString);

  // Extract header tags
  const headers = chess.header();
  const white = headers['White'] || 'White';
  const black = headers['Black'] || 'Black';
  const whiteRating = headers['WhiteElo'] ? parseInt(headers['WhiteElo'], 10) : undefined;
  const blackRating = headers['BlackElo'] ? parseInt(headers['BlackElo'], 10) : undefined;
  const result = headers['Result'] || '*';
  const date = (headers['Date'] || headers['UTCDate']) ?? undefined;
  const event = headers['Event'] ?? undefined;

  const metadata: GameMetadata = {
    white,
    black,
    whiteRating,
    blackRating,
    result,
    date,
    event,
    userColor: userColorPreference || 'white',
  };

  // Replay moves to capture exact FENs at each ply
  const history = chess.history({ verbose: true });
  const replayChess = new Chess();
  const initialFen = replayChess.fen();

  const evaluatedMoves: EvaluatedMove[] = [];
  let inBook = true;

  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const prevFen = replayChess.fen();
    replayChess.move({ from: m.from, to: m.to, promotion: m.promotion });
    const currentFen = replayChess.fen();

    const opening = getOpeningByFen(currentFen);
    const isBook = inBook && Boolean(opening || isBookPosition(currentFen));
    if (!isBook) {
      inBook = false;
    }

    evaluatedMoves.push({
      ply: i + 1,
      moveNumber: Math.floor(i / 2) + 1,
      color: m.color,
      san: m.san,
      from: m.from,
      to: m.to,
      fen: currentFen,
      previousFen: prevFen,
      classification: isBook ? 'theoretical' : undefined,
      centipawnLoss: isBook ? 0 : undefined,
      evalScore: isBook ? 0 : undefined,
      bestMoveSan: isBook ? m.san : undefined,
      bestMoveUci: isBook ? `${m.from}${m.to}` : undefined,
      isBook,
      openingName: opening?.name,
      eco: opening?.eco,
    });
  }

  return {
    moves: evaluatedMoves,
    metadata,
    initialFen,
  };
}
