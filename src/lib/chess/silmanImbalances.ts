import { Chess } from 'chess.js';
import { extractPositionalFeatures } from './featureExtractor';

export type SilmanImbalanceType =
  | 'Superior Minor Piece (Bishops vs. Knights)'
  | 'Pawn Structure'
  | 'Space'
  | 'Material'
  | 'Control of a Key File'
  | 'Control of a Hole / Weak Square'
  | 'Lead in Development'
  | 'Initiative'
  | 'King Safety'
  | 'Statics vs. Dynamics';

export interface SilmanImbalanceDefinition {
  name: SilmanImbalanceType;
  description: string;
  pocketRule: string;
}

export const SILMAN_IMBALANCES: Record<SilmanImbalanceType, SilmanImbalanceDefinition> = {
  'Superior Minor Piece (Bishops vs. Knights)': {
    name: 'Superior Minor Piece (Bishops vs. Knights)',
    description: 'The positional battle comparing the long-range speed of Bishops against the tricky, leaping, outpost-craving power of Knights.',
    pocketRule: '"Open for Bishops, Closed for Knights." Keep diagonals open and pawns flexible for the bishop pair; create stable, unassailable outpost holes for knights.',
  },
  'Pawn Structure': {
    name: 'Pawn Structure',
    description: 'The strategic arrangement of pawns, which dictates your long-term plans and includes identifying weak pawns (backward, isolated, doubled) as well as passed pawns.',
    pocketRule: '"Pawn Weaknesses Are Permanent." Every pawn push leaves behind unrecoverable squares—never create an isolated or backward pawn without immediate concrete compensation.',
  },
  'Space': {
    name: 'Space',
    description: 'The annexation of territory. Having a spatial advantage cramps the opponent\'s pieces, while giving your own forces maximum maneuvering room.',
    pocketRule: '"Cramp the Enemy, Trade When Cramped." When you have a spatial advantage, avoid piece trades and suffocate the opponent; when cramped, trade pieces to ease congestion.',
  },
  'Material': {
    name: 'Material',
    description: 'What Silman famously calls "the philosophy of greed"—the physical count of pieces and pawns.',
    pocketRule: '"Simplify When Ahead." When you have a decisive material surplus, eliminate tactical counterplay by trading pieces (not pawns) into an easily winning endgame.',
  },
  'Control of a Key File': {
    name: 'Control of a Key File',
    description: 'Occupying open or half-open files, which serve as the "roads" Rooks need to penetrate the enemy camp.',
    pocketRule: '"Rooks Need Open Roads." Seize open and semi-open files early, double heavy pieces, and use the file to invade the 7th rank.',
  },
  'Control of a Hole / Weak Square': {
    name: 'Control of a Hole / Weak Square',
    description: 'A "hole" is an advanced square inside enemy territory that can no longer be protected by the opponent\'s pawns, serving as a highly prized home or outpost for your pieces—especially Knights.',
    pocketRule: '"Anchor in the Hole." An outpost hole on the 5th or 6th rank turns a minor piece into a positional monster that paralyzes opponent coordination.',
  },
  'Lead in Development': {
    name: 'Lead in Development',
    description: 'Having more active pieces in play than your opponent. Since development is a dynamic, temporary advantage, you must use it quickly before they catch up.',
    pocketRule: '"Strike Before They Mobilize." A lead in development is perishable—blow open the center with pawn breaks before your opponent safely castles.',
  },
  'Initiative': {
    name: 'Initiative',
    description: 'Commonly referred to by Silman as "Pushing Your Own Agenda". This is the physical manifestation of forcing your opponent to stop their plans and react to yours.',
    pocketRule: '"Dictate the Terms." When you hold the initiative, keep creating forcing threats so the opponent never has a free tempo to execute their own strategy.',
  },
  'King Safety': {
    name: 'King Safety',
    description: 'Target consciousness directed at an exposed or vulnerable King (such as one stuck uncastled in the center) while keeping your own King safe.',
    pocketRule: '"Safety First, Castle Early." An uncastled king in an opening center is a tactical bullseye; prioritize king shelter before launching flank adventures.',
  },
  'Statics vs. Dynamics': {
    name: 'Statics vs. Dynamics',
    description: 'The clash between long-term, permanent static factors (like a healthy pawn structure) and short-term, temporary dynamic opportunities (like active piece play or an immediate attack) that must be used quickly before they fade away.',
    pocketRule: '"Time vs. Structure." If you sacrifice static pawn structure for dynamic piece activity, you must attack relentlessly before the static weakness catches up with you.',
  },
};

export interface ImbalanceDetectionInput {
  prevFen: string;
  playedFen: string;
  playedSan: string;
  engineSan?: string;
  loss: number;
}

export function detectPrimaryImbalance(input: ImbalanceDetectionInput): {
  primaryImbalance: SilmanImbalanceType;
  reason: string;
} {
  const { prevFen, playedFen, playedSan, loss } = input;
  const prevFeatures = extractPositionalFeatures(prevFen);
  const playedFeatures = extractPositionalFeatures(playedFen);

  // 0. High Tactical/Material Blunder (loss >= 200 cp)
  // When a move hangs material or concedes a decisive tactic, the primary imbalance is Material
  if (loss >= 200) {
    return {
      primaryImbalance: 'Material',
      reason: 'A major piece or decisive material was hung or conceded to a concrete tactical refutation.',
    };
  }

  // 1. Check Superior Minor Piece (Bishop vs Knight or Bishop pair conceded)
  const prevWHasBP = prevFeatures.material.whiteHasBishopPair;
  const playedWHasBP = playedFeatures.material.whiteHasBishopPair;
  const prevBHasBP = prevFeatures.material.blackHasBishopPair;
  const playedBHasBP = playedFeatures.material.blackHasBishopPair;

  if (
    prevWHasBP !== playedWHasBP ||
    prevBHasBP !== playedBHasBP ||
    playedSan.startsWith('Bxc') ||
    playedSan.startsWith('Bxf') ||
    playedSan.startsWith('Nxc') ||
    playedSan.startsWith('Nxf')
  ) {
    return {
      primaryImbalance: 'Superior Minor Piece (Bishops vs. Knights)',
      reason: 'Alters the minor piece landscape, impacting the bishop pair or bishop vs knight balance.',
    };
  }

  // 2. Check Pawn Structure (Isolated, doubled, passed pawns, pawn pushes/trades)
  const prevIso = prevFeatures.pawnStructure.whiteIsolatedFiles.length + prevFeatures.pawnStructure.blackIsolatedFiles.length;
  const playedIso = playedFeatures.pawnStructure.whiteIsolatedFiles.length + playedFeatures.pawnStructure.blackIsolatedFiles.length;
  const prevDbl = prevFeatures.pawnStructure.whiteDoubledFiles.length + prevFeatures.pawnStructure.blackDoubledFiles.length;
  const playedDbl = playedFeatures.pawnStructure.whiteDoubledFiles.length + playedFeatures.pawnStructure.blackDoubledFiles.length;
  const isPawnMove = /^[a-h]/.test(playedSan);

  if (
    playedIso !== prevIso ||
    playedDbl !== prevDbl ||
    (isPawnMove && (
      playedSan.includes('xd') ||
      playedSan.includes('xe') ||
      playedSan.includes('c5') ||
      playedSan.includes('d5') ||
      playedSan.includes('e5') ||
      playedSan.includes('c4') ||
      playedSan.includes('d4')
    ))
  ) {
    return {
      primaryImbalance: 'Pawn Structure',
      reason: 'Permanently alters pawn chains, creating structural weaknesses, passed pawns, or center tension.',
    };
  }

  // 3. Check Material (Major material shifts >= 250 cp, like a piece sacrifice or hung piece)
  const matDeltaDiff = Math.abs(playedFeatures.material.materialDeltaCp - prevFeatures.material.materialDeltaCp);
  if (matDeltaDiff >= 250 && loss >= 90) {
    return {
      primaryImbalance: 'Material',
      reason: 'Material balance shifted significantly—a minor or major piece was surrendered or captured.',
    };
  }

  // 4. Check Control of a Hole / Weak Square (Outposts)
  const prevChess = new Chess(prevFen);
  const movingColor = prevChess.turn();
  const isKnightMove = playedSan.startsWith('N');
  if (isKnightMove) {
    const targetSq = playedSan.replace(/^[N]/, '').replace(/[+#]/, '').slice(-2);
    const outposts = movingColor === 'w' ? playedFeatures.keySquares.whiteOutposts : playedFeatures.keySquares.blackOutposts;
    if (outposts.includes(targetSq as any) || targetSq.includes('d5') || targetSq.includes('e5') || targetSq.includes('d4') || targetSq.includes('e4')) {
      return {
        primaryImbalance: 'Control of a Hole / Weak Square',
        reason: `Occupies or challenges an advanced hole in enemy territory (${targetSq}).`,
      };
    }
  }

  // 5. Check Control of a Key File (Rook on open/semi-open file)
  if (playedSan.startsWith('R') || playedSan.includes('fe1') || playedSan.includes('ae1') || playedSan.includes('fd1') || playedSan.includes('ad1') || playedSan.includes('e8') || playedSan.includes('d8')) {
    return {
      primaryImbalance: 'Control of a Key File',
      reason: 'Mobilizes heavy artillery toward an open or semi-open file road.',
    };
  }

  // 6. Check King Safety
  const playedChess = new Chess(playedFen);
  if (playedChess.inCheck() || playedSan.startsWith('K') || playedSan.includes('O-O')) {
    return {
      primaryImbalance: 'King Safety',
      reason: 'The king is placed in check, loses castling rights, or is exposed in an open sector.',
    };
  }

  // 7. Check Space
  if (playedSan.startsWith('a4') || playedSan.startsWith('h4') || playedSan.startsWith('f4') || playedSan.startsWith('c4')) {
    return {
      primaryImbalance: 'Space',
      reason: 'Claims exterior territorial space and cramps enemy maneuvering room.',
    };
  }

  // 8. Default to Initiative or Statics vs. Dynamics
  if (loss >= 80) {
    return {
      primaryImbalance: 'Initiative',
      reason: 'Surrenders active control and allows the opponent to push their own agenda.',
    };
  }

  return {
    primaryImbalance: 'Statics vs. Dynamics',
    reason: 'Balances long-term static positional factors with short-term dynamic piece activity.',
  };
}

export interface EngineComparisonInput {
  imbalance: SilmanImbalanceType;
  playedSan: string;
  engineSan?: string;
  playerColor: 'w' | 'b';
}

export function comparePlayedVsEngine(input: EngineComparisonInput): {
  whyEngineBetter: string;
  pocketRule: string;
} {
  const { imbalance, playedSan, engineSan } = input;
  const alt = engineSan || 'the engine alternative';
  const def = SILMAN_IMBALANCES[imbalance];

  let whyEngineBetter = '';

  switch (imbalance) {
    case 'Superior Minor Piece (Bishops vs. Knights)':
      whyEngineBetter = `While ${playedSan} looks to develop or reposition, ${alt} is higher priority: it preserves the bishop pair or establishes the knight on an unchallengeable post before the opponent can enforce favorable exchanges.`;
      break;
    case 'Pawn Structure':
      whyEngineBetter = `Targeting the opponent's structural flaw with ${alt} takes precedence over ${playedSan}. Based on the Principle of Two Weaknesses, putting immediate pressure on the weak pawn ties down enemy pieces before you spend a tempo on your own minor improvements.`;
      break;
    case 'Space':
      whyEngineBetter = `Playing ${playedSan} allows the opponent to relieve their cramp. ${alt} must be played first to lock in the space advantage and keep their pieces restricted before they find counterplay.`;
      break;
    case 'Material':
      whyEngineBetter = `Instead of quiet maneuvering with ${playedSan}, ${alt} seizes concrete tactical gains or simplifies advantageously while the opponent's pieces are disorganized.`;
      break;
    case 'Control of a Key File':
      whyEngineBetter = `${playedSan} misses the critical timing. Stockfish plays ${alt} first to seize the open file, ensuring heavy pieces penetrate before the opponent can contest the file or consolidate.`;
      break;
    case 'Control of a Hole / Weak Square':
      whyEngineBetter = `While ${playedSan} looks to develop or reposition naturally, ${alt} is higher priority: establishing your piece on the outpost first paralyzes the opponent's coordination before they can contest the hole.`;
      break;
    case 'Lead in Development':
      whyEngineBetter = `Rather than making a routine move like ${playedSan}, ${alt} strikes immediately with a forcing blow to exploit the opponent's lag in mobilization before they can safely castle.`;
      break;
    case 'Initiative':
      whyEngineBetter = `${playedSan} surrenders the initiative to the opponent. Stockfish plays ${alt} first to dictate terms and exploit the opponent's concrete imbalance before they can organize defense.`;
      break;
    case 'King Safety':
      whyEngineBetter = `While ${playedSan} pursues general piece activity, ${alt} is mandatory to neutralize immediate tactical threats against the king or exploit the opponent's exposed king before they find shelter.`;
      break;
    case 'Statics vs. Dynamics':
      whyEngineBetter = `Although ${playedSan} attempts quiet positional improvement, dynamic factors require ${alt} immediately to exploit temporary disharmony before static weaknesses become permanent.`;
      break;
    default:
      whyEngineBetter = `Stockfish prefers ${alt} over ${playedSan} to prioritize immediate concrete tactical pressure over routine positional maneuvering.`;
  }

  return {
    whyEngineBetter,
    pocketRule: def.pocketRule,
  };
}
