import { SilmanImbalanceType } from '../chess/silmanImbalances';
import { ConcreteMoveDelta } from '../chess/featureExtractor';

export interface ExplanationRequest {
  playerColor: 'white' | 'black';
  moveSan: string;
  fromSquare: string;
  toSquare: string;
  bestMoveSan?: string;
  bestMoveUci?: string;
  classification: string;
  centipawnLoss: number;
  evalBefore: number;
  evalAfter: number;
  positionalNotes: string[];
  refutationMoves: string[];
  refutationLineSan?: string;
  bestMoveLineSan?: string;
  activeBoardThreats?: string[];
  tacticalTarget?: {
    square: string;
    piece: string;
    threatenedBy?: string;
    outcome?: string;
  };
  isExchange?: boolean;
  exchangeSummary?: string;
  silmanImbalance?: SilmanImbalanceType;
  playedMoveDelta?: ConcreteMoveDelta;
  engineMoveDelta?: ConcreteMoveDelta;
}

export function buildFactLockedPrompt(data: ExplanationRequest): { system: string; user: string } {
  const system = `You are a friendly, world-class chess coach. Your goal is to give clear, memorable, and practical advice to club players.

YOUR PRIORITIES:
1. Identify the MAIN reason the best move is better.
2. Connect that reason to the relevant imbalance.
3. Explain the difference between the player's move and the better move.
4. Give the player ONE practical action or principle.
5. Keep the explanation short and easy to remember.

IMPORTANT RULES:
1. Do not repeat Stockfish's evaluation without explaining the chess idea.
2. Do not dump variations.
3. Do not mention engine depth, nodes, centipawns, or calculation unless specifically requested.
4. Do not give multiple unrelated lessons.
5. Do not give generic advice that isn't connected to the position.
6. Prefer practical language over chess jargon.
7. The advice should tell the player what to DO.
8. The explanation must specifically compare the player's move with the better move.
9. Use the imbalance information to determine the underlying chess idea.
10. Do not force a rule if another idea is clearly more important.
11. Tactical issues override general strategic principles.
12. If there is an immediate threat, prioritize dealing with it.
13. If the position is strategically quiet, focus on the most important improvement.
14. Never claim that a chess principle is absolute; principles can have exceptions.
15. Name exact pieces and squares: Never use vague phrases like "the piece" or "the target" when referring to moves.
16. When a move creates a concrete problem, state the concrete fix directly. Do not turn the explanation into a general strategic principle. For example, if moving the queen leaves a pawn undefended, say "Defend the pawn on e4", not "Improve your queen placement" or "Support the center". The advice should describe the immediate thing the player needs to fix.
17. GROUND TRUTH RULE: Never invent piece positions or attacks. Only mention attacks and pieces that are explicitly verified in Board Facts. If a move is marked as not attacking an enemy piece, do NOT claim it attacks one.
18. REFUTATION SEPARATION: Do NOT confuse the Refutation line (how the opponent punishes the player's move) with what happens after the best move.

REQUIRED JSON OUTPUT FORMAT:
Respond with a valid JSON object matching this schema:
{
  "imbalance": "Relevant position imbalance",
  "whyBetter": "1-2 short sentences explaining the main reason the best move is better",
  "imbalanceConnection": "1 short sentence connecting that reason to the position imbalance",
  "moveDifference": "1-2 short sentences specifically comparing the player's move with the better move, telling the player what to do",
  "practicalPrinciple": "ONE concise, memorable practical action or rule of thumb for future games"
}

ANTI-SLOP LAW:
- Do not use em dashes anywhere in your text. Use regular hyphens, colons, or clean sentence splits.
- Speak directly, concisely, and naturally. 1 to 2 short sentences per section.`;

  const playedDeltaDesc = data.playedMoveDelta
    ? `${data.playerColor} ${data.playedMoveDelta.pieceName} moves ${data.playedMoveDelta.from} -> ${data.playedMoveDelta.to}${data.playedMoveDelta.capturedPieceName ? `, capturing ${data.playedMoveDelta.capturedPieceName}` : ''}`
    : `${data.playerColor} plays ${data.moveSan} (${data.fromSquare} -> ${data.toSquare})`;

  const engineDeltaDesc = data.engineMoveDelta
    ? `${data.playerColor} ${data.engineMoveDelta.pieceName} moves ${data.engineMoveDelta.from} -> ${data.engineMoveDelta.to}${
        data.engineMoveDelta.capturedPieceName ? `, capturing ${data.engineMoveDelta.capturedPieceName}` : ''
      }${
        data.engineMoveDelta.enemyPiecesAttacked && data.engineMoveDelta.enemyPiecesAttacked.length > 0
          ? `. Attacks ${data.engineMoveDelta.enemyPiecesAttacked.join(', ')}`
          : `. Does NOT attack any enemy piece`
      }`
    : `Stockfish recommends ${data.bestMoveSan || 'N/A'}`;

  const threatsSection =
    data.activeBoardThreats && data.activeBoardThreats.length > 0
      ? `- Verified Board Threats:\n${data.activeBoardThreats.map((t) => `  * ${t}`).join('\n')}\n`
      : '';

  const user = `Analyze this moment:
- Player's Move: ${data.moveSan} [Verified: ${playedDeltaDesc}] (Classification: ${data.classification.toUpperCase()})
- Refutation of Player's Move: ${data.refutationLineSan || data.refutationMoves.slice(0, 3).join(' ') || 'N/A'} (demonstrates why ${data.moveSan} is punished by opponent)
- Stockfish's Best Move: ${data.bestMoveSan || 'N/A'} [Verified: ${engineDeltaDesc}]
${data.bestMoveLineSan ? `- Engine's Preferred Continuation: ${data.bestMoveLineSan}\n` : ''}- Detected Position Imbalance: ${data.silmanImbalance || 'Pawn Structure'}
${data.isExchange ? `- Move Nature: Piece Exchange (${data.exchangeSummary || data.moveSan})\n` : ''}${data.tacticalTarget ? `- Concrete Tactical Target: ${data.tacticalTarget.piece} (threatened by ${data.tacticalTarget.threatenedBy || 'enemy forces'}, outcome: ${data.tacticalTarget.outcome || 'capture'})\n` : ''}${threatsSection}- Board Facts:
${data.positionalNotes.map((n) => `  * ${n}`).join('\n')}

Return a valid JSON object matching this schema:
{
  "imbalance": "${data.silmanImbalance || 'Pawn Structure'}",
  "whyBetter": "1-2 short sentences explaining the main reason the best move is better",
  "imbalanceConnection": "1 short sentence connecting that reason to the position imbalance",
  "moveDifference": "1-2 short sentences specifically comparing the player's move with the better move, telling the player what to do",
  "practicalPrinciple": "ONE concise, memorable practical action or rule of thumb for future games"
}`;

  return { system, user };
}
