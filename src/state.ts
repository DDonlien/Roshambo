import { calculateScore, calculateTheme, compareMatrix, createEmptyGrid, shiftMatrix } from './logic';
import { Card, GameConfig, GameState, InsertEdge, Matrix, RPS } from './types';

const DEFAULT_CONFIG: GameConfig = {
  initialTargetScore: 150
};

const SYMBOL_POOL: readonly RPS[] = [RPS.ROCK, RPS.SCISSORS, RPS.PAPER, RPS.BLANK];

function randomId(): string {
  return crypto.randomUUID();
}

function randomSymbol(): RPS {
  return SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];
}

export const KNOWN_ASSETS = [
  '000', '110', '111', '131', '141', '301', '310', '311', '313', '330', '331', '333', '343',
  '401', '403', '410', '411', '414', '430', '431', '433', '434', '440', '441', '443', '444'
];

const MAP_TO_RPS: Record<string, RPS> = {
  '0': RPS.BLANK,
  '1': RPS.PAPER,
  '3': RPS.SCISSORS,
  '4': RPS.ROCK
};

function randomCard(): Card {
  const code = KNOWN_ASSETS[Math.floor(Math.random() * KNOWN_ASSETS.length)];
  return {
    id: randomId(),
    symbols: [MAP_TO_RPS[code[0]], MAP_TO_RPS[code[1]], MAP_TO_RPS[code[2]]]
  };
}

function randomGrid(): RPS[][] {
  const grid = createEmptyGrid();
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      grid[row][col] = randomSymbol();
    }
  }
  return grid;
}

function createMatrix(grid: RPS[][]): Matrix {
  return {
    grid,
    theme: calculateTheme(grid)
  };
}

function createInitialHand(): Card[] {
  return Array.from({ length: 6 }, () => randomCard());
}

function findCard(hand: Card[], cardId: string): Card | undefined {
  return hand.find((card) => card.id === cardId);
}

export class GameStore {
  private state: GameState;

  constructor(_config: Partial<GameConfig> = {}) {
    const initialGrid = randomGrid();
    this.state = {
      matrix: createMatrix(initialGrid),
      hand: createInitialHand(),
      currentScore: 0,
      shufflesLeft: 4,
      dealsLeft: 4,
      selectedCardId: null,
      status: 'PLAYING',
      lastResolution: null,
      preview: null
    };
  }

  getState(): GameState {
    const preview = this.state.preview;
    return {
      ...this.state,
      matrix: {
        ...this.state.matrix,
        grid: this.state.matrix.grid.map((row) => [...row])
      },
      hand: this.state.hand.map((card) => ({ 
        ...card, 
        symbols: [...card.symbols] as [RPS, RPS, RPS] 
      })),
      preview: preview ? { 
        ...preview,
        newTheme: { ...preview.newTheme },
        oldTheme: { ...preview.oldTheme },
        newGrid: preview.newGrid ? preview.newGrid.map((row) => [...row]) : undefined
      } : null
    };
  }

  selectCard(cardId: string): void {
    if (this.state.status !== 'PLAYING') {
      return;
    }

    if (this.state.selectedCardId === cardId) {
      this.state.selectedCardId = null;
    } else {
      this.state.selectedCardId = cardId;
    }
    this.state.preview = null;
  }

  flipSelectedCard(): void {
    const selected = this.state.selectedCardId;
    if (!selected || this.state.status !== 'PLAYING') {
      return;
    }

    this.state.hand = this.state.hand.map((card) => {
      if (card.id !== selected) {
        return card;
      }
      const newSymbols: [RPS, RPS, RPS] = [card.symbols[2], card.symbols[1], card.symbols[0]];
      return {
        ...card,
        symbols: newSymbols,
        isFlipped: !card.isFlipped
      };
    });
    
    // 如果正在预览，翻转后更新预览
    if (this.state.preview) {
      const edge = (this.storeInternal as any).lastPreviewEdge;
      if (edge) {
        this.updatePreview(edge);
      }
    }
  }

  private storeInternal: any = {};

  updatePreview(edge: InsertEdge | null): void {
    if (this.storeInternal.lastPreviewEdge === edge && (this.state.preview || edge === null)) {
      return;
    }
    
    this.storeInternal.lastPreviewEdge = edge;
    if (this.state.status !== 'PLAYING' || !this.state.selectedCardId || !edge) {
      this.state.preview = null;
      return;
    }

    const selectedCard = findCard(this.state.hand, this.state.selectedCardId);
    if (!selectedCard) {
      this.state.preview = null;
      return;
    }

    const oldMatrix = this.state.matrix;
    // 确保 shiftMatrix 逻辑正确，不产生非法 grid
    const shifted = shiftMatrix(oldMatrix.grid, edge, selectedCard);
    if (!shifted || !shifted.newGrid) {
      this.state.preview = null;
      return;
    }

    const newTheme = calculateTheme(shifted.newGrid);
    const result = compareMatrix(newTheme, oldMatrix.theme);
    const scoreDelta = calculateScore(result, oldMatrix.theme);

    this.state.preview = {
      won: result === 'WIN' || result === 'DUAL', // Just a fallback for legacy code
      result,
      oldTheme: { ...oldMatrix.theme },
      newTheme: { ...newTheme },
      pushedOutCard: result !== 'LOSE' ? { id: 'preview', symbols: [...shifted.pushedOutSymbols] as [RPS, RPS, RPS] } : null,
      insertedCardId: selectedCard.id,
      scoreDelta,
      newGrid: shifted.newGrid.map(row => row.map(cell => cell || RPS.BLANK))
    } as any;
  }

  playSelectedToEdge(edge: InsertEdge): void {
    if (this.state.status !== 'PLAYING' || !this.state.selectedCardId) {
      return;
    }

    const selectedCard = findCard(this.state.hand, this.state.selectedCardId);
    if (!selectedCard) {
      this.state.selectedCardId = null;
      return;
    }

    const oldMatrix = this.state.matrix;
    const shifted = shiftMatrix(oldMatrix.grid, edge, selectedCard);
    const newTheme = calculateTheme(shifted.newGrid);
    const result = compareMatrix(newTheme, oldMatrix.theme);
    const scoreDelta = calculateScore(result, oldMatrix.theme);

    if (result !== 'LOSE') {
      const pushedOutCard: Card = {
        id: randomId(),
        symbols: shifted.pushedOutSymbols
      };
      this.state.matrix = {
        grid: shifted.newGrid,
        theme: newTheme
      };
      this.state.hand = this.state.hand.filter((card) => card.id !== selectedCard.id);
      this.state.hand.push(pushedOutCard);

      this.state.currentScore += scoreDelta;
      this.state.lastResolution = {
        won: true,
        result,
        oldTheme: oldMatrix.theme,
        newTheme,
        pushedOutCard,
        insertedCardId: selectedCard.id,
        scoreDelta
      };
    } else {
      this.state.hand = this.state.hand.filter((card) => card.id !== selectedCard.id);
      this.state.lastResolution = {
        won: false,
        result,
        oldTheme: oldMatrix.theme,
        newTheme,
        pushedOutCard: null,
        insertedCardId: selectedCard.id,
        scoreDelta: 0
      };
    }

    this.state.selectedCardId = null;
    this.state.preview = null;
    this.resolveRoundEnd();
  }

  shuffleMatrix(): void {
    if (this.state.status !== 'PLAYING' || this.state.shufflesLeft <= 0) return;
    
    this.state.matrix = createMatrix(randomGrid());
    this.state.shufflesLeft -= 1;
    this.state.preview = null;
    this.state.selectedCardId = null;
  }

  dealHand(): void {
    if (this.state.status !== 'PLAYING' || this.state.dealsLeft <= 0) return;
    
    const count = this.state.hand.length;
    if (count > 0) {
      this.state.hand = Array.from({ length: count }, () => randomCard());
      this.state.dealsLeft -= 1;
      this.state.preview = null;
      this.state.selectedCardId = null;
    }
  }

  private resolveRoundEnd(): void {
    if (this.state.hand.length === 0) {
      this.state.status = 'GAME_OVER';
      this.state.selectedCardId = null;
    }
  }

  resetGame(): void {
    const newStore = new GameStore({ initialTargetScore: DEFAULT_CONFIG.initialTargetScore });
    this.state = newStore.getState();
  }
}
