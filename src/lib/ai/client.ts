import { AppSettings, PROVIDER_DEFAULTS } from '../settings/storage';
import { AllowedBoardContext, validateExplanationText } from './guardrail';
import { buildFactLockedPrompt, ExplanationRequest } from './prompts';
import { comparePlayedVsEngine, SilmanImbalanceType } from '../chess/silmanImbalances';

export interface CoachingOutput {
  // New structured fields per user's 5 priorities
  imbalance: string;
  whyBetter: string;
  imbalanceConnection: string;
  moveDifference: string;
  practicalPrinciple: string;

  // Backward compatibility fields for UI
  category: string;
  diagnosis: string;
  whyEngineBetter?: string;
  pocketRule: string;
  refutationSummary: string;
  source: 'ai' | 'heuristic_engine';
}

export async function generateCoachingTip(
  request: ExplanationRequest,
  boardContext: AllowedBoardContext,
  settings: AppSettings
): Promise<CoachingOutput> {
  // If no API key is set, immediately return high quality deterministic heuristic
  if (!settings.apiKey.trim()) {
    return generateHeuristicFallback(request);
  }

  const { system, user } = buildFactLockedPrompt(request);

  let endpoint = PROVIDER_DEFAULTS[settings.provider]?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai';
  if (settings.provider === 'custom' && settings.customBaseUrl) {
    endpoint = settings.customBaseUrl.replace(/\/+$/, '');
  }
  const url = `${endpoint}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
        // OpenRouter optional headers
        ...(settings.provider === 'openrouter' ? {
          'HTTP-Referer': window.location.origin,
          'X-Title': 'ChessPrinciple AI',
        } : {}),
      },
      body: JSON.stringify({
        model: settings.model || PROVIDER_DEFAULTS[settings.provider]?.defaultModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2, // Low temperature for factual consistency
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`AI Provider returned error ${res.status}: ${errText}. Falling back to heuristic.`);
      return generateHeuristicFallback(request);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return generateHeuristicFallback(request);
    }

    // Strip markdown JSON formatting if LLM wrapped it
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const imbalance = parsed.imbalance || parsed.category || request.silmanImbalance || 'Pawn Structure';
    let whyBetter = parsed.whyBetter || parsed.whyEngineBetter || '';
    let imbalanceConnection = parsed.imbalanceConnection || '';
    let moveDifference = parsed.moveDifference || parsed.diagnosis || '';
    let practicalPrinciple = parsed.practicalPrinciple || parsed.pocketRule || '';
    const refutationSummary = parsed.refutationSummary || (request.refutationLineSan ? `Continuation: ${request.refutationLineSan}.` : '');

    // Fallbacks if LLM omitted fields
    if (!whyBetter && request.bestMoveSan) {
      const comp = comparePlayedVsEngine({
        imbalance: imbalance as SilmanImbalanceType,
        playedSan: request.moveSan,
        engineSan: request.bestMoveSan,
        playerColor: request.playerColor === 'white' ? 'w' : 'b',
      });
      whyBetter = comp.whyEngineBetter;
    }

    if (!imbalanceConnection) {
      imbalanceConnection = `${imbalance}: Focuses on the most critical imbalance in this position.`;
    }

    if (!moveDifference) {
      moveDifference = `${request.moveSan} was played, but ${request.bestMoveSan || 'the best move'} was more effective.`;
    }

    if (!practicalPrinciple) {
      practicalPrinciple = 'Always verify piece safety and central control before initiating trades.';
    }

    // Run Anti-Hallucination Guardrail on textual content (squares and piece-on-square claims)
    const whyBetterVal = validateExplanationText(whyBetter, boardContext);
    const moveDiffVal = validateExplanationText(moveDifference, boardContext);

    if (!whyBetterVal.isValid || !moveDiffVal.isValid) {
      console.warn(
        'Guardrail flagged AI hallucination:',
        !whyBetterVal.isValid ? `whyBetter: ${whyBetterVal.reason}` : `moveDifference: ${moveDiffVal.reason}`
      );
      console.log('Safely falling back to deterministic heuristic coach advice.');
      return generateHeuristicFallback(request);
    }

    return {
      imbalance,
      whyBetter,
      imbalanceConnection,
      moveDifference,
      practicalPrinciple,
      category: imbalance,
      diagnosis: moveDifference,
      whyEngineBetter: whyBetter,
      pocketRule: practicalPrinciple,
      refutationSummary,
      source: 'ai',
    };
  } catch (err) {
    console.error('Failed to query AI provider:', err);
    return generateHeuristicFallback(request);
  }
}

/**
 * High-quality deterministic heuristic coach for offline use or when free API limits are reached.
 * Implements the user's 14 coaching rules and 5 priorities.
 */
export function generateHeuristicFallback(request: ExplanationRequest): CoachingOutput {
  const isBook = request.classification === 'book' || request.classification === 'theoretical';
  const isBest =
    request.classification === 'best' ||
    request.classification === 'optimal' ||
    request.classification === 'masterstroke' ||
    request.centipawnLoss <= 15;

  const imbalance = request.silmanImbalance || 'Pawn Structure';
  const playedSan = request.moveSan;
  const bestSan = request.bestMoveSan || request.moveSan;
  const refutationSummary = request.refutationLineSan
    ? `Continuation: ${request.refutationLineSan}.`
    : `The engine highlights ${bestSan}.`;

  if (isBook || (isBest && request.centipawnLoss === 0)) {
    const whyBetter = `Stockfish confirms ${playedSan} is optimal, actively controlling the center and coordinating pieces.`;
    const imbalanceConnection = `${imbalance}: Harmoniously advances piece development and central presence.`;
    const moveDifference = `You found the best move ${playedSan}, maintaining optimal piece coordination and central tension.`;
    const practicalPrinciple = 'Stake a claim in the center with pawns on the first moves, freeing diagonals for minor pieces.';

    return {
      imbalance,
      whyBetter,
      imbalanceConnection,
      moveDifference,
      practicalPrinciple,
      category: imbalance,
      diagnosis: moveDifference,
      whyEngineBetter: whyBetter,
      pocketRule: practicalPrinciple,
      refutationSummary,
      source: 'heuristic_engine',
    };
  }

  const isBlunder = request.classification === 'blunder' || request.centipawnLoss >= 200;

  if (request.isExchange) {
    const isFlankRecapture =
      request.toSquare === 'b6' ||
      request.toSquare === 'b3' ||
      request.toSquare === 'g6' ||
      request.toSquare === 'g3' ||
      request.toSquare === 'a6' ||
      request.toSquare === 'a3' ||
      request.toSquare === 'h6' ||
      request.toSquare === 'h3';

    const exchangeLabel = request.exchangeSummary || `piece trade on ${request.toSquare}`;
    const whyBetter = `${bestSan} maintains central tension and keeps the initiative, avoiding premature simplification.`;
    const imbalanceConnection = `${imbalance}: Initiating trades when you have active pressure relieves the opponent's defensive burden.`;
    const moveDifference = `Playing ${playedSan} initiates a ${exchangeLabel}, giving the opponent a clean recapture and opening lines for their pieces. Instead, play ${bestSan} to maintain central pressure.`;
    const practicalPrinciple = isFlankRecapture
      ? 'Beware Opening Files on Recaptures: Avoid flank trades that open files directly for enemy rooks upon recapture.'
      : 'Maintain the Tension: Do not initiate trades when you hold the initiative.';

    return {
      imbalance,
      whyBetter,
      imbalanceConnection,
      moveDifference,
      practicalPrinciple,
      category: imbalance,
      diagnosis: moveDifference,
      whyEngineBetter: whyBetter,
      pocketRule: practicalPrinciple,
      refutationSummary,
      source: 'heuristic_engine',
    };
  }

  // Tactical Blunder or Hanging Piece (Tactics override general strategy)
  if (isBlunder || (request.tacticalTarget && request.centipawnLoss >= 150)) {
    const target = request.tacticalTarget?.piece || 'a loose piece';
    const whyBetter = request.tacticalTarget?.piece
      ? `${bestSan} eliminates the tactical threat to ${target} and preserves your material balance.`
      : `${bestSan} eliminates the tactical threat and preserves your material balance.`;
    const imbalanceConnection = `Material: Tactical defense overrides general strategic plans when a piece is threatened.`;
    const moveDifference = `${playedSan} leaves ${target} undefended. Play ${bestSan} to defend ${target} immediately before pursuing other plans.`;
    const practicalPrinciple = request.tacticalTarget?.piece
      ? `Defend ${target}: when a piece or pawn is left undefended, fix the defense immediately rather than pursuing general strategic moves.`
      : 'When a piece is attacked or loose, prioritize defending or moving it before starting active operations.';

    return {
      imbalance: 'Material',
      whyBetter,
      imbalanceConnection,
      moveDifference,
      practicalPrinciple,
      category: 'Material',
      diagnosis: moveDifference,
      whyEngineBetter: whyBetter,
      pocketRule: practicalPrinciple,
      refutationSummary,
      source: 'heuristic_engine',
    };
  }

  // Positional Inaccuracy or Quiet Position Improvement
  const comp = comparePlayedVsEngine({
    imbalance,
    playedSan: request.moveSan,
    engineSan: request.bestMoveSan,
    playerColor: request.playerColor === 'white' ? 'w' : 'b',
  });

  const whyBetter = comp.whyEngineBetter || `${bestSan} improves piece activity and strengthens your control over key central squares.`;
  const imbalanceConnection = `${imbalance}: Focuses on the most important concrete improvement in the position.`;
  const moveDifference = `Playing ${playedSan} is slightly passive compared to ${bestSan}. ${comp.whyEngineBetter}`;
  const practicalPrinciple = comp.pocketRule || 'In quiet positions, identify your least active piece and improve its scope.';

  return {
    imbalance,
    whyBetter,
    imbalanceConnection,
    moveDifference,
    practicalPrinciple,
    category: imbalance,
    diagnosis: moveDifference,
    whyEngineBetter: whyBetter,
    pocketRule: practicalPrinciple,
    refutationSummary,
    source: 'heuristic_engine',
  };
}
