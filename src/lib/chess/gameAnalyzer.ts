import { EvaluatedMove } from './types';
import { EngineEvaluation, EvaluationOptions, stockfishEngine } from './engineWorker';
import { updateEvaluatedMove, isBookMove, uciToSan } from './evalClassifier';
import { isBookPosition, getOpeningByFen } from './openingBook';

export interface GameAnalysisProgress {
  current: number;
  total: number;
  percent: number;
  currentMove: EvaluatedMove;
}

export interface GameAnalysisOptions {
  depth?: number;
  movetime?: number;
  evaluator?: (
    fen: string,
    options?: EvaluationOptions | number
  ) => Promise<EngineEvaluation>;
  onProgress?: (progress: GameAnalysisProgress) => void;
  shouldCancel?: () => boolean;
}

/**
 * Analyzes all moves of a chess game sequentially with fast time-budgeted evaluation.
 * - Skips opening book moves (marks as theoretical with 0 loss and ECO title).
 * - Evaluates non-book moves with Stockfish at fast-pass depth (default 10) and movetime (default 80ms).
 * - Classifies moves into the 10-tier review system.
 * - Streams progress updates via onProgress.
 */
export async function analyzeGameMoves(
  moves: EvaluatedMove[],
  options?: GameAnalysisOptions
): Promise<EvaluatedMove[]> {
  const total = moves.length;
  if (total === 0) return [];

  const depth = options?.depth ?? 10;
  const movetime = options?.movetime ?? 80;
  const evalOptions: EvaluationOptions = { depth, movetime };

  const evaluate =
    options?.evaluator ||
    ((fen: string, opts?: EvaluationOptions | number) =>
      stockfishEngine.evaluatePosition(fen, opts));

  const updatedMoves: EvaluatedMove[] = [...moves];

  let inBook = true;

  for (let i = 0; i < total; i++) {
    if (options?.shouldCancel && options.shouldCancel()) {
      break;
    }

    const target = updatedMoves[i];
    const prev = i > 0 ? updatedMoves[i - 1] : undefined;
    const ply = target.ply;

    // 1. Check if it's an opening book move
    const isBook = inBook && Boolean(
      target.isBook ||
      (target.fen && isBookPosition(target.fen)) ||
      isBookMove(ply, target.san, target.fen)
    );

    if (!isBook) {
      inBook = false;
    }

    if (isBook) {
      const opening = target.fen ? getOpeningByFen(target.fen) : null;
      updatedMoves[i] = {
        ...target,
        classification: 'theoretical',
        centipawnLoss: 0,
        evalScore: target.evalScore !== undefined ? target.evalScore : 0,
        isBook: true,
        openingName: opening?.name || target.openingName,
        eco: opening?.eco || target.eco,
        bestMoveSan: target.san,
        bestMoveUci: `${target.from}${target.to}`,
      };
    } else {
      // 2. Non-book move: evaluate with Stockfish
      try {
        const evalResult = await evaluate(target.fen, evalOptions);
        updatedMoves[i] = updateEvaluatedMove(target, prev, ply, evalResult);

        // Propagate best move recommendation to the subsequent move
        if (evalResult?.bestMoveUci && i + 1 < total) {
          const nextTarget = updatedMoves[i + 1];
          if (!nextTarget.bestMoveUci) {
            updatedMoves[i + 1] = {
              ...nextTarget,
              bestMoveUci: evalResult.bestMoveUci,
              bestMoveSan: uciToSan(target.fen, evalResult.bestMoveUci),
            };
          }
        }
      } catch (err) {
        console.error(`Analysis failed at ply ${ply}:`, err);
      }
    }

    if (options?.onProgress) {
      options.onProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        currentMove: updatedMoves[i],
      });
    }
  }

  return updatedMoves;
}
