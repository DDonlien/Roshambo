import { createEmptyGrid, executeLaneClash, resolveAttachmentOffset } from './logic';
import { CARD_LENGTH, Card, ClashResult, GameConfig, GameState, InitialConfig, InsertEdge, LevelConfig, RPS } from './types';

const SYMBOL_POOL: readonly RPS[] = [RPS.ROCK, RPS.SCISSORS, RPS.PAPER, RPS.BLANK];

const DEFAULT_LEVELS: LevelConfig[] = [
  { level: 1, goal: 10, name: 'Pocket', matrixSize: 2, icon: 'pocket' },
  { level: 2, goal: 30, name: 'Rubik', matrixSize: 3, icon: 'rubik' },
  { level: 3, goal: 80, name: 'Master', matrixSize: 4, icon: 'master' }
];

const DEFAULT_INITIAL_CONFIG: InitialConfig = {
  chips: 10,
  interestRate: 2,
  dealsLeft: 4,
  shufflesLeft: 4
};

function randomId(): string {
  return crypto.randomUUID();
}

function randomSymbol(): RPS {
  return SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];
}

export const KNOWN_ASSETS = [
  '000', '010', '030', '040', '100', '101', '110', '111', '130', '131', '140', '141',
  '300', '301', '303', '310', '311', '313', '330', '331', '333', '340', '341', '343',
  '400', '401', '403', '404', '410', '411', '413', '414', '430', '431', '433', '434',
  '440', '441', '443', '444'
];

const MAP_TO_RPS: Record<string, RPS> = {
  '0': RPS.BLANK,
  '1': RPS.PAPER,
  '3': RPS.SCISSORS,
  '4': RPS.ROCK
};

function cloneCard(card: Card): Card {
  return {
    ...card,
    symbols: [...card.symbols]
  };
}

function createCardFromCode(code: string): Card {
  return {
    id: randomId(),
    symbols: code.split('').map((digit) => MAP_TO_RPS[digit])
  };
}

function randomGrid(size: number): RPS[][] {
  const grid = createEmptyGrid(size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      grid[row][col] = randomSymbol();
    }
  }
  return grid;
}

function createDeck(type: number): Card[] {
  const codes: string[] = [];
  const repeatCount = type === 1 ? 1 : type === 2 ? 2 : CARD_LENGTH;
  const symbolCodes = ['1', '3', '4'];

  symbolCodes.forEach((symbolCode) => {
    const code = symbolCode.repeat(repeatCount).padEnd(CARD_LENGTH, '0');
    codes.push(code, code, code);
  });

  const deck = codes.map((code) => createCardFromCode(code));

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export class GameStore {
  private state: GameState;
  private levelConfigs: LevelConfig[] = DEFAULT_LEVELS;
  private initialConfigs: Record<number, InitialConfig> = {
    1: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 },
    2: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 },
    3: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 }
  };
  private selectedDeckType = 1;
  private lastPreviewEdge: InsertEdge | null = null;
  private lastPreviewOffset = 0;
  private lastPreviewPointerRatio = 0.5;

  constructor(_config: Partial<GameConfig> = {}) {
    this.state = this.createInitialState();
  }

  async initialize(): Promise<void> {
    await Promise.all([this.loadLevelConfigs(), this.loadInitialConfig()]);
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    const firstLevel = this.levelConfigs[0] ?? DEFAULT_LEVELS[0];
    const conf = this.initialConfigs[this.selectedDeckType] || this.initialConfigs[1];

    return {
      matrix: {
        size: firstLevel.matrixSize,
        grid: randomGrid(firstLevel.matrixSize)
      },
      hand: [],
      deck: [],
      discardPile: [],
      currentScore: 0,
      chips: conf.chips,
      interestRate: conf.interestRate,
      currentLevel: 1,
      levelName: firstLevel.name,
      levelIcon: firstLevel.icon,
      levelGoal: firstLevel.goal,
      shufflesLeft: conf.shufflesLeft,
      dealsLeft: conf.dealsLeft,
      selectedCardIds: [],
      status: 'CHOOSE_DECK',
      lastClash: null,
      preview: null,
      lastInterestEarned: 0
    };
  }

  private cloneClashResult(result: ClashResult): ClashResult {
    return {
      ...result,
      newGrid: result.newGrid.map((row) => [...row]),
      laneScores: [...result.laneScores],
      replacedCells: result.replacedCells.map((cell) => ({ ...cell })),
      shiftedLanes: result.shiftedLanes?.map((lane) => ({ ...lane })) ?? []
    };
  }

  private getCurrentLevelConfigInternal(level = this.state.currentLevel): LevelConfig {
    return this.levelConfigs[level - 1] ?? this.levelConfigs[0];
  }

  getCurrentLevelConfig(): LevelConfig {
    return { ...this.getCurrentLevelConfigInternal() };
  }

  getLastPreviewEdge(): InsertEdge | null {
    return this.lastPreviewEdge;
  }

  getProjectedInterest(): number {
    return Math.floor(this.state.chips * this.state.interestRate);
  }

  private buildDeckForCurrentLevel(): void {
    const fullDeck = createDeck(this.selectedDeckType);
    this.state.hand = fullDeck.slice(0, 5);
    this.state.deck = fullDeck.slice(5);
    this.state.discardPile = [];
  }

  private applyLevelConfig(level = this.state.currentLevel): void {
    const levelConfig = this.getCurrentLevelConfigInternal(level);
    this.state.currentLevel = levelConfig.level;
    this.state.levelName = levelConfig.name;
    this.state.levelIcon = levelConfig.icon;
    this.state.levelGoal = levelConfig.goal;
    this.state.matrix = {
      size: levelConfig.matrixSize,
      grid: randomGrid(levelConfig.matrixSize)
    };
  }

  private async loadLevelConfigs(): Promise<void> {
    try {
      const response = await fetch('/levels.csv');
      const text = await response.text();
      const lines = text.trim().split('\n').slice(1).filter(Boolean);
      if (lines.length > 0) {
        const goalMap = new Map<number, number>();
        lines.forEach((line) => {
          const parts = line.split(',');
          goalMap.set(Number(parts[0]), Number(parts[1]));
        });

        this.levelConfigs = DEFAULT_LEVELS.map((level) => ({
          ...level,
          goal: goalMap.get(level.level) ?? level.goal
        }));
      }
    } catch (error) {
      console.warn('Could not load levels.csv, using defaults', error);
    }
  }

  private async loadInitialConfig(): Promise<void> {
    try {
      const response = await fetch('/initial.csv');
      const text = await response.text();
      const lines = text.trim().split('\n').filter(Boolean);
      
      const parsed: Record<string, number[]> = {};
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(s => s.trim());
        const key = cols[0].toLowerCase();
        parsed[key] = [Number(cols[1]), Number(cols[2]), Number(cols[3])];
      }

      if (parsed['chips']) {
        for (let type of [1, 2, 3]) {
          const idx = type - 1;
          this.initialConfigs[type] = {
            chips: Number.isFinite(parsed['chips'][idx]) ? parsed['chips'][idx] : DEFAULT_INITIAL_CONFIG.chips,
            interestRate: Number.isFinite(parsed['interest'][idx]) ? parsed['interest'][idx] : DEFAULT_INITIAL_CONFIG.interestRate,
            dealsLeft: Number.isFinite(parsed['deal'][idx]) ? parsed['deal'][idx] : DEFAULT_INITIAL_CONFIG.dealsLeft,
            shufflesLeft: Number.isFinite(parsed['shuffle'][idx]) ? parsed['shuffle'][idx] : DEFAULT_INITIAL_CONFIG.shufflesLeft
          };
        }
      }
    } catch (error) {
      console.warn('Could not load initial.csv, using defaults', error);
    }
  }

  getState(): GameState {
    return {
      ...this.state,
      matrix: {
        size: this.state.matrix.size,
        grid: this.state.matrix.grid.map((row) => [...row])
      },
      hand: this.state.hand.map((card) => cloneCard(card)),
      deck: this.state.deck.map((card) => cloneCard(card)),
      discardPile: this.state.discardPile.map((card) => cloneCard(card)),
      preview: this.state.preview ? this.cloneClashResult(this.state.preview) : null,
      lastClash: this.state.lastClash ? this.cloneClashResult(this.state.lastClash) : null
    };
  }

  chooseDeck(type: number): void {
    if (this.state.status !== 'CHOOSE_DECK') return;
    this.selectedDeckType = type;
    this.buildDeckForCurrentLevel();
    this.state.status = 'PLAYING';
  }

  selectCard(cardId: string | null): void {
    if (this.state.status !== 'PLAYING') return;
    if (!cardId) {
      this.state.selectedCardIds = [];
    } else {
      const idx = this.state.selectedCardIds.indexOf(cardId);
      if (idx > -1) {
        this.state.selectedCardIds.splice(idx, 1);
      } else {
        this.state.selectedCardIds.push(cardId);
      }
    }
    this.state.preview = null;
    this.lastPreviewEdge = null;
    this.lastPreviewOffset = 0;
    this.lastPreviewPointerRatio = 0.5;
  }

  flipSelectedCard(): void {
    if (this.state.selectedCardIds.length === 0 || this.state.status !== 'PLAYING') return;
    const lastSelected = this.state.selectedCardIds[this.state.selectedCardIds.length - 1];

    this.state.hand = this.state.hand.map((card) => {
      if (card.id !== lastSelected) return card;
      return { ...card, symbols: [...card.symbols].reverse(), isFlipped: !card.isFlipped };
    });
    const edge = this.lastPreviewEdge;
    if (edge) {
      this.lastPreviewEdge = null;
      this.updatePreview(edge, this.lastPreviewPointerRatio);
    }
  }

  updatePreview(edge: InsertEdge | null, pointerRatio = 0.5): void {
    this.lastPreviewPointerRatio = pointerRatio;
    const nextOffset = edge
      ? resolveAttachmentOffset(this.state.matrix.size, CARD_LENGTH, pointerRatio)
      : 0;
    if (this.lastPreviewEdge === edge && this.lastPreviewOffset === nextOffset && (this.state.preview !== null || edge === null)) return;
    this.lastPreviewEdge = edge;
    this.lastPreviewOffset = nextOffset;
    if (this.state.status !== 'PLAYING' || this.state.selectedCardIds.length === 0 || !edge) {
      this.state.preview = null;
      return;
    }
    const lastSelected = this.state.selectedCardIds[this.state.selectedCardIds.length - 1];
    const selectedCard = this.state.hand.find((card) => card.id === lastSelected);
    if (!selectedCard) {
      this.state.preview = null;
      return;
    }
    const res = executeLaneClash(this.state.matrix.grid, edge, selectedCard, this.lastPreviewOffset);
    this.state.preview = { ...res, insertedCardId: selectedCard.id };
  }

  playSelectedToEdge(edge: InsertEdge): ClashResult | null {
    if (this.state.status !== 'PLAYING' || this.state.selectedCardIds.length === 0) return null;
    const lastSelected = this.state.selectedCardIds[this.state.selectedCardIds.length - 1];
    const selectedCard = this.state.hand.find((card) => card.id === lastSelected);
    if (!selectedCard) return null;
    const res = executeLaneClash(this.state.matrix.grid, edge, selectedCard, this.lastPreviewOffset);
    return { ...res, insertedCardId: selectedCard.id };
  }

  applyClashResult(result: ClashResult): void {
    this.state.matrix = {
      size: result.newGrid.length,
      grid: result.newGrid.map((row) => [...row])
    };
    this.state.currentScore += result.scoreDelta;
    this.state.currentScore -= (result.penalty || 0);
    this.state.lastClash = this.cloneClashResult(result);
    const card = this.state.hand.find((item) => item.id === result.insertedCardId);
    if (card) this.state.discardPile.push(card);
    this.state.hand = this.state.hand.filter((item) => item.id !== result.insertedCardId);
    this.state.selectedCardIds = [];
    this.state.preview = null;
    this.lastPreviewEdge = null;
    this.lastPreviewOffset = 0;
    this.lastPreviewPointerRatio = 0.5;
    this.checkLevelWin();
    this.resolveRoundEnd();
  }

  private checkLevelWin(): void {
    if (this.state.status !== 'PLAYING') return;
    if (this.state.currentScore >= this.state.levelGoal) {
      const interestEarned = this.getProjectedInterest();
      this.state.chips += interestEarned;
      this.state.lastInterestEarned = interestEarned;
      this.state.status = this.state.currentLevel >= this.levelConfigs.length ? 'WIN' : 'LEVEL_WON';
    }
  }

  nextLevel(): void {
    if (this.state.status !== 'LEVEL_WON') return;
    this.applyLevelConfig(this.state.currentLevel + 1);
    this.state.currentScore = 0;
    
    const conf = this.initialConfigs[this.selectedDeckType] || this.initialConfigs[1];
    this.state.shufflesLeft = conf.shufflesLeft;
    this.state.dealsLeft = conf.dealsLeft;
    
    this.state.status = 'PLAYING';
    this.state.selectedCardIds = [];
    this.state.preview = null;
    this.state.lastClash = null;
    this.state.lastInterestEarned = 0;
    this.lastPreviewEdge = null;
    this.lastPreviewOffset = 0;
    this.lastPreviewPointerRatio = 0.5;
    this.buildDeckForCurrentLevel();
  }

  shuffleMatrix(): void {
    if (this.state.status !== 'PLAYING' || this.state.shufflesLeft <= 0) return;
    this.state.matrix = {
      size: this.state.matrix.size,
      grid: randomGrid(this.state.matrix.size)
    };
    this.state.shufflesLeft -= 1;
    this.state.preview = null;
    this.state.selectedCardIds = [];
    this.lastPreviewEdge = null;
    this.lastPreviewOffset = 0;
    this.lastPreviewPointerRatio = 0.5;
  }

  dealHand(): void {
    if (this.state.status !== 'PLAYING' || this.state.dealsLeft <= 0 || this.state.deck.length === 0) return;
    
    let cardsToSwap = this.state.hand.filter((card) => this.state.selectedCardIds.includes(card.id));
    if (cardsToSwap.length === 0) {
      cardsToSwap = [...this.state.hand];
    }

    const swapCount = Math.min(cardsToSwap.length, this.state.deck.length);
    if (swapCount === 0) return;

    for (let i = 0; i < swapCount; i++) {
      const cardToSwap = cardsToSwap[i];
      const handIdx = this.state.hand.findIndex((c) => c.id === cardToSwap.id);
      
      const deckIdx = Math.floor(Math.random() * this.state.deck.length);
      const cardFromDeck = this.state.deck[deckIdx];
      
      this.state.hand[handIdx] = cardFromDeck;
      this.state.deck.splice(deckIdx, 1);
      this.state.discardPile.push(cardToSwap);
    }

    this.state.dealsLeft -= 1;
    this.state.selectedCardIds = [];
    this.state.preview = null;
    this.lastPreviewEdge = null;
    this.lastPreviewOffset = 0;
    this.lastPreviewPointerRatio = 0.5;
  }

  private resolveRoundEnd(): void {
    if (this.state.status === 'PLAYING' && this.state.hand.length === 0) {
      if (this.state.currentScore < this.state.levelGoal) {
        this.state.status = 'GAME_OVER';
        this.state.selectedCardIds = [];
      }
    }
  }

  resetGame(): void {
    this.selectedDeckType = 1;
    this.lastPreviewEdge = null;
    this.lastPreviewOffset = 0;
    this.lastPreviewPointerRatio = 0.5;
    this.state = this.createInitialState();
  }
}
