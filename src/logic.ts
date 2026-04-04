import { Card, InsertEdge, MatrixTheme, RPS, ShiftResult, CompareResult } from './types';

const ELEMENT_PRIORITY: readonly RPS[] = [RPS.ROCK, RPS.SCISSORS, RPS.PAPER];

const WIN_MAP: Record<RPS, RPS | null> = {
  [RPS.ROCK]: RPS.SCISSORS,
  [RPS.SCISSORS]: RPS.PAPER,
  [RPS.PAPER]: RPS.ROCK,
  [RPS.BLANK]: null
};

export function reverseCard(card: Card): Card {
  return {
    ...card,
    symbols: [card.symbols[2], card.symbols[1], card.symbols[0]]
  };
}

export function calculateTheme(grid: RPS[][]): MatrixTheme {
  const counts: Record<RPS, number> = {
    [RPS.ROCK]: 0,
    [RPS.SCISSORS]: 0,
    [RPS.PAPER]: 0,
    [RPS.BLANK]: 0
  };

  for (const row of grid) {
    for (const symbol of row) {
      counts[symbol] += 1;
    }
  }

  let bestElement = RPS.ROCK;
  let bestPower = counts[RPS.ROCK];

  for (const element of ELEMENT_PRIORITY) {
    const power = counts[element];
    if (power > bestPower) {
      bestElement = element;
      bestPower = power;
    }
  }

  return {
    element: bestElement,
    power: bestPower
  };
}

export function createEmptyGrid(): RPS[][] {
  return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => RPS.BLANK));
}

function cloneGrid(grid: RPS[][]): RPS[][] {
  return grid.map((row) => [...row]);
}

export function shiftMatrix(oldGrid: RPS[][], insertEdge: InsertEdge, insertCard: Card): ShiftResult {
  const grid = cloneGrid(oldGrid);

  // In the UI, cards have symbols [0, 1, 2].
  // When inserting LEFT: card is vertical, symbol[0] is top, symbol[2] is bottom.
  // We want to push the entire column.
  if (insertEdge === 'LEFT') {
    const pushedOutSymbols: [RPS, RPS, RPS] = [grid[0][2], grid[1][2], grid[2][2]];
    for (let row = 0; row < 3; row += 1) {
      grid[row][2] = grid[row][1];
      grid[row][1] = grid[row][0];
      grid[row][0] = insertCard.symbols[row];
    }
    return { newGrid: grid, pushedOutSymbols };
  }

  // When inserting RIGHT: card is vertical, symbol[0] is top, symbol[2] is bottom.
  if (insertEdge === 'RIGHT') {
    const pushedOutSymbols: [RPS, RPS, RPS] = [grid[0][0], grid[1][0], grid[2][0]];
    for (let row = 0; row < 3; row += 1) {
      grid[row][0] = grid[row][1];
      grid[row][1] = grid[row][2];
      grid[row][2] = insertCard.symbols[row];
    }
    return { newGrid: grid, pushedOutSymbols };
  }

  // When inserting TOP: card is rotated -90deg.
  // Visual top of the original card (symbol[0]) is now pointing left.
  // Visual bottom of the original card (symbol[2]) is now pointing right.
  // So we match col index to symbol index.
  if (insertEdge === 'TOP') {
    const pushedOutSymbols: [RPS, RPS, RPS] = [grid[2][0], grid[2][1], grid[2][2]];
    for (let col = 0; col < 3; col += 1) {
      grid[2][col] = grid[1][col];
      grid[1][col] = grid[0][col];
      grid[0][col] = insertCard.symbols[col];
    }
    return { newGrid: grid, pushedOutSymbols };
  }

  // When inserting BOTTOM: card is rotated -90deg.
  // Visual top (symbol[0]) is left, bottom (symbol[2]) is right.
  const pushedOutSymbols: [RPS, RPS, RPS] = [grid[0][0], grid[0][1], grid[0][2]];
  for (let col = 0; col < 3; col += 1) {
    grid[0][col] = grid[1][col];
    grid[1][col] = grid[2][col];
    grid[2][col] = insertCard.symbols[col];
  }
  return { newGrid: grid, pushedOutSymbols };
}

export function compareMatrix(newTheme: MatrixTheme, oldTheme: MatrixTheme): CompareResult {
  if (WIN_MAP[newTheme.element] === oldTheme.element) {
    return 'WIN';
  }

  if (WIN_MAP[oldTheme.element] === newTheme.element) {
    return 'LOSE';
  }

  if (newTheme.power > oldTheme.power) {
    return 'WIN';
  }

  if (newTheme.power < oldTheme.power) {
    return 'LOSE';
  }

  return 'DUAL';
}

const SCORE_WEIGHTS: Record<RPS, number> = {
  [RPS.ROCK]: 4,
  [RPS.SCISSORS]: 3,
  [RPS.PAPER]: 1,
  [RPS.BLANK]: 0
};

export function calculateScore(result: CompareResult, oldTheme: MatrixTheme): number {
  if (result === 'LOSE' || result === 'DUAL') return 0;
  
  const baseScore = 5;
  const extraScore = oldTheme.power * SCORE_WEIGHTS[oldTheme.element];
  return baseScore + extraScore;
}
