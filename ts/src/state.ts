import { createEmptyGrid, executeLaneClash, resolveAttachmentOffset } from './logic';
import { DeckDefinition, DeckDefinitionFile, loadDeckDefinitionFile } from './definitions/deckdefinition';
import { drawShopDefinitions, getSpecialCardDefinition } from './special-cards/registry';
import { CARD_LENGTH, Card, ClashResult, GameConfig, GameState, InitialConfig, InsertEdge, LevelConfig, RPS, ShopOffer, SpecialCardInstance } from './types';

const SYMBOL_POOL: readonly RPS[] = [RPS.ROCK, RPS.SCISSORS, RPS.PAPER, RPS.BLANK];

const TOTAL_STAGES = 9;
const LEVELS_PER_STAGE = 3;
const SHOP_OFFER_COUNT = 3;

const LEVEL_THEME_CYCLE: Array<Pick<LevelConfig, 'name' | 'matrixSize' | 'icon'>> = [
  { name: 'Pocket', matrixSize: 2, icon: 'pocket' },
  { name: 'Rubik', matrixSize: 3, icon: 'rubik' },
  { name: 'Master', matrixSize: 4, icon: 'master' }
];

function createDefaultLevels(): LevelConfig[] {
  return Array.from({ length: TOTAL_STAGES * LEVELS_PER_STAGE }, (_, index) => {
    const stage = Math.floor(index / LEVELS_PER_STAGE) + 1;
    const tier = (index % LEVELS_PER_STAGE) + 1;
    const theme = LEVEL_THEME_CYCLE[index % LEVEL_THEME_CYCLE.length];
    const defaultGoals = [10, 30, 80];
    const defaultRewards = [10, 18, 28];

    return {
      level: index + 1,
      stage,
      tier,
      goal: defaultGoals[tier - 1] + (stage - 1) * 20,
      reward: defaultRewards[tier - 1] + (stage - 1) * 3,
      name: theme.name,
      matrixSize: theme.matrixSize,
      icon: theme.icon
    };
  });
}

const DEFAULT_LEVELS: LevelConfig[] = createDefaultLevels();

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
  '4': RPS.ROCK,
  '7': RPS.TRICOLOR
};

function cloneCard(card: Card): Card {
  return {
    ...card,
    symbols: [...card.symbols]
  };
}

function cloneShopOffer(offer: ShopOffer): ShopOffer {
  return {
    ...offer
  };
}

function cloneSpecialCard(card: SpecialCardInstance): SpecialCardInstance {
  return {
    ...card
  };
}

function createCardFromCode(code: string): Card {
  return {
    id: randomId(),
    symbols: code.split('').map((digit) => MAP_TO_RPS[digit] ?? RPS.BLANK)
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

function createDeckFromDefinition(definition: DeckDefinition): Card[] {
  const codes: string[] = [];
  definition.cards.forEach((entry) => {
    const count = Math.max(0, Math.floor(entry.count));
    for (let i = 0; i < count; i += 1) {
      codes.push(entry.code);
    }
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
  private deckDefinitionFile: DeckDefinitionFile | null = null;
  private initialConfigs: Record<number, InitialConfig> = {
    1: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 },
    2: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 },
    3: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 }
  };
  private selectedDeckConfigIndex = 1;
  private selectedDeckId: string | null = null;
  private lastPreviewEdge: InsertEdge | null = null;
  private lastPreviewOffset = 0;
  private lastPreviewPointerRatio = 0.5;

  constructor(_config: Partial<GameConfig> = {}) {
    this.state = this.createInitialState();
  }

  async initialize(): Promise<void> {
    await Promise.all([this.loadLevelConfigs(), this.loadInitialConfig(), this.loadDeckDefinitions()]);
    this.state = this.createInitialState();
  }

  private async loadDeckDefinitions(): Promise<void> {
    this.deckDefinitionFile = await loadDeckDefinitionFile();
  }

  getDeckDefinitions(): DeckDefinition[] {
    return this.deckDefinitionFile?.decks ?? [];
  }

  getDeckPreviewCards(deckId: string): Card[] {
    const deck = this.getDeckDefinitions().find((candidate) => candidate.id === deckId);
    if (!deck) return [];
    const previewCodes = deck.cards.slice(0, 3).map((entry) => entry.code);
    return previewCodes.map((code, index) => ({ ...createCardFromCode(code), id: `preview-${deckId}-${index}` }));
  }

  private createInitialState(): GameState {
    const firstLevel = this.levelConfigs[0] ?? DEFAULT_LEVELS[0];
    const conf = this.initialConfigs[this.selectedDeckConfigIndex] || this.initialConfigs[1];

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
      currentStage: firstLevel.stage,
      currentTier: firstLevel.tier,
      totalStages: TOTAL_STAGES,
      totalLevels: this.levelConfigs.length,
      levelName: firstLevel.name,
      levelIcon: firstLevel.icon,
      levelGoal: firstLevel.goal,
      levelReward: firstLevel.reward,
      shufflesLeft: conf.shufflesLeft,
      dealsLeft: conf.dealsLeft,
      selectedCardIds: [],
      status: 'CHOOSE_DECK',
      lastClash: null,
      preview: null,
      lastInterestEarned: 0,
      lastLevelReward: 0,
      pendingReward: null,
      shopOffers: [],
      specialCards: []
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
    const baseInterest = Math.floor(this.state.chips * this.state.interestRate);
    const modifiedInterest = this.state.specialCards.reduce((currentValue, specialCard) => {
      const definition = getSpecialCardDefinition(specialCard.definitionId);
      return definition?.modifyProjectedInterest ? definition.modifyProjectedInterest(currentValue) : currentValue;
    }, baseInterest);

    return Math.max(0, Math.floor(modifiedInterest));
  }

  private buildDeckForCurrentLevel(): void {
    const allDecks = this.getDeckDefinitions();
    const selectedDeck = allDecks.find((deck) => deck.id === this.selectedDeckId) ?? allDecks[0];
    const fullDeck = selectedDeck ? createDeckFromDefinition(selectedDeck) : [];
    this.state.hand = fullDeck.slice(0, 5);
    this.state.deck = fullDeck.slice(5);
    this.state.discardPile = [];
  }

  private getPerLevelResourceBonuses(): { deals: number; shuffles: number } {
    return this.state.specialCards.reduce(
      (accumulator, specialCard) => {
        const definition = getSpecialCardDefinition(specialCard.definitionId);
        accumulator.deals += definition?.bonusDealsPerLevel ?? 0;
        accumulator.shuffles += definition?.bonusShufflesPerLevel ?? 0;
        return accumulator;
      },
      { deals: 0, shuffles: 0 }
    );
  }

  private applyLevelConfig(level = this.state.currentLevel): void {
    const levelConfig = this.getCurrentLevelConfigInternal(level);
    this.state.currentLevel = levelConfig.level;
    this.state.currentStage = levelConfig.stage;
    this.state.currentTier = levelConfig.tier;
    this.state.levelName = levelConfig.name;
    this.state.levelIcon = levelConfig.icon;
    this.state.levelGoal = levelConfig.goal;
    this.state.levelReward = levelConfig.reward;
    this.state.matrix = {
      size: levelConfig.matrixSize,
      grid: randomGrid(levelConfig.matrixSize)
    };
  }

  private async loadLevelConfigs(): Promise<void> {
    try {
      const response = await fetch('/definition/levels.csv');
      const text = await response.text();
      const lines = text.trim().split('\n').slice(1).filter(Boolean);
      if (lines.length > 0) {
        const csvMap = new Map<number, { goal?: number; reward?: number }>();
        lines.forEach((line) => {
          const parts = line.split(',').map((part) => part.trim());
          const level = Number(parts[0]);
          if (!Number.isFinite(level)) return;
          csvMap.set(level, {
            goal: Number(parts[1]),
            reward: Number(parts[2])
          });
        });

        this.levelConfigs = DEFAULT_LEVELS.map((level) => ({
          ...level,
          goal: csvMap.get(level.level)?.goal ?? level.goal,
          reward: csvMap.get(level.level)?.reward ?? level.reward
        }));
      }
    } catch (error) {
      console.warn('Could not load levels.csv, using defaults', error);
    }
  }

  private async loadInitialConfig(): Promise<void> {
    try {
      const response = await fetch('/definition/initial.csv');
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
      lastClash: this.state.lastClash ? this.cloneClashResult(this.state.lastClash) : null,
      pendingReward: this.state.pendingReward ? { ...this.state.pendingReward } : null,
      shopOffers: this.state.shopOffers.map((offer) => cloneShopOffer(offer)),
      specialCards: this.state.specialCards.map((specialCard) => cloneSpecialCard(specialCard))
    };
  }

  chooseDeckById(deckId: string): void {
    if (this.state.status !== 'CHOOSE_DECK') return;
    const deckIndex = this.getDeckDefinitions().findIndex((deck) => deck.id === deckId);
    this.selectedDeckId = deckId;
    this.selectedDeckConfigIndex = deckIndex >= 0 ? Math.min(3, deckIndex + 1) : 1;
    this.refillRoundResources();
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

  focusCard(cardId: string | null): void {
    if (this.state.status !== 'PLAYING') return;
    this.state.selectedCardIds = cardId ? [cardId] : [];
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
      const currentLevelConfig = this.getCurrentLevelConfigInternal();
      const interestEarned = this.getProjectedInterest();
      const levelReward = currentLevelConfig.reward;
      const totalReward = interestEarned + levelReward;

      this.state.chips += totalReward;
      this.state.lastInterestEarned = interestEarned;
      this.state.lastLevelReward = levelReward;
      this.state.pendingReward = {
        level: currentLevelConfig.level,
        stage: currentLevelConfig.stage,
        levelName: currentLevelConfig.name,
        goal: currentLevelConfig.goal,
        baseReward: levelReward,
        interestReward: interestEarned,
        totalReward,
        finalLevel: this.state.currentLevel >= this.levelConfigs.length
      };
      this.state.shopOffers = [];
      this.state.status = 'ROUND_REWARD';
    }
  }

  private refillRoundResources(): void {
    const conf = this.initialConfigs[this.selectedDeckConfigIndex] || this.initialConfigs[1];
    const bonuses = this.getPerLevelResourceBonuses();
    this.state.shufflesLeft = conf.shufflesLeft + bonuses.shuffles;
    this.state.dealsLeft = conf.dealsLeft + bonuses.deals;
  }

  openShop(): void {
    if (this.state.status !== 'ROUND_REWARD') return;

    const ownedDefinitionIds = this.state.specialCards.map((card) => card.definitionId);
    const definitions = drawShopDefinitions(ownedDefinitionIds, SHOP_OFFER_COUNT);
    this.state.shopOffers = definitions.map((definition) => ({
      offerId: randomId(),
      definitionId: definition.id,
      cost: definition.cost,
      purchased: false
    }));
    this.state.status = 'SHOP';
  }

  buyShopOffer(offerId: string): void {
    if (this.state.status !== 'SHOP') return;

    const offer = this.state.shopOffers.find((candidate) => candidate.offerId === offerId);
    if (!offer || offer.purchased || this.state.chips < offer.cost) return;

    const definition = getSpecialCardDefinition(offer.definitionId);
    if (!definition) return;

    this.state.chips -= offer.cost;
    offer.purchased = true;
    this.state.specialCards.push({
      instanceId: randomId(),
      definitionId: definition.id
    });

    const applyResult = definition.applyOnAcquire?.({
      chips: this.state.chips,
      projectedInterest: this.getProjectedInterest(),
      dealsLeft: this.state.dealsLeft,
      shufflesLeft: this.state.shufflesLeft
    });

    if (applyResult) {
      this.state.chips += applyResult.chipsDelta ?? 0;
      this.state.dealsLeft += applyResult.dealsDelta ?? 0;
      this.state.shufflesLeft += applyResult.shufflesDelta ?? 0;
    }
  }

  continueAfterShop(): void {
    if (this.state.status !== 'SHOP') return;

    if (this.state.currentLevel >= this.levelConfigs.length) {
      this.state.status = 'WIN';
      this.state.pendingReward = null;
      this.state.shopOffers = [];
      return;
    }

    this.nextLevel();
  }

  nextLevel(): void {
    if (this.state.status !== 'SHOP' && this.state.status !== 'ROUND_REWARD') return;
    this.applyLevelConfig(this.state.currentLevel + 1);
    this.state.currentScore = 0;

    this.refillRoundResources();

    this.state.status = 'PLAYING';
    this.state.selectedCardIds = [];
    this.state.preview = null;
    this.state.lastClash = null;
    this.state.lastInterestEarned = 0;
    this.state.lastLevelReward = 0;
    this.state.pendingReward = null;
    this.state.shopOffers = [];
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
    this.selectedDeckConfigIndex = 1;
    this.selectedDeckId = null;
    this.lastPreviewEdge = null;
    this.lastPreviewOffset = 0;
    this.lastPreviewPointerRatio = 0.5;
    this.state = this.createInitialState();
  }
}
