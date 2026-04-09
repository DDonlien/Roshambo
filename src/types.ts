export enum RPS {
  ROCK = 'ROCK',
  SCISSORS = 'SCISSORS',
  PAPER = 'PAPER',
  BLANK = 'BLANK'
}

export type LevelIcon = 'Rock' | 'Paper' | 'Scissors';

export interface Card {
  id: string;
  symbols: RPS[];
  isFlipped?: boolean;
}

export interface Matrix {
  size: number;
  grid: RPS[][];
}

export type InsertEdge = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';

export interface ClashResult {
  newGrid: RPS[][];
  scoreDelta: number;
  penalty: number;
  laneScores: number[];
  replacedCells: { r: number; c: number }[];
  insertedCardId: string;
  shiftedLanes?: { index: number; type: 'row' | 'col'; direction: 1 | -1 }[];
}

export interface GameConfig {
}

export interface LevelConfig {
  level: number;
  goal: number;
  name: string;
  matrixSize: number;
  icon: LevelIcon;
}

export interface InitialConfig {
  chips: number;
  interestRate: number;
}

export interface GameState {
  matrix: Matrix;
  hand: Card[];
  deck: Card[];
  discardPile: Card[];
  currentScore: number;
  chips: number;
  interestRate: number;
  currentLevel: number;
  levelName: string;
  levelIcon: LevelIcon;
  levelGoal: number;
  shufflesLeft: number;
  dealsLeft: number;
  selectedCardIds: string[];
  status: 'CHOOSE_DECK' | 'PLAYING' | 'LEVEL_WON' | 'GAME_OVER' | 'WIN';
  lastClash: ClashResult | null;
  preview: ClashResult | null;
  lastInterestEarned: number;
}
