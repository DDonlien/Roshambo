import { Card, InsertEdge, RPS } from './types';

const WIN_MAP: Record<RPS, RPS | null> = {
  [RPS.ROCK]: RPS.SCISSORS,
  [RPS.SCISSORS]: RPS.PAPER,
  [RPS.PAPER]: RPS.ROCK,
  [RPS.BLANK]: null
};

const SCORE_WEIGHTS: Record<RPS, number> = {
  [RPS.ROCK]: 4,
  [RPS.SCISSORS]: 3,
  [RPS.PAPER]: 1,
  [RPS.BLANK]: 0
};

export interface LaneResult {
  newGrid: RPS[][];
  scoreDelta: number;
  penalty: number;
  laneScores: number[];
  replacedCells: { r: number; c: number }[];
  attachmentOffset: number;
  shiftedLanes: { index: number; type: 'row' | 'col'; direction: 1 | -1 }[];
}

function shiftLane(grid: RPS[][], index: number, type: 'row' | 'col', direction: 1 | -1): void {
  const size = grid.length;
  if (type === 'row') {
    const row = grid[index];
    if (direction === 1) {
      const last = row[size - 1];
      for (let col = size - 1; col > 0; col -= 1) {
        row[col] = row[col - 1];
      }
      row[0] = last;
    } else {
      const first = row[0];
      for (let col = 0; col < size - 1; col += 1) {
        row[col] = row[col + 1];
      }
      row[size - 1] = first;
    }
  } else {
    if (direction === 1) {
      const last = grid[size - 1][index];
      for (let row = size - 1; row > 0; row -= 1) {
        grid[row][index] = grid[row - 1][index];
      }
      grid[0][index] = last;
    } else {
      const first = grid[0][index];
      for (let row = 0; row < size - 1; row += 1) {
        grid[row][index] = grid[row + 1][index];
      }
      grid[size - 1][index] = first;
    }
  }
}

export function resolveAttachmentOffset(matrixSize: number, cardLength: number, pointerRatio: number): number {
  const minOffset = Math.min(0, matrixSize - cardLength);
  const maxOffset = Math.max(0, matrixSize - cardLength);

  if (minOffset === maxOffset) {
    return minOffset;
  }

  const placementCount = maxOffset - minOffset + 1;
  const clampedRatio = Math.min(Math.max(pointerRatio, 0), 0.999999);
  const placementIndex = Math.min(placementCount - 1, Math.floor(clampedRatio * placementCount));
  return minOffset + placementIndex;
}

export function executeLaneClash(
  currentGrid: RPS[][],
  edge: InsertEdge,
  card: Card,
  attachmentOffset: number
): LaneResult {
  const newGrid = currentGrid.map((row) => [...row]);
  const size = newGrid.length;
  let totalScore = 0;
  let penalty = 0;
  const laneScores: number[] = Array.from({ length: card.symbols.length }, () => 0);
  const replacedCells: { r: number; c: number }[] = [];
  const shiftedLanes: { index: number; type: 'row' | 'col'; direction: 1 | -1 }[] = [];

  for (let cardIndex = 0; cardIndex < card.symbols.length; cardIndex += 1) {
    const laneIndex = attachmentOffset + cardIndex;
    if (laneIndex < 0 || laneIndex >= size) {
      continue;
    }

    const attacker = card.symbols[cardIndex];
    let r = 0, c = 0, dr = 0, dc = 0;

    if (edge === 'TOP') { r = 0; c = laneIndex; dr = 1; dc = 0; }
    else if (edge === 'BOTTOM') { r = size - 1; c = laneIndex; dr = -1; dc = 0; }
    else if (edge === 'LEFT') { r = laneIndex; c = 0; dr = 0; dc = 1; }
    else if (edge === 'RIGHT') { r = laneIndex; c = size - 1; dr = 0; dc = -1; }

    const defender = newGrid[r][c];
    const attackerLoses = defender !== RPS.BLANK && (attacker === RPS.BLANK || WIN_MAP[defender] === attacker);

    if (attackerLoses) {
      const attackerVal = Number(SCORE_WEIGHTS[attacker]) || 0;
      penalty += attackerVal;

      if (edge === 'LEFT' || edge === 'RIGHT') {
        const shiftDir: 1 | -1 = edge === 'LEFT' ? -1 : 1;
        shiftLane(newGrid, laneIndex, 'row', shiftDir);
        shiftedLanes.push({ index: laneIndex, type: 'row', direction: shiftDir });
      } else {
        const shiftDir: 1 | -1 = edge === 'TOP' ? -1 : 1;
        shiftLane(newGrid, laneIndex, 'col', shiftDir);
        shiftedLanes.push({ index: laneIndex, type: 'col', direction: shiftDir });
      }
    } else if (attacker !== RPS.BLANK) {
      for (let step = 0; step < size; step += 1) {
        const currentDefender = newGrid[r][c];
        const attackerWins = (WIN_MAP[attacker] === currentDefender) || (currentDefender === RPS.BLANK);

        if (attackerWins) {
          const gain = Number(SCORE_WEIGHTS[currentDefender]) || 0;
          totalScore += gain;
          laneScores[cardIndex] += gain;
          newGrid[r][c] = attacker;
          replacedCells.push({ r, c });
          r += dr; c += dc;
          if (r < 0 || r > size - 1 || c < 0 || c > size - 1) break;
        } else {
          break;
        }
      }
    }
  }

  return { 
    newGrid, 
    scoreDelta: totalScore || 0, 
    penalty: penalty || 0, 
    laneScores, 
    replacedCells, 
    attachmentOffset,
    shiftedLanes 
  };
}

export function createEmptyGrid(size: number): RPS[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => RPS.BLANK));
}
