export enum RPS {
  ROCK = 'ROCK',
  SCISSORS = 'SCISSORS',
  PAPER = 'PAPER',
  BLANK = 'BLANK',
  TRICOLOR = 'TRICOLOR'
}

export const CARD_LENGTH = 3;

export type LevelIcon = 'pocket' | 'rubik' | 'master';

export type GameStatus =
  | 'HOME'
  | 'CHOOSE_DECK'
  | 'PLAYING'
  | 'ROUND_REWARD'
  | 'SHOP'
  | 'GAME_OVER'
  | 'WIN';

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
  baseScoreDelta?: number;
  pierceCount?: number;
  pierceMultiplier?: number;
  penalty: number;
  laneScores: number[];
  replacedCells: { r: number; c: number }[];
  failedCells?: { r: number; c: number }[]; // Cells where attacker lost inside the matrix
  tieCells?: { r: number; c: number }[];    // Cells where attacker tied
  insertedCardId: string;
  attachmentOffset: number;
  captureEvents?: Array<{
    attacker: RPS;
    defender: RPS;
    laneIndex: number;
    r: number;
    c: number;
  }>;
  shiftedLanes?: { index: number; type: 'row' | 'col'; direction: 1 | -1 }[];
}

export interface GameConfig {
}

export interface LevelConfig {
  level: number;
  stage: number;
  tier: number;
  goal: number;
  reward: number;
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

export interface RoundRewardSummary {
  level: number;
  stage: number;
  levelName: string;
  goal: number;
  baseReward: number;
  interestReward: number;
  totalReward: number;
  finalLevel: boolean;
}

export interface SpecialCardInstance {
  instanceId: string;
  definitionId: string;
}

export interface GiftCardInstance {
  instanceId: string;
  definitionId: string;
}

export interface PlaymatInstance {
  instanceId: string;
  definitionId: string;
}

export type ShopOfferKind = 'sleeve' | 'giftcard' | 'playmat' | 'card';
export type ShopOfferForm = 'direct' | 'pack';

export interface ShopOfferChoice {
  kind: ShopOfferKind;
  definitionId?: string;
  cardCode?: string;
}

export interface ShopOffer {
  offerId: string;
  form: ShopOfferForm;
  kind: ShopOfferKind;
  definitionId?: string;
  cardCode?: string;
  cost: number;
  purchased: boolean;
  choices?: ShopOfferChoice[];
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
  currentStage: number;
  currentTier: number;
  totalStages: number;
  totalLevels: number;
  levelName: string;
  levelIcon: LevelIcon;
  levelGoal: number;
  levelReward: number;
  shufflesLeft: number;
  dealsLeft: number;
  selectedCardIds: string[];
  status: GameStatus;
  lastClash: ClashResult | null;
  preview: ClashResult | null;
  lastInterestEarned: number;
  lastLevelReward: number;
  pendingReward: RoundRewardSummary | null;
  shopOffers: ShopOffer[];
  specialCards: SpecialCardInstance[];
  sleeves: SpecialCardInstance[];
  giftCards: GiftCardInstance[];
  playmats: PlaymatInstance[];
  activePlaymatDefinitionId: string | null;
  openedPackOfferId: string | null;
  handsPlayedThisRun: number;
  handsPlayedThisLevel: number;
  dealsUsedThisLevel: number;
  lastUsedGiftCardDefinitionId: string | null;
}
