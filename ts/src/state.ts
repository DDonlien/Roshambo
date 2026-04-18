import { createEmptyGrid, executeLaneClash, resolveAttachmentOffset } from './logic';
import { DeckDefinition, DeckDefinitionFile, loadDeckDefinitionFile } from './definitions/deckdefinition';
import { GiftCardDefinition, GiftCardDefinitionFile, loadGiftCardDefinitionFile } from './definitions/giftcarddefinition';
import { loadPlaymatDefinitionFile, PlaymatDefinition, PlaymatDefinitionFile } from './definitions/playmatdefinition';
import { loadShopDefinitionFile, ShopDefinitionFile } from './definitions/shopdefinition';
import { applySleeveEffects, loadSleeveDefinitionFile, SleeveDefinition, SleeveDefinitionFile } from './definitions/sleeveDefinition';
import { getSpecialCardDefinition } from './special-cards/registry';
import { CARD_LENGTH, Card, ClashResult, GameConfig, GameState, GiftCardInstance, InitialConfig, InsertEdge, LevelConfig, PlaymatInstance, RPS, ShopOffer, ShopOfferChoice, SpecialCardInstance } from './types';

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
  O: RPS.TRICOLOR,
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
    ...offer,
    choices: offer.choices?.map((choice) => ({ ...choice }))
  };
}

function cloneSpecialCard(card: SpecialCardInstance): SpecialCardInstance {
  return {
    ...card
  };
}

function cloneGiftCard(card: GiftCardInstance): GiftCardInstance {
  return {
    ...card
  };
}

function clonePlaymat(card: PlaymatInstance): PlaymatInstance {
  return {
    ...card
  };
}

function createCardFromCode(code: string): Card {
  return {
    id: randomId(),
    symbols: code.toUpperCase().split('').map((digit) => MAP_TO_RPS[digit] ?? RPS.BLANK)
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

function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let roll = Math.random() * Math.max(1, total);
  for (const [key, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return key;
  }
  return entries[0][0];
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function upgradeSymbol(symbol: RPS): RPS {
  if (symbol === RPS.BLANK) return RPS.PAPER;
  if (symbol === RPS.PAPER) return RPS.SCISSORS;
  if (symbol === RPS.SCISSORS) return RPS.ROCK;
  return symbol;
}

export class GameStore {
  private state: GameState;
  private levelConfigs: LevelConfig[] = DEFAULT_LEVELS;
  private deckDefinitionFile: DeckDefinitionFile | null = null;
  private sleeveDefinitionFile: SleeveDefinitionFile | null = null;
  private giftCardDefinitionFile: GiftCardDefinitionFile | null = null;
  private playmatDefinitionFile: PlaymatDefinitionFile | null = null;
  private shopDefinitionFile: ShopDefinitionFile | null = null;
  private runDeckTemplate: Card[] = [];
  private initialConfigs: Record<number, InitialConfig> = {
    1: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 },
    2: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 },
    3: { chips: 10, interestRate: 2, dealsLeft: 4, shufflesLeft: 4 }
  };
  private selectedDeckConfigIndex = 1;
  private lastPreviewEdge: InsertEdge | null = null;
  private lastPreviewOffset = 0;
  private lastPreviewPointerRatio = 0.5;

  constructor(_config: Partial<GameConfig> = {}) {
    this.state = this.createInitialState();
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.loadLevelConfigs(),
      this.loadInitialConfig(),
      this.loadDeckDefinitions(),
      this.loadSleeveDefinitions(),
      this.loadGiftCardDefinitions(),
      this.loadPlaymatDefinitions(),
      this.loadShopDefinitions()
    ]);
    this.state = this.createInitialState();
  }

  private async loadDeckDefinitions(): Promise<void> {
    this.deckDefinitionFile = await loadDeckDefinitionFile();
  }

  private async loadSleeveDefinitions(): Promise<void> {
    this.sleeveDefinitionFile = await loadSleeveDefinitionFile();
  }

  private async loadGiftCardDefinitions(): Promise<void> {
    this.giftCardDefinitionFile = await loadGiftCardDefinitionFile();
  }

  private async loadPlaymatDefinitions(): Promise<void> {
    this.playmatDefinitionFile = await loadPlaymatDefinitionFile();
  }

  private async loadShopDefinitions(): Promise<void> {
    this.shopDefinitionFile = await loadShopDefinitionFile();
  }

  getSleeveDefinitions(): SleeveDefinition[] {
    return this.sleeveDefinitionFile?.sleeves ?? [];
  }

  getGiftCardDefinitions(): GiftCardDefinition[] {
    return this.giftCardDefinitionFile?.giftcards ?? [];
  }

  getGiftCardInventoryLimit(): number {
    return this.giftCardDefinitionFile?.inventoryLimit ?? 5;
  }

  getPlaymatDefinitions(): PlaymatDefinition[] {
    return this.playmatDefinitionFile?.playmats ?? [];
  }

  getPlaymatInventoryLimit(): number {
    return this.playmatDefinitionFile?.inventoryLimit ?? 5;
  }

  getOwnedSleeveDefinitions(): SleeveDefinition[] {
    return this.state.sleeves
      .map((sleeve) => this.getSleeveDefinitions().find((definition) => definition.id === sleeve.definitionId) ?? null)
      .filter((definition): definition is SleeveDefinition => definition !== null);
  }

  getGiftCardDefinitionById(definitionId: string): GiftCardDefinition | null {
    return this.getGiftCardDefinitions().find((definition) => definition.id === definitionId) ?? null;
  }

  getPlaymatDefinitionById(definitionId: string): PlaymatDefinition | null {
    return this.getPlaymatDefinitions().find((definition) => definition.id === definitionId) ?? null;
  }

  getShopDefinition(): ShopDefinitionFile {
    return this.shopDefinitionFile ?? {
      version: 1,
      offerSlotCount: SHOP_OFFER_COUNT,
      offerFormWeights: { direct: 70, pack: 30 },
      directTypeWeights: { sleeve: 25, giftcard: 15, playmat: 15, card: 45 },
      packTypeWeights: { sleeve: 20, giftcard: 15, playmat: 25, card: 40 },
      packChoiceCountWeights: { '2': 65, '3': 35 },
      packCostMultiplier: 1.6,
      cardPricing: {
        base: 2,
        rock: 2,
        scissors: 2,
        paper: 1,
        blank: 0,
        tricolor: 4,
        duplicateDiscount: 1,
        diversityBonus: 1,
        tricolorMixBonus: 2
      }
    };
  }

  private getShopCardCodePool(): string[] {
    const basicDigits = ['0', '1', '3', '4'];
    const pool: string[] = [];
    for (const a of basicDigits) {
      for (const b of basicDigits) {
        for (const c of basicDigits) {
          pool.push(`${a}${b}${c}`);
        }
      }
    }
    for (const a of [...basicDigits, 'O']) {
      for (const b of [...basicDigits, 'O']) {
        for (const c of [...basicDigits, 'O']) {
          const code = `${a}${b}${c}`;
          if (!code.includes('O')) continue;
          pool.push(code);
        }
      }
    }
    return Array.from(new Set(pool));
  }

  estimateShopCardCost(code: string): number {
    const pricing = this.getShopDefinition().cardPricing;
    const digits = code.toUpperCase().split('');
    const counts = new Map<string, number>();
    let total = pricing.base;
    digits.forEach((digit) => {
      counts.set(digit, (counts.get(digit) ?? 0) + 1);
      if (digit === '4') total += pricing.rock;
      else if (digit === '3') total += pricing.scissors;
      else if (digit === '1') total += pricing.paper;
      else if (digit === '0') total += pricing.blank;
      else total += pricing.tricolor;
    });
    if (counts.size === 1) total = Math.max(1, total - pricing.duplicateDiscount);
    if (counts.size === 3) total += pricing.diversityBonus;
    if (counts.has('O') && counts.size > 1) total += pricing.tricolorMixBonus;
    return total;
  }

  private buildCardChoice(code: string): ShopOfferChoice {
    return { kind: 'card', cardCode: code };
  }

  private applyShopChoice(choice: ShopOfferChoice): boolean {
    if (choice.kind === 'sleeve' && choice.definitionId) {
      if (this.state.sleeves.length >= (this.sleeveDefinitionFile?.slotLimit ?? 2)) return false;
      this.state.sleeves.push({ instanceId: randomId(), definitionId: choice.definitionId });
      return true;
    }
    if (choice.kind === 'giftcard' && choice.definitionId) {
      return this.addGiftCardToInventory(choice.definitionId);
    }
    if (choice.kind === 'playmat' && choice.definitionId) {
      return this.addPlaymatToInventory(choice.definitionId);
    }
    if (choice.kind === 'card' && choice.cardCode) {
      this.runDeckTemplate.push(createCardFromCode(choice.cardCode));
      return true;
    }
    return false;
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
      status: 'HOME',
      lastClash: null,
      preview: null,
      lastInterestEarned: 0,
      lastLevelReward: 0,
      pendingReward: null,
      shopOffers: [],
      specialCards: [],
      sleeves: [],
      giftCards: [],
      playmats: [],
      activePlaymatDefinitionId: null,
      openedPackOfferId: null,
      handsPlayedThisRun: 0,
      handsPlayedThisLevel: 0,
      dealsUsedThisLevel: 0,
      lastUsedGiftCardDefinitionId: null
    };
  }

  private cloneClashResult(result: ClashResult): ClashResult {
    return {
      ...result,
      newGrid: result.newGrid.map((row) => [...row]),
      baseScoreDelta: result.baseScoreDelta ?? result.scoreDelta,
      pierceCount: result.pierceCount ?? 0,
      pierceMultiplier: result.pierceMultiplier ?? 1,
      laneScores: [...result.laneScores],
      replacedCells: result.replacedCells.map((cell) => ({ ...cell })),
      captureEvents: result.captureEvents?.map((event) => ({ ...event })) ?? [],
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
    const sleeveBonus = this.getOwnedSleeveDefinitions().reduce((bonus, sleeve) => {
      return bonus + sleeve.effects.reduce((effectBonus, effect) => {
        if (effect.type !== 'chips_interest_per_5') return effectBonus;
        return effectBonus + Math.floor(this.state.chips / 5) * effect.value;
      }, 0);
    }, 0);

    return Math.max(0, Math.floor(modifiedInterest + sleeveBonus));
  }

  private getSelectedHandCardsOrdered(): Card[] {
    return this.state.selectedCardIds
      .map((selectedId) => this.state.hand.find((card) => card.id === selectedId) ?? null)
      .filter((card): card is Card => card !== null);
  }

  private drawRandomCardsToHand(targetSize = 5): void {
    while (this.state.hand.length < targetSize && this.state.deck.length > 0) {
      const deckIndex = Math.floor(Math.random() * this.state.deck.length);
      const nextCard = this.state.deck.splice(deckIndex, 1)[0];
      if (nextCard) this.state.hand.push(nextCard);
    }
  }

  private addGiftCardToInventory(definitionId: string): boolean {
    if (this.state.giftCards.length >= this.getGiftCardInventoryLimit()) return false;
    if (!this.getGiftCardDefinitionById(definitionId)) return false;
    this.state.giftCards.push({ instanceId: randomId(), definitionId });
    return true;
  }

  private addPlaymatToInventory(definitionId: string): boolean {
    if (this.state.playmats.length >= this.getPlaymatInventoryLimit()) return false;
    if (!this.getPlaymatDefinitionById(definitionId)) return false;
    this.state.playmats.push({ instanceId: randomId(), definitionId });
    return true;
  }

  private addRandomGiftCards(count: number): void {
    const definitions = shuffleInPlace([...this.getGiftCardDefinitions()]);
    let remaining = count;
    while (remaining > 0 && definitions.length > 0 && this.state.giftCards.length < this.getGiftCardInventoryLimit()) {
      const definition = definitions.shift();
      if (!definition) break;
      this.addGiftCardToInventory(definition.id);
      remaining -= 1;
    }
  }

  private addRandomPlaymats(count: number): void {
    const definitions = shuffleInPlace([...this.getPlaymatDefinitions()]);
    let remaining = count;
    while (remaining > 0 && definitions.length > 0 && this.state.playmats.length < this.getPlaymatInventoryLimit()) {
      const definition = definitions.shift();
      if (!definition) break;
      this.addPlaymatToInventory(definition.id);
      remaining -= 1;
    }
  }

  private addRandomSleeves(count: number): void {
    const ownedIds = new Set(this.state.sleeves.map((sleeve) => sleeve.definitionId));
    const available = shuffleInPlace(this.getSleeveDefinitions().filter((definition) => !ownedIds.has(definition.id)));
    while (count > 0 && available.length > 0 && this.state.sleeves.length < (this.sleeveDefinitionFile?.slotLimit ?? 2)) {
      const definition = available.shift();
      if (!definition) break;
      this.state.sleeves.push({ instanceId: randomId(), definitionId: definition.id });
      count -= 1;
    }
  }

  private getSleeveClashBonus(card: Card, result: ClashResult): { scoreDelta: number; chipsDelta: number } {
    const ownedSleeves = this.getOwnedSleeveDefinitions();
    let flatScore = 0;
    let multiplier = 1;
    let chipsDelta = 0;

    ownedSleeves.forEach((definition) => {
      const applied = applySleeveEffects(definition, {
        card,
        result,
        ownedSleeveCount: ownedSleeves.length,
        emptySleeveSlots: Math.max(0, (this.sleeveDefinitionFile?.slotLimit ?? 2) - ownedSleeves.length),
        dealsLeft: this.state.dealsLeft,
        remainingDeckCount: this.state.deck.length,
        currentChips: this.state.chips,
        handsPlayedThisRun: this.state.handsPlayedThisRun,
        isFinalHand: this.state.hand.length <= 1,
        random: Math.random
      });
      flatScore += applied.flatScore;
      multiplier *= applied.multiplier;
      chipsDelta += applied.chipsDelta;
    });

    const adjustedScore = Math.max(0, Math.floor((result.scoreDelta + flatScore) * multiplier));
    return {
      scoreDelta: adjustedScore,
      chipsDelta
    };
  }

  private buildDeckForCurrentLevel(): void {
    const fullDeck = shuffleInPlace(this.runDeckTemplate.map((card) => cloneCard(card)));
    this.state.hand = fullDeck.slice(0, 5);
    this.state.deck = fullDeck.slice(5);
    this.state.discardPile = [];
  }

  private getPerLevelResourceBonuses(): { deals: number; shuffles: number } {
    const fromSpecials = this.state.specialCards.reduce(
      (accumulator, specialCard) => {
        const definition = getSpecialCardDefinition(specialCard.definitionId);
        accumulator.deals += definition?.bonusDealsPerLevel ?? 0;
        accumulator.shuffles += definition?.bonusShufflesPerLevel ?? 0;
        return accumulator;
      },
      { deals: 0, shuffles: 0 }
    );

    const sleeveDealBonus = this.getOwnedSleeveDefinitions().reduce((sum, sleeve) => {
      return sum + sleeve.effects.reduce((effectSum, effect) => {
        return effect.type === 'bonus_deals_per_level' ? effectSum + effect.value : effectSum;
      }, 0);
    }, 0);

    return {
      deals: fromSpecials.deals + sleeveDealBonus,
      shuffles: fromSpecials.shuffles
    };
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
      specialCards: this.state.specialCards.map((specialCard) => cloneSpecialCard(specialCard)),
      sleeves: this.state.sleeves.map((sleeve) => cloneSpecialCard(sleeve)),
      giftCards: this.state.giftCards.map((giftCard) => cloneGiftCard(giftCard)),
      playmats: this.state.playmats.map((playmat) => clonePlaymat(playmat))
    };
  }

  openDeckSelect(): void {
    if (this.state.status !== 'HOME') return;
    this.state.status = 'CHOOSE_DECK';
  }

  chooseDeckById(deckId: string): void {
    if (this.state.status !== 'CHOOSE_DECK') return;
    const deckDefinitions = this.getDeckDefinitions();
    const deckIndex = deckDefinitions.findIndex((deck) => deck.id === deckId);
    const selectedDeck = deckDefinitions.find((deck) => deck.id === deckId) ?? deckDefinitions[0];
    this.selectedDeckConfigIndex = deckIndex >= 0 ? Math.min(3, deckIndex + 1) : 1;
    this.runDeckTemplate = selectedDeck ? createDeckFromDefinition(selectedDeck) : [];
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
    const sleeveBonus = this.getSleeveClashBonus(selectedCard, { ...res, insertedCardId: selectedCard.id });
    this.state.preview = { ...res, insertedCardId: selectedCard.id, scoreDelta: sleeveBonus.scoreDelta };
  }

  playSelectedToEdge(edge: InsertEdge): ClashResult | null {
    if (this.state.status !== 'PLAYING' || this.state.selectedCardIds.length === 0) return null;
    const lastSelected = this.state.selectedCardIds[this.state.selectedCardIds.length - 1];
    const selectedCard = this.state.hand.find((card) => card.id === lastSelected);
    if (!selectedCard) return null;
    const res = executeLaneClash(this.state.matrix.grid, edge, selectedCard, this.lastPreviewOffset);
    const sleeveBonus = this.getSleeveClashBonus(selectedCard, { ...res, insertedCardId: selectedCard.id });
    return { ...res, insertedCardId: selectedCard.id, scoreDelta: sleeveBonus.scoreDelta };
  }

  applyClashResult(result: ClashResult): void {
    const playedCard = this.state.hand.find((item) => item.id === result.insertedCardId) ?? null;
    const sleeveBonus = playedCard ? this.getSleeveClashBonus(playedCard, result) : { scoreDelta: result.scoreDelta, chipsDelta: 0 };
    this.state.matrix = {
      size: result.newGrid.length,
      grid: result.newGrid.map((row) => [...row])
    };
    this.state.currentScore += sleeveBonus.scoreDelta;
    this.state.currentScore -= (result.penalty || 0);
    this.state.lastClash = this.cloneClashResult({ ...result, scoreDelta: sleeveBonus.scoreDelta });
    const card = playedCard;
    if (card) this.state.discardPile.push(card);
    this.state.hand = this.state.hand.filter((item) => item.id !== result.insertedCardId);
    this.state.chips += this.state.hand.length;
    this.state.chips += sleeveBonus.chipsDelta;
    this.state.handsPlayedThisRun += 1;
    this.state.handsPlayedThisLevel += 1;
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
      const sleeveReward = this.getOwnedSleeveDefinitions().reduce((sum, sleeve) => {
        return sum + sleeve.effects.reduce((effectSum, effect) => {
          return effect.type === 'chips_end_level' ? effectSum + effect.value : effectSum;
        }, 0);
      }, 0);
      const totalReward = interestEarned + levelReward + sleeveReward;

      this.state.chips += totalReward;
      this.state.lastInterestEarned = interestEarned;
      this.state.lastLevelReward = levelReward;
      this.state.pendingReward = {
        level: currentLevelConfig.level,
        stage: currentLevelConfig.stage,
        levelName: currentLevelConfig.name,
        goal: currentLevelConfig.goal,
        baseReward: levelReward,
        interestReward: interestEarned + sleeveReward,
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
    const shopDefinition = this.getShopDefinition();
    const ownedSleeveIds = new Set(this.state.sleeves.map((card) => card.definitionId));
    const cardPool = shuffleInPlace(this.getShopCardCodePool());

    const buildDirectOffer = (): ShopOffer | null => {
      const kind = weightedPick(shopDefinition.directTypeWeights as Record<'sleeve' | 'giftcard' | 'playmat' | 'card', number>);
      if (kind === 'sleeve') {
        if (this.state.sleeves.length >= (this.sleeveDefinitionFile?.slotLimit ?? 2)) return null;
        const sleeve = shuffleInPlace(this.getSleeveDefinitions().filter((definition) => !ownedSleeveIds.has(definition.id)))[0];
        if (!sleeve) return null;
        ownedSleeveIds.add(sleeve.id);
        return { offerId: randomId(), form: 'direct', kind, definitionId: sleeve.id, cost: sleeve.cost, purchased: false };
      }
      if (kind === 'giftcard') {
        if (this.state.giftCards.length >= this.getGiftCardInventoryLimit()) return null;
        const gift = shuffleInPlace([...this.getGiftCardDefinitions()])[0];
        if (!gift) return null;
        return { offerId: randomId(), form: 'direct', kind, definitionId: gift.id, cost: gift.cost, purchased: false };
      }
      if (kind === 'playmat') {
        if (this.state.playmats.length >= this.getPlaymatInventoryLimit()) return null;
        const playmat = shuffleInPlace([...this.getPlaymatDefinitions()])[0];
        if (!playmat) return null;
        return { offerId: randomId(), form: 'direct', kind, definitionId: playmat.id, cost: playmat.cost, purchased: false };
      }
      const code = cardPool.pop();
      if (!code) return null;
      return { offerId: randomId(), form: 'direct', kind, cardCode: code, cost: this.estimateShopCardCost(code), purchased: false };
    };

    const buildPackOffer = (): ShopOffer | null => {
      const kind = weightedPick(shopDefinition.packTypeWeights as Record<'sleeve' | 'giftcard' | 'playmat' | 'card', number>);
      const choiceCount = Number(weightedPick(shopDefinition.packChoiceCountWeights as Record<'2' | '3', number>));
      const choices: ShopOfferChoice[] = [];

      if (kind === 'sleeve') {
        const candidates = shuffleInPlace(this.getSleeveDefinitions().filter((definition) => !ownedSleeveIds.has(definition.id))).slice(0, choiceCount);
        candidates.forEach((definition) => choices.push({ kind, definitionId: definition.id }));
      } else if (kind === 'giftcard') {
        shuffleInPlace([...this.getGiftCardDefinitions()]).slice(0, choiceCount).forEach((definition) => {
          choices.push({ kind, definitionId: definition.id });
        });
      } else if (kind === 'playmat') {
        shuffleInPlace([...this.getPlaymatDefinitions()]).slice(0, choiceCount).forEach((definition) => {
          choices.push({ kind, definitionId: definition.id });
        });
      } else {
        cardPool.splice(0, choiceCount).forEach((code) => choices.push(this.buildCardChoice(code)));
      }

      if (choices.length === 0) return null;
      const baseCosts = choices.map((choice) => {
        if (choice.kind === 'sleeve' && choice.definitionId) {
          return this.getSleeveDefinitions().find((definition) => definition.id === choice.definitionId)?.cost ?? 5;
        }
        if (choice.kind === 'giftcard' && choice.definitionId) {
          return this.getGiftCardDefinitionById(choice.definitionId)?.cost ?? 5;
        }
        if (choice.kind === 'playmat' && choice.definitionId) {
          return this.getPlaymatDefinitionById(choice.definitionId)?.cost ?? 5;
        }
        return this.estimateShopCardCost(choice.cardCode ?? '000');
      });
      const packCost = Math.max(3, Math.floor(Math.max(...baseCosts) * shopDefinition.packCostMultiplier));
      return { offerId: randomId(), form: 'pack', kind, cost: packCost, purchased: false, choices };
    };

    const offers: ShopOffer[] = [];
    while (offers.length < shopDefinition.offerSlotCount) {
      const form = weightedPick(shopDefinition.offerFormWeights as Record<'direct' | 'pack', number>);
      const nextOffer = form === 'pack' ? buildPackOffer() : buildDirectOffer();
      if (!nextOffer) break;
      offers.push(nextOffer);
    }

    this.state.shopOffers = offers;
    this.state.openedPackOfferId = null;
    this.state.activePlaymatDefinitionId = null;
    this.state.status = 'SHOP';
  }

  buyShopOffer(offerId: string): void {
    if (this.state.status !== 'SHOP') return;

    const offer = this.state.shopOffers.find((candidate) => candidate.offerId === offerId);
    if (!offer || offer.purchased || this.state.chips < offer.cost) return;

    this.state.chips -= offer.cost;
    offer.purchased = true;

    if (offer.form === 'pack') {
      this.state.openedPackOfferId = offer.offerId;
      return;
    }

    if (!this.applyShopChoice({
      kind: offer.kind,
      definitionId: offer.definitionId,
      cardCode: offer.cardCode
    })) {
      this.state.chips += offer.cost;
      offer.purchased = false;
    }
  }

  choosePackChoice(offerId: string, choiceIndex: number): boolean {
    if (this.state.status !== 'SHOP') return false;
    const offer = this.state.shopOffers.find((candidate) => candidate.offerId === offerId);
    if (!offer || offer.form !== 'pack' || !offer.purchased || !offer.choices?.[choiceIndex]) return false;
    const choice = offer.choices[choiceIndex];
    if (!this.applyShopChoice(choice)) return false;
    this.state.openedPackOfferId = null;
    return true;
  }

  skipOpenedPack(): void {
    this.state.openedPackOfferId = null;
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
    this.state.openedPackOfferId = null;
    this.state.activePlaymatDefinitionId = null;
    this.state.handsPlayedThisLevel = 0;
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
    this.state.dealsUsedThisLevel += 1;
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
      this.state.activePlaymatDefinitionId = null;
    }
  }

  resetGame(): void {
    this.selectedDeckConfigIndex = 1;
    this.runDeckTemplate = [];
    this.lastPreviewEdge = null;
    this.lastPreviewOffset = 0;
    this.lastPreviewPointerRatio = 0.5;
    this.state = this.createInitialState();
  }

  useGiftCard(instanceId: string): boolean {
    if (this.state.status !== 'SHOP') return false;
    const instanceIndex = this.state.giftCards.findIndex((card) => card.instanceId === instanceId);
    if (instanceIndex === -1) return false;
    const definition = this.getGiftCardDefinitionById(this.state.giftCards[instanceIndex].definitionId);
    if (!definition) return false;

    const removeGift = () => {
      this.state.lastUsedGiftCardDefinitionId = definition.id;
      this.state.giftCards.splice(instanceIndex, 1);
    };

    switch (definition.effect.type) {
      case 'copy_last_used':
        if (!this.state.lastUsedGiftCardDefinitionId || this.state.lastUsedGiftCardDefinitionId === definition.id) return false;
        if (!this.addGiftCardToInventory(this.state.lastUsedGiftCardDefinitionId)) return false;
        removeGift();
        return true;
      case 'spawn_random_giftcards':
        this.addRandomGiftCards(definition.effect.count);
        removeGift();
        return true;
      case 'spawn_random_playmats':
        this.addRandomPlaymats(definition.effect.count);
        removeGift();
        return true;
      case 'double_money_cap':
        this.state.chips += Math.min(this.state.chips, definition.effect.cap);
        removeGift();
        return true;
      case 'add_random_sleeve':
        this.addRandomSleeves(definition.effect.count);
        removeGift();
        return true;
    }
  }

  usePlaymat(instanceId: string): boolean {
    if (this.state.status !== 'PLAYING' || this.state.activePlaymatDefinitionId) return false;
    const instanceIndex = this.state.playmats.findIndex((card) => card.instanceId === instanceId);
    if (instanceIndex === -1) return false;
    const definition = this.getPlaymatDefinitionById(this.state.playmats[instanceIndex].definitionId);
    if (!definition) return false;

    const selectedCards = this.getSelectedHandCardsOrdered();
    const removePlaymat = () => {
      this.state.activePlaymatDefinitionId = definition.id;
      this.state.playmats.splice(instanceIndex, 1);
      this.state.preview = null;
      this.lastPreviewEdge = null;
      this.lastPreviewOffset = 0;
      this.lastPreviewPointerRatio = 0.5;
    };

    switch (definition.effect.type) {
      case 'transform_selected_to_symbol': {
        const effect = definition.effect;
        const targets = selectedCards.slice(0, effect.count);
        if (targets.length === 0) return false;
        const targetIds = new Set(targets.map((card) => card.id));
        this.state.hand = this.state.hand.map((card) => {
          if (!targetIds.has(card.id)) return card;
          return { ...card, symbols: card.symbols.map(() => effect.symbol) };
        });
        removePlaymat();
        return true;
      }
      case 'increase_selected_card_weight': {
        const effect = definition.effect;
        const targets = selectedCards.slice(0, effect.count);
        if (targets.length === 0) return false;
        const targetIds = new Set(targets.map((card) => card.id));
        this.state.hand = this.state.hand.map((card) => {
          if (!targetIds.has(card.id)) return card;
          let next = cloneCard(card);
          for (let step = 0; step < effect.amount; step += 1) {
            next = { ...next, symbols: next.symbols.map((symbol) => upgradeSymbol(symbol)) };
          }
          return next;
        });
        removePlaymat();
        return true;
      }
      case 'destroy_selected_cards': {
        const targets = selectedCards.slice(0, definition.effect.count);
        if (targets.length === 0) return false;
        const targetIds = new Set(targets.map((card) => card.id));
        this.state.hand = this.state.hand.filter((card) => !targetIds.has(card.id));
        this.drawRandomCardsToHand();
        this.state.selectedCardIds = [];
        removePlaymat();
        return true;
      }
      case 'copy_right_card_to_left_card': {
        if (selectedCards.length < 2) return false;
        const [leftCard, rightCard] = selectedCards;
        this.state.hand = this.state.hand.map((card) => {
          if (card.id !== leftCard.id) return card;
          return { ...card, symbols: [...rightCard.symbols], isFlipped: rightCard.isFlipped };
        });
        removePlaymat();
        return true;
      }
    }
  }
}
