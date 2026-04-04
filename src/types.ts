export enum RPS {
  ROCK = 'ROCK',
  SCISSORS = 'SCISSORS',
  PAPER = 'PAPER',
  BLANK = 'BLANK'
}

export interface Card {
  id: string;
  symbols: [RPS, RPS, RPS];
  isFlipped?: boolean;
}

export interface MatrixTheme {
  element: RPS;
  power: number;
}

export interface Matrix {
  grid: RPS[][];
  theme: MatrixTheme;
}

export type InsertEdge = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';

export interface ShiftResult {
  newGrid: RPS[][];
  pushedOutSymbols: [RPS, RPS, RPS];
}

export type CompareResult = 'WIN' | 'LOSE' | 'DUAL';

export interface ResolutionResult {
  won: boolean;
  result: CompareResult;
  oldTheme: MatrixTheme;
  newTheme: MatrixTheme;
  pushedOutCard: Card | null;
  insertedCardId: string;
  scoreDelta: number;
  newGrid?: RPS[][];
}

export interface GameConfig {
  initialTargetScore: number;
}

export interface GameState {
  matrix: Matrix;
  hand: Card[];
  currentScore: number;
  shufflesLeft: number;
  dealsLeft: number;
  selectedCardId: string | null;
  status: 'PLAYING' | 'GAME_OVER';
  lastResolution: ResolutionResult | null;
  preview: ResolutionResult | null;
}
