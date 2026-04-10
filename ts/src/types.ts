export enum RPS {
  ROCK = 'ROCK',
  SCISSORS = 'SCISSORS',
  PAPER = 'PAPER',
  BLANK = 'BLANK'
}

export const CARD_LENGTH = 3;

export type LevelIcon = 'pocket' | 'rubik' | 'master';

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
  failedCells?: { r: number; c: number }[]; // Cells where attacker lost inside the matrix
  tieCells?: { r: number; c: number }[];    // Cells where attacker tied
  insertedCardId: string;
  attachmentOffset: number;
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
  dealsLeft: number;
  shufflesLeft: number;
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
