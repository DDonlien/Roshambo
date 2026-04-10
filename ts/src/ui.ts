import { GameStore } from './state';
import { CARD_LENGTH, Card, GameState, InsertEdge, LevelIcon, RPS } from './types';
import { gsap } from 'gsap';

type Lang = 'EN' | 'ZH' | 'ZH_TW' | 'JA';
let currentLang: Lang = 'EN';

const LANG_DISPLAY: Record<Lang, string> = {
  EN: 'EN',
  ZH: '简',
  ZH_TW: '繁',
  JA: '日'
};

const I18N = {
  EN: {
    STAGE: 'STAGE',
    SCORE: 'SCORE',
    CHIPS: 'CHIPS',
    SHUFFLE_MATRIX: 'SHUFFLE MATRIX',
    DEAL_CARD: 'DEAL CARD',
    DECK: 'DECK',
    WASTED: 'WASTED',
    END: 'END',
    ROTATE: 'Rotate',
    POCKET: 'Pocket',
    RUBIK: 'Rubik',
    MASTER: 'Master',
    CHOOSE_DECK: 'Choose your deck',
    LEVEL_WON: 'Level Cleared!',
    GAME_OVER: 'Game Over',
    WIN: 'You Win!',
    NEXT_LEVEL: 'Next Level',
    RESTART: 'Restart Game'
  },
  ZH: {
    STAGE: '关卡',
    SCORE: '分数',
    CHIPS: '筹码',
    SHUFFLE_MATRIX: '矩阵洗牌',
    DEAL_CARD: '替换手牌',
    DECK: '牌库',
    WASTED: '弃牌堆',
    END: '结束游戏',
    ROTATE: '翻转',
    POCKET: 'Pocket',
    RUBIK: 'Rubik',
    MASTER: 'Master',
    CHOOSE_DECK: '选择牌组',
    LEVEL_WON: '关卡完成！',
    GAME_OVER: '游戏结束',
    WIN: '你赢了！',
    NEXT_LEVEL: '下一关',
    RESTART: '重新开始'
  },
  ZH_TW: {
    STAGE: '關卡',
    SCORE: '分數',
    CHIPS: '籌碼',
    SHUFFLE_MATRIX: '矩陣洗牌',
    DEAL_CARD: '替換手牌',
    DECK: '牌庫',
    WASTED: '棄牌堆',
    END: '結束遊戲',
    ROTATE: '翻轉',
    POCKET: 'Pocket',
    RUBIK: 'Rubik',
    MASTER: 'Master',
    CHOOSE_DECK: '選擇牌組',
    LEVEL_WON: '關卡完成！',
    GAME_OVER: '遊戲結束',
    WIN: '你贏了！',
    NEXT_LEVEL: '下一關',
    RESTART: '重新開始'
  },
  JA: {
    STAGE: 'ステージ',
    SCORE: 'スコア',
    CHIPS: 'チップ',
    SHUFFLE_MATRIX: 'シャッフル',
    DEAL_CARD: 'カードを配る',
    DECK: '山札',
    WASTED: '捨て札',
    END: 'ゲーム終了',
    ROTATE: '回転',
    POCKET: 'Pocket',
    RUBIK: 'Rubik',
    MASTER: 'Master',
    CHOOSE_DECK: 'デッキを選択',
    LEVEL_WON: 'ステージクリア！',
    GAME_OVER: 'ゲームオーバー',
    WIN: 'クリア！',
    NEXT_LEVEL: '次のステージ',
    RESTART: 'リスタート'
  }
};

const EDGE_ORDER: readonly InsertEdge[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];

const SCORE_WEIGHTS: Record<RPS, number> = {
  [RPS.ROCK]: 4,
  [RPS.SCISSORS]: 3,
  [RPS.PAPER]: 1,
  [RPS.BLANK]: 0
};

function getCardFullAsset(card: Card): string {
  const map: Record<string, string> = {
    'ROCK': '0',
    'SCISSORS': '1',
    'PAPER': '3',
    'BLANK': '4'
  };
  // Reverse the array when generating the key because the assets are named top-to-bottom
  // but Card.symbols might be stored bottom-to-top (e.g. 004 instead of 400).
  const key = [...card.symbols].reverse().map(s => map[s]).join('');
  // Fix path for Vite/GitHub pages by adding leading slash or using relative path from root
  return `./Sketch/CardType=${key}.png`;
}

function blockAsset(symbol: RPS): string {
  const nameMap: Record<RPS, string> = {
    [RPS.ROCK]: 'Rock',
    [RPS.SCISSORS]: 'Scissors',
    [RPS.PAPER]: 'Paper',
    [RPS.BLANK]: 'Blank'
  };
  return `./Sketch/BlockType=${nameMap[symbol]}.png`;
}

function iconAsset(icon: LevelIcon): string {
  return `./Sketch/icon_${icon}.png`;
}

function cardClassName(isHandCard: boolean): string {
  return `render-card${isHandCard ? ' card-asset' : ''}`;
}

type CardOrientation = 'vertical' | 'horizontal';

function createCardElement(
  card: Card,
  extraClass = '',
  orientation: CardOrientation = 'vertical',
  isHandCard = false
): HTMLDivElement {
  const element = document.createElement('div');
  element.className = `${cardClassName(isHandCard)} ${orientation === 'horizontal' ? 'render-card-horizontal' : ''} ${extraClass}`.trim();
  element.style.setProperty('--card-block-count', String(card.symbols.length));
  
  if (isHandCard || extraClass.includes('preview-card') || extraClass.includes('modal-card')) {
    element.classList.add('full-asset');
    const image = document.createElement('img');
    image.className = 'card-full-image';
    image.src = getCardFullAsset(card);
    element.appendChild(image);
  } else {
    card.symbols.forEach((symbol) => {
      const image = document.createElement('img');
      image.className = 'card-block';
      image.src = blockAsset(symbol);
      element.appendChild(image);
    });
  }
  return element;
}

function createCardMarkup(card: Card): string {
  return `
    <div class="render-card modal-card full-asset" style="--card-block-count:${card.symbols.length}">
      <img class="card-full-image" src="${getCardFullAsset(card)}">
    </div>
  `;
}

function createPreviewDeckCards(type: number): Card[] {
  const symbolSets: Record<number, RPS[][]> = {
    1: [
      [RPS.PAPER, RPS.BLANK, RPS.BLANK],
      [RPS.SCISSORS, RPS.BLANK, RPS.BLANK],
      [RPS.ROCK, RPS.BLANK, RPS.BLANK]
    ],
    2: [
      [RPS.PAPER, RPS.PAPER, RPS.BLANK],
      [RPS.SCISSORS, RPS.SCISSORS, RPS.BLANK],
      [RPS.ROCK, RPS.ROCK, RPS.BLANK]
    ],
    3: [
      Array.from({ length: CARD_LENGTH }, () => RPS.PAPER),
      Array.from({ length: CARD_LENGTH }, () => RPS.SCISSORS),
      Array.from({ length: CARD_LENGTH }, () => RPS.ROCK)
    ]
  };

  return (symbolSets[type] ?? symbolSets[1]).map((symbols, index) => ({
    id: `preview-${type}-${index}`,
    symbols
  }));
}

export class GameUI {
  private matrixWrapperElement: HTMLElement | null = null;
  private matrixElement: HTMLElement | null = null;
  private previewBoxElement: HTMLElement | null = null;
  private handElement: HTMLElement | null = null;
  private mouseX: number = 0;
  private mouseY: number = 0;
  private isAnimating: boolean = false;

  constructor(private readonly store: GameStore, private readonly root: HTMLElement) {}

  mount(): void {
    this.initialRender();
  }

  private getPointerRatioForEdge(edge: InsertEdge, event: MouseEvent): number {
    const rect = this.matrixWrapperElement?.getBoundingClientRect();
    if (!rect) {
      return 0.5;
    }

    if (edge === 'TOP' || edge === 'BOTTOM') {
      return (event.clientX - rect.left) / rect.width;
    }

    return (event.clientY - rect.top) / rect.height;
  }

  private updateEdgePreview(edge: InsertEdge, event: MouseEvent, zone: HTMLElement): void {
    if (this.isAnimating) return;
    const state = this.store.getState();
    if (state.selectedCardIds.length === 0) return;
    if (!zone.matches(':hover')) return;
    this.store.updatePreview(edge, this.getPointerRatioForEdge(edge, event));
    this.render();
  }

  private getCellMetrics(size: number): { cellSize: number; gap: number; stride: number } {
    if (!this.matrixElement) {
      return { cellSize: 0, gap: 0, stride: 0 };
    }

    const gap = parseFloat(getComputedStyle(this.matrixElement).gap || '0');
    const cellSize = (this.matrixElement.offsetWidth - gap * (size - 1)) / size;
    return {
      cellSize,
      gap,
      stride: cellSize + gap
    };
  }

  private isInsideSafeZone(): boolean {
    const sidebar = document.querySelector('.sidebar');
    const bottomArea = document.querySelector('.bottom-area');
    
    if (sidebar) {
      const sidebarRect = sidebar.getBoundingClientRect();
      if (this.mouseX <= sidebarRect.right) {
        return true;
      }
    }
    
    if (bottomArea) {
      const bottomRect = bottomArea.getBoundingClientRect();
      // Added a slight buffer (e.g., 20px) above the bottom area
      if (this.mouseY >= bottomRect.top - 20) {
        return true;
      }
    }
    
    return false;
  }

  private initialRender(): void {
    this.root.innerHTML = '';

    document.addEventListener('mousedown', (e) => {
      const state = this.store.getState();
      if (state.selectedCardIds.length > 0) {
        const target = e.target as HTMLElement;
        const isCard = target.closest('.card-asset');
        const isDropZone = target.closest('.drop-zone') || target.closest('.preview-box');
        const isButton = target.closest('button') || target.closest('.deck-btn');
        if (!isCard && !isDropZone && !isButton) {
          const lastId = state.selectedCardIds[state.selectedCardIds.length - 1];
          const cardElement = this.handElement?.querySelector(`[data-card-id="${lastId}"]`) as HTMLElement | null;
          if (cardElement) {
            cardElement.classList.remove('held');
            gsap.set(cardElement, { clearProps: 'all' });
          }
          this.store.selectCard(null);
          this.render();
        }
      }
    });

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.width = '100%';
    container.style.height = '100%';

    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-title">Roshambo!</div>
        <button class="btn-lang" id="ui-btn-lang" title="Switch Language">${LANG_DISPLAY[currentLang]}</button>
      </div>
      <div class="stage-box">
        <img id="ui-level-icon" class="stage-icon" src="${iconAsset('pocket')}" alt="stage">
        <div class="stage-copy">
          <span class="stage-label" id="ui-level">STAGE 1/3</span>
          <span class="stage-name" id="ui-level-name">Pocket</span>
        </div>
        <div class="stage-goal" id="ui-goal">10</div>
      </div>
      <div class="score-box">
        <span class="label" id="ui-score-label">SCORE</span>
        <span class="value" id="ui-score">0</span>
      </div>
      <div class="score-box chips-box" id="ui-chips-box">
        <span class="label chips-label" id="ui-chips-label">CHIPS</span>
        <div class="chips-value-wrap">
          <span class="value chips-value" id="ui-chips">10</span>
          <span class="interest-preview" id="ui-interest-preview">+2</span>
        </div>
      </div>
      <div class="deck-actions">
        <div class="deck-btn" id="ui-btn-shuffle">
          <span class="label" id="ui-shuffle-label">SHUFFLE MATRIX</span>
          <div class="val-box"><span class="val blue" id="ui-shuffle-count">4</span><span class="val-max"> / 4</span></div>
        </div>
        <div class="deck-btn" id="ui-btn-deal">
          <span class="label" id="ui-deal-label">DEAL CARD</span>
          <div class="val-box"><span class="val red" id="ui-deal-count">4</span><span class="val-max"> / 4</span></div>
        </div>
      </div>
      <div class="action-row">
        <button class="btn-end" id="ui-btn-end">END</button>
        <button class="btn-rotate" id="ui-btn-rotate">Rotate</button>
      </div>
    `;
    container.appendChild(sidebar);

    const playArea = document.createElement('div');
    playArea.className = 'play-area';
    container.appendChild(playArea);

    const relics = document.createElement('div');
    relics.className = 'relics-row';
    relics.innerHTML = '<div class="relic-slot"></div><div class="relic-slot"></div>';
    playArea.appendChild(relics);

    const matrixWrapper = document.createElement('div');
    matrixWrapper.className = 'matrix-wrapper';
    this.matrixWrapperElement = matrixWrapper;

    const matrix = document.createElement('div');
    matrix.className = 'matrix';
    this.matrixElement = matrix;
    matrixWrapper.appendChild(matrix);

    EDGE_ORDER.forEach(edge => {
      const dz = document.createElement('div');
      dz.className = `drop-zone drop-zone-${edge.toLowerCase()}`;
      dz.setAttribute('data-edge', edge);
      
      const visual = document.createElement('div');
      visual.className = 'drop-zone-visual';
      dz.appendChild(visual);
      
      dz.addEventListener('mouseenter', (event) => {
        this.updateEdgePreview(edge, event, dz);
      });

      dz.addEventListener('mousemove', (event) => {
        this.updateEdgePreview(edge, event, dz);
      });

      dz.addEventListener('mouseleave', () => {
        if (this.isAnimating) return;
        this.store.updatePreview(null);
        this.render();
      });

      dz.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isAnimating) return;
        const state = this.store.getState();
        if (state.selectedCardIds.length > 0) {
          this.handleClash(edge);
        }
      });

      matrixWrapper.appendChild(dz);
    });

    const previewBox = document.createElement('div');
    previewBox.className = 'preview-box';
    this.previewBoxElement = previewBox;
    
    previewBox.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isAnimating) return;
      const lastEdge = this.store.getLastPreviewEdge();
      if (lastEdge) {
        this.handleClash(lastEdge);
      }
    });

    matrixWrapper.appendChild(previewBox);
    playArea.appendChild(matrixWrapper);

    const bottomArea = document.createElement('div');
    bottomArea.className = 'bottom-area';
    
    const deckPile = document.createElement('div');
    deckPile.className = 'pile-icon';
    deckPile.id = 'ui-deck-pile';
    deckPile.innerHTML = `<span class="pile-count" id="ui-deck-count">0</span><span class="pile-label">DECK</span>`;
    bottomArea.appendChild(deckPile);

    const hand = document.createElement('div');
    hand.className = 'hand-row';
    this.handElement = hand;
    bottomArea.appendChild(hand);

    const discardPile = document.createElement('div');
    discardPile.className = 'pile-icon';
    discardPile.id = 'ui-discard-pile';
    discardPile.innerHTML = `<span class="pile-count" id="ui-discard-count">0</span><span class="pile-label">WASTED</span>`;
    bottomArea.appendChild(discardPile);

    playArea.appendChild(bottomArea);
    this.root.appendChild(container);

    this.root.querySelector('#ui-btn-rotate')?.addEventListener('click', () => {
      this.store.flipSelectedCard();
      this.render();
    });
    this.root.querySelector('#ui-btn-end')?.addEventListener('click', () => {
      this.store.resetGame();
      this.render();
    });
    this.root.querySelector('#ui-btn-shuffle')?.addEventListener('click', () => {
      if (this.store.getState().shufflesLeft > 0) {
        this.store.shuffleMatrix();
        this.render();
      }
    });
    this.root.querySelector('#ui-btn-deal')?.addEventListener('click', () => {
      if (this.store.getState().dealsLeft > 0) {
        this.store.dealHand();
        this.render();
      }
    });

    const langBtn = this.root.querySelector('#ui-btn-lang');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        if (currentLang === 'EN') currentLang = 'ZH';
        else if (currentLang === 'ZH') currentLang = 'ZH_TW';
        else if (currentLang === 'ZH_TW') currentLang = 'JA';
        else currentLang = 'EN';
        
        langBtn.textContent = LANG_DISPLAY[currentLang];
        this.render();
      });
    }

    window.addEventListener('resize', () => this.render());
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.updateHeldPosition();
    });
    window.addEventListener('wheel', (e) => {
      const state = this.store.getState();
      if (this.isAnimating || state.selectedCardIds.length === 0) return;
      e.preventDefault();
      this.store.flipSelectedCard();
      this.render();
    }, { passive: false });

    this.render();
  }

  private async handleClash(edge: InsertEdge): Promise<void> {
    if (this.isAnimating) return;

    const state = this.store.getState();
    const size = state.matrix.size;
    const lastId = state.selectedCardIds[state.selectedCardIds.length - 1];
    const selectedCard = state.hand.find((card) => card.id === lastId);
    if (!selectedCard) return;

    const result = this.store.playSelectedToEdge(edge);
    if (!result) return;

    this.isAnimating = true;
    try {
      const previewBox = this.previewBoxElement;
      const dzBlocks = previewBox ? Array.from(previewBox.querySelectorAll('.card-block')) as HTMLElement[] : [];
      const buildLaneIndices = (laneIndex: number): number[] => {
        const indices: number[] = [];
        for (let step = 0; step < size; step += 1) {
          let r = 0, c = 0;
          if (edge === 'TOP') { r = step; c = laneIndex; }
          else if (edge === 'BOTTOM') { r = size - 1 - step; c = laneIndex; }
          else if (edge === 'LEFT') { r = laneIndex; c = step; }
          else if (edge === 'RIGHT') { r = laneIndex; c = size - 1 - step; }
          indices.push(r * size + c);
        }
        return indices;
      };

      let visualScore = Number(state.currentScore) || 0;
      const { stride } = this.getCellMetrics(size);

      for (let cardIndex = 0; cardIndex < selectedCard.symbols.length; cardIndex += 1) {
        const laneIndex = result.attachmentOffset + cardIndex;
        const attackerBlock = dzBlocks[cardIndex];

        if (laneIndex < 0 || laneIndex >= size) {
          if (attackerBlock) {
            await gsap.to(attackerBlock, { scale: 0, opacity: 0, rotation: (Math.random() - 0.5) * 180, duration: 0.3, ease: 'power2.in' });
          }
          continue;
        }

        const laneIndices = buildLaneIndices(laneIndex);
        const firstCellIdx = laneIndices[0];
        const firstCellPos = { r: Math.floor(firstCellIdx / size), c: firstCellIdx % size };

        const laneShift = result.shiftedLanes?.find((shift) => {
          if (edge === 'TOP' || edge === 'BOTTOM') return shift.type === 'col' && shift.index === laneIndex;
          if (edge === 'LEFT' || edge === 'RIGHT') return shift.type === 'row' && shift.index === laneIndex;
          return false;
        });

        if (laneShift && attackerBlock) {
          const firstCell = this.matrixElement?.children[firstCellIdx] as HTMLElement;
          const startRect = attackerBlock.getBoundingClientRect();
          const endRect = firstCell.getBoundingClientRect();
          const localDx = endRect.left - startRect.left;
          const localDy = endRect.top - startRect.top;

          const tl = gsap.timeline();
          await tl.to(attackerBlock, { x: localDx * 0.4, y: localDy * 0.4, duration: 0.15, ease: 'power2.out' })
            .to(attackerBlock, { x: -localDx * 0.2, y: -localDy * 0.2, duration: 0.25, ease: 'elastic.out(1, 0.3)' });

          gsap.to(attackerBlock, { scale: 0, opacity: 0, rotation: (Math.random() - 0.5) * 180, duration: 0.3, ease: 'power2.in' });

          gsap.fromTo(firstCell, { filter: 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)' }, { filter: 'none', duration: 0.5 });

          const attackerType = selectedCard.symbols[cardIndex];
          const penaltyVal = Number(SCORE_WEIGHTS[attackerType]) || 0;
          if (penaltyVal > 0) {
            this.showScorePopup(-penaltyVal, firstCellIdx, true);
            visualScore -= penaltyVal;
            const scoreVal = document.getElementById('ui-score');
            if (scoreVal) {
              scoreVal.textContent = Math.floor(visualScore).toString();
              gsap.fromTo(scoreVal, { scale: 1.4, color: '#F44336', x: 5 }, { scale: 1, color: '#FFF', x: 0, duration: 0.3 });
            }
          }

          const laneCells = laneIndices.map((idx) => this.matrixElement?.children[idx] as HTMLElement);
          let sx = 0, sy = 0;
          if (laneShift.type === 'row') sx = laneShift.direction * stride;
          else sy = laneShift.direction * stride;

          const shiftPromises = laneCells.map((cell) => gsap.to(cell, {
            x: sx,
            y: sy,
            duration: 0.4,
            ease: 'power2.inOut',
            onComplete: () => {
              gsap.set(cell, { x: 0, y: 0 });
            }
          }));
          await Promise.all(shiftPromises);

          laneIndices.forEach((idx) => {
            const r = Math.floor(idx / size);
            const c = idx % size;
            (this.matrixElement?.children[idx] as HTMLImageElement).src = blockAsset(result.newGrid[r][c]);
          });
          continue;
        }

        const laneStartsWinning = result.replacedCells.some((cell) => cell.r === firstCellPos.r && cell.c === firstCellPos.c);

        if (laneStartsWinning && attackerBlock) {
          gsap.set(attackerBlock, { opacity: 0 });
        } else if (attackerBlock) {
          const firstCell = this.matrixElement?.children[firstCellIdx] as HTMLElement;
          if (firstCell) {
            const isTie = result.tieCells?.some(c => c.r === firstCellPos.r && c.c === firstCellPos.c);

            if (isTie) {
              gsap.to(attackerBlock, { x: "+=4", duration: 0.05, yoyo: true, repeat: 5, onComplete: () => {
                gsap.to(attackerBlock, { scale: 0, opacity: 0, rotation: (Math.random() - 0.5) * 180, duration: 0.3, ease: 'power2.in' });
              }});
              gsap.fromTo(firstCell, { x: -4 }, { x: 4, duration: 0.05, yoyo: true, repeat: 5, onComplete: () => { gsap.set(firstCell, { x: 0 }); } });
            } else {
              gsap.to(attackerBlock, { scale: 0, opacity: 0, duration: 0.3, ease: 'power2.in' });
              gsap.fromTo(firstCell, { x: -4 }, { x: 4, duration: 0.05, yoyo: true, repeat: 5, onComplete: () => { gsap.set(firstCell, { x: 0 }); } });
              gsap.fromTo(firstCell, { filter: 'brightness(1.5) hue-rotate(-30deg)' }, { filter: 'none', duration: 0.4 });
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
          } else {
            gsap.to(attackerBlock, { scale: 0, opacity: 0, duration: 0.4, ease: 'power2.in' });
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }

        for (let step = 0; step < size; step += 1) {
          const index = laneIndices[step];
          const cellPos = { r: Math.floor(index / size), c: index % size };
          
          const isReplaced = result.replacedCells.some((cell) => cell.r === cellPos.r && cell.c === cellPos.c);
          const isFailed = result.failedCells?.some((cell) => cell.r === cellPos.r && cell.c === cellPos.c);
          const isTie = result.tieCells?.some((cell) => cell.r === cellPos.r && cell.c === cellPos.c);

          if (!isReplaced && !isFailed && !isTie) break;

          const img = this.matrixElement?.children[index] as HTMLImageElement;
          
          if ((isFailed || isTie) && img) {
            gsap.fromTo(img, { x: -4 }, { x: 4, duration: 0.05, yoyo: true, repeat: 5, onComplete: () => { gsap.set(img, { x: 0 }); } });
            
            if (isFailed) {
              const attackerType = selectedCard.symbols[cardIndex];
              const penaltyVal = Number(SCORE_WEIGHTS[attackerType]) || 0;
              
              if (penaltyVal > 0) {
                gsap.fromTo(img, { filter: 'brightness(1.5) hue-rotate(-30deg)' }, { filter: 'none', duration: 0.4 });
                
                const popupIndex = step > 0 ? laneIndices[step - 1] : index;
                this.showScorePopup(-penaltyVal, popupIndex, true);
                
                visualScore -= penaltyVal;
                const scoreVal = document.getElementById('ui-score');
                if (scoreVal) {
                  scoreVal.textContent = Math.floor(visualScore).toString();
                  gsap.fromTo(scoreVal, { scale: 1.4, color: '#F44336', x: 5 }, { scale: 1, color: '#FFF', x: 0, duration: 0.3 });
                }
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            break;
          }

          if (isReplaced && img) {
            const defenderSymbol = state.matrix.grid[cellPos.r][cellPos.c];
            const gain = SCORE_WEIGHTS[defenderSymbol];
            const smash = 30; let sx = 0, sy = 0;
            if (edge === 'TOP') sy = -smash; else if (edge === 'BOTTOM') sy = smash;
            else if (edge === 'LEFT') sx = -smash; else if (edge === 'RIGHT') sx = smash;

            img.src = blockAsset(result.newGrid[cellPos.r][cellPos.c]);
            gsap.fromTo(img,
              { x: sx, y: sy, scale: 1.5, zIndex: 100, filter: 'brightness(2) contrast(1.1) drop-shadow(0 0 15px rgba(255,160,0,0.8))' },
              { x: 0, y: 0, scale: 1, zIndex: 1, filter: 'brightness(1) contrast(1) drop-shadow(0 0 0px rgba(0,0,0,0))', duration: 0.6, ease: 'elastic.out(1, 0.6)' }
            );

            if (gain > 0) {
              this.showScorePopup(gain, index);
              visualScore += gain;
              const scoreVal = document.getElementById('ui-score');
              if (scoreVal) {
                scoreVal.textContent = visualScore.toString();
                gsap.fromTo(scoreVal, { scale: 1.4, color: '#FF9800', x: -5 }, { scale: 1, color: '#FFF', x: 0, duration: 0.3 });
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      this.store.applyClashResult(result);
      this.isAnimating = false;
      this.render();
    }
  }

  private showScorePopup(score: number, matrixIndex: number, isPenalty: boolean = false): void {
    const tile = this.matrixElement?.children[matrixIndex] as HTMLElement;
    if (!tile) return;
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = score > 0 ? `+${score}` : `${score}`;
    if (isPenalty) {
      popup.style.color = '#F44336';
      popup.style.textShadow = '0 0 10px rgba(0,0,0,0.9), 0 0 20px rgba(244, 67, 54, 0.6)';
    }
    document.body.appendChild(popup);
    const rect = tile.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    gsap.set(popup, { left: 0, top: 0, x, y, scale: 0, opacity: 1, xPercent: -50, yPercent: -50 });
    gsap.to(popup, { scale: 1.5, y: y - 100, duration: 0.8, ease: "back.out(2)" });
    gsap.to(popup, { opacity: 0, delay: 0.6, duration: 0.4, onComplete: () => popup.remove() });
  }

  private updateHeldPosition(): void {
    if (this.isAnimating) return;
    const state = this.store.getState();
    const lastId = state.selectedCardIds[state.selectedCardIds.length - 1];
    this.handElement?.querySelectorAll('.held').forEach((el) => {
      const cardId = el.getAttribute('data-card-id');
      if (cardId !== lastId) {
        el.classList.remove('held');
        (el as HTMLElement).style.left = '';
        (el as HTMLElement).style.top = '';
        gsap.set(el, { clearProps: "all" });
      }
    });

    if (!lastId) return;

    const cardElement = this.handElement?.querySelector(`[data-card-id="${lastId}"]`) as HTMLElement | null;
    if (!cardElement || !this.handElement) return;

    const shouldReturnToHand = this.isInsideSafeZone();

    if (shouldReturnToHand) {
      if (state.preview) {
        this.store.updatePreview(null);
      }
      if (cardElement.classList.contains('held') || state.preview) {
        cardElement.classList.remove('held');
        cardElement.style.left = '';
        cardElement.style.top = '';
        gsap.killTweensOf(cardElement);
        gsap.set(cardElement, { clearProps: 'all' });
        this.render();
      }
      return;
    }

    if (!cardElement.classList.contains('held')) {
      cardElement.classList.add('held');
      gsap.killTweensOf(cardElement);
      if (state.selectedCardIds.length > 1) {
        this.store.selectCard(lastId);
        this.renderHand(this.store.getState());
      }
    }
    gsap.set(cardElement, {
      left: this.mouseX,
      top: this.mouseY,
      x: 0,
      y: 0,
      xPercent: -50,
      yPercent: -50,
      rotation: 0,
      opacity: state.preview ? 0 : 1,
      pointerEvents: 'none'
    });
  }

  private showPileModal(type: 'DECK' | 'DISCARD'): void {
    const state = this.store.getState();
    const cards = type === 'DECK' ? state.deck : state.discardPile;
    const title = type === 'DECK' ? I18N[currentLang].DECK : I18N[currentLang].WASTED;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay pile-overlay';
    overlay.innerHTML = `
      <div class="modal-content pile-view">
        <div class="modal-header"><h2>${title} (${cards.length})</h2><button class="close-btn">&times;</button></div>
        <div class="pile-grid">
          ${cards.map((card) => `<div class="pile-card-item">${createCardMarkup(card)}</div>`).join('')}
        </div>
      </div>
    `;
    this.root.appendChild(overlay);
    overlay.querySelector('.close-btn')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  private renderStatusOverlay(state: GameState): void {
    this.root.querySelector('.status-overlay')?.remove();

    if (state.status === 'PLAYING') return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay status-overlay';

    if (state.status === 'CHOOSE_DECK') {
      const previewGroups = [1, 2, 3].map((type) => {
        const cards = createPreviewDeckCards(type);
        return `
          <div class="deck-option" data-type="${type}">
            <h3>${type === 1 ? 'Balanced' : type === 2 ? 'Multi-hit' : 'Hardcore'}</h3>
            <div class="preview-cards">
              ${cards.map((card) => createCardMarkup(card)).join('')}
            </div>
          </div>
        `;
      }).join('');

      overlay.innerHTML = `
        <div class="modal-content deck-selector">
          <h1>${I18N[currentLang].CHOOSE_DECK}</h1>
          <div class="deck-options">${previewGroups}</div>
        </div>
      `;
      this.root.appendChild(overlay);
      overlay.querySelectorAll('.deck-option').forEach((option) => {
        option.addEventListener('click', () => {
          this.store.chooseDeck(parseInt(option.getAttribute('data-type') || '1', 10));
          this.render();
        });
      });
      return;
    }

    if (state.status === 'LEVEL_WON') {
      overlay.innerHTML = `
        <div class="modal-content status-card">
          <h1 class="status-title success">${I18N[currentLang].LEVEL_WON}</h1>
          <p class="status-copy">Interest: CHIPS +${state.lastInterestEarned}</p>
          <button id="next-btn" class="status-button success">${I18N[currentLang].NEXT_LEVEL}</button>
        </div>
      `;
      this.root.appendChild(overlay);
      overlay.querySelector('#next-btn')?.addEventListener('click', () => {
        this.store.nextLevel();
        this.render();
      });
      return;
    }

    if (state.status === 'WIN') {
      overlay.innerHTML = `
        <div class="modal-content status-card">
          <h1 class="status-title gold">${I18N[currentLang].WIN}</h1>
          <p class="status-copy">You conquered all 3 levels!</p>
          <p class="status-copy">Final Chips: ${state.chips}</p>
          <button id="restart-btn" class="status-button primary">${I18N[currentLang].RESTART}</button>
        </div>
      `;
      this.root.appendChild(overlay);
      overlay.querySelector('#restart-btn')?.addEventListener('click', () => {
        this.store.resetGame();
        this.render();
      });
      return;
    }

    overlay.innerHTML = `
      <div class="modal-content status-card">
        <h1 class="status-title">${I18N[currentLang].GAME_OVER}</h1>
        <p class="status-copy">Final Score: ${state.currentScore}</p>
        <button id="restart-btn" class="status-button danger">${I18N[currentLang].RESTART}</button>
      </div>
    `;
    this.root.appendChild(overlay);
    overlay.querySelector('#restart-btn')?.addEventListener('click', () => {
      this.store.resetGame();
      this.render();
    });
  }

  private render(): void {
    const state = this.store.getState();
    const size = state.matrix.size;
    const lastPreviewEdge = this.store.getLastPreviewEdge();

    document.documentElement.style.setProperty('--matrix-size', String(size));
    document.documentElement.style.setProperty('--card-length', String(CARD_LENGTH));

    const levelEl = document.getElementById('ui-level'); if (levelEl) levelEl.textContent = `${I18N[currentLang].STAGE} ${state.currentLevel}/3`;
    const levelNameEl = document.getElementById('ui-level-name'); if (levelNameEl) levelNameEl.textContent = state.levelName;
    const levelIconEl = document.getElementById('ui-level-icon') as HTMLImageElement | null; if (levelIconEl) levelIconEl.src = iconAsset(state.levelIcon);
    const goalEl = document.getElementById('ui-goal'); if (goalEl) goalEl.textContent = (state.levelGoal || 0).toString();
    const scoreEl = document.getElementById('ui-score'); if (scoreEl) scoreEl.textContent = (state.currentScore || 0).toString();
    const chipsEl = document.getElementById('ui-chips'); if (chipsEl) chipsEl.textContent = (state.chips || 0).toString();
    const interestPreviewEl = document.getElementById('ui-interest-preview'); if (interestPreviewEl) interestPreviewEl.textContent = `+${this.store.getProjectedInterest()}`;

    const shuffleBtn = document.getElementById('ui-btn-shuffle');
    if (shuffleBtn) {
      shuffleBtn.querySelector('.val')!.textContent = state.shufflesLeft.toString();
      state.shufflesLeft <= 0 || state.status !== 'PLAYING' ? shuffleBtn.classList.add('disabled') : shuffleBtn.classList.remove('disabled');
    }
    const deckIcon = document.getElementById('ui-deck-pile'); if (deckIcon) deckIcon.onclick = () => this.showPileModal('DECK');
    const discardIcon = document.getElementById('ui-discard-pile'); if (discardIcon) discardIcon.onclick = () => this.showPileModal('DISCARD');
    const dealBtn = document.getElementById('ui-btn-deal');
    if (dealBtn) {
      dealBtn.querySelector('.val')!.textContent = state.dealsLeft.toString();
      (state.dealsLeft <= 0 || state.status !== 'PLAYING' || state.deck.length === 0) ? dealBtn.classList.add('disabled') : dealBtn.classList.remove('disabled');
    }
    (document.getElementById('ui-btn-rotate') as HTMLButtonElement).disabled = state.selectedCardIds.length === 0;
    const deckCountEl = document.getElementById('ui-deck-count'); if (deckCountEl) deckCountEl.textContent = state.deck.length.toString();
    const discardCountEl = document.getElementById('ui-discard-count'); if (discardCountEl) discardCountEl.textContent = state.discardPile.length.toString();

    // Update Translations
    const stageLabel = document.getElementById('ui-level');
    if (stageLabel) stageLabel.textContent = `${I18N[currentLang].STAGE} ${state.currentLevel}/3`;
    
    const stageName = document.getElementById('ui-level-name');
    if (stageName) {
      const key = state.levelName.toUpperCase() as keyof typeof I18N['EN'];
      stageName.textContent = I18N[currentLang][key] || state.levelName;
    }
    
    const scoreLabel = document.getElementById('ui-score-label');
    if (scoreLabel) scoreLabel.textContent = I18N[currentLang].SCORE;

    const chipsLabel = document.getElementById('ui-chips-label');
    if (chipsLabel) chipsLabel.textContent = I18N[currentLang].CHIPS;

    const shuffleLabel = document.getElementById('ui-shuffle-label');
    if (shuffleLabel) shuffleLabel.textContent = I18N[currentLang].SHUFFLE_MATRIX;

    const dealLabel = document.getElementById('ui-deal-label');
    if (dealLabel) dealLabel.textContent = I18N[currentLang].DEAL_CARD;

    const endBtn = document.getElementById('ui-btn-end');
    if (endBtn) endBtn.textContent = I18N[currentLang].END;

    const rotateBtn = document.getElementById('ui-btn-rotate');
    if (rotateBtn) rotateBtn.textContent = I18N[currentLang].ROTATE;

    const deckLabel = document.querySelector('#ui-deck-pile .pile-label');
    if (deckLabel) deckLabel.textContent = I18N[currentLang].DECK;

    const discardLabel = document.querySelector('#ui-discard-pile .pile-label');
    if (discardLabel) discardLabel.textContent = I18N[currentLang].WASTED;
    
    const clashScoreEl = document.getElementById('ui-clash-score');
    if (clashScoreEl) {
      if (state.preview && !this.isAnimating) {
        clashScoreEl.innerHTML = `GAIN <span style="color: var(--orange-accent)">+${state.preview.scoreDelta}</span> / LOSS <span style="color: var(--red-accent)">-${state.preview.penalty}</span>`;
      } else if (state.preview && this.isAnimating) {
        clashScoreEl.innerHTML = `GAIN <span style="color: var(--orange-accent)">+${state.preview.scoreDelta}</span>`;
      } else {
        clashScoreEl.textContent = 'LANE CLASH';
      }
    }

    if (this.matrixWrapperElement) {
      this.matrixWrapperElement.className = `matrix-wrapper ${state.selectedCardIds.length > 0 && !this.isAnimating ? 'state-pick' : ''} ${state.preview && !this.isAnimating ? 'state-preview' : ''}`;
      if (this.previewBoxElement) this.previewBoxElement.className = `preview-box preview-${lastPreviewEdge?.toLowerCase() || ''}`;
    }

    if (this.matrixElement) {
      this.matrixElement.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      this.matrixElement.style.gridTemplateRows = `repeat(${size}, 1fr)`;
      const gridToRender = state.matrix.grid;
      
      const expectedChildCount = size * size;
      while (this.matrixElement.children.length > expectedChildCount) {
        this.matrixElement.lastElementChild?.remove();
      }
      while (this.matrixElement.children.length < expectedChildCount) {
        this.matrixElement.appendChild(document.createElement('img'));
      }

      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          const img = this.matrixElement.children[r * size + c] as HTMLImageElement;
          const expectedSrc = blockAsset(gridToRender[r][c]);
          if (!img.src.includes(expectedSrc)) {
            img.src = expectedSrc;
          }
          if (state.preview && state.preview.replacedCells.some((cell) => cell.r === r && cell.c === c)) {
            img.style.filter = 'drop-shadow(0 0 5px rgba(255, 152, 0, 0.4))';
          } else {
            img.style.filter = '';
          }
        }
      }
    }

    EDGE_ORDER.forEach(edge => {
      const dz = this.matrixWrapperElement?.querySelector(`.drop-zone-${edge.toLowerCase()}`) as HTMLElement;
      if (!dz) return;
    });

    if (this.previewBoxElement) {
      const { cellSize, gap, stride } = this.getCellMetrics(size);
      const matrixExtent = this.matrixElement?.offsetWidth ?? 0;
      this.previewBoxElement.style.display = state.preview ? 'block' : 'none';
      this.previewBoxElement.style.inset = '0';

      if (state.preview && lastPreviewEdge) {
        const selectedCard = state.hand.find((card) => card.id === state.selectedCardIds[state.selectedCardIds.length - 1]);
        if (selectedCard) {
          const overlapCount = selectedCard.symbols.length;
          
          let guide = this.previewBoxElement.querySelector('.preview-guide') as HTMLElement;
          if (!guide) {
            guide = document.createElement('div');
            guide.className = 'preview-guide';
            guide.style.position = 'absolute';
            this.previewBoxElement.appendChild(guide);
          }

          const orientation = lastPreviewEdge === 'TOP' || lastPreviewEdge === 'BOTTOM' ? 'horizontal' : 'vertical';
          let cardContainer = this.previewBoxElement.querySelector('.preview-card') as HTMLElement;
          if (!cardContainer) {
            cardContainer = createCardElement(selectedCard, 'preview-card', orientation);
            cardContainer.style.position = 'absolute';
            this.previewBoxElement.appendChild(cardContainer);
          } else {
            // Update orientation class
            if (orientation === 'horizontal') {
              cardContainer.classList.add('render-card-horizontal');
            } else {
              cardContainer.classList.remove('render-card-horizontal');
            }
            // Update full image or blocks
            const fullImage = cardContainer.querySelector('.card-full-image') as HTMLImageElement;
            if (fullImage) {
              const expectedSrc = getCardFullAsset(selectedCard);
              if (!fullImage.src.includes(expectedSrc)) {
                fullImage.src = expectedSrc;
              }
            } else {
              const blocks = Array.from(cardContainer.querySelectorAll('.card-block')) as HTMLImageElement[];
              selectedCard.symbols.forEach((symbol, i) => {
                const expectedSrc = blockAsset(symbol);
                if (blocks[i] && !blocks[i].src.includes(expectedSrc)) {
                  blocks[i].src = expectedSrc;
                }
              });
            }
          }

          if (lastPreviewEdge === 'TOP') {
            const guideLeft = state.preview.attachmentOffset * stride;
            guide.style.left = `${guideLeft}px`;
            guide.style.top = `${-stride}px`;
            guide.style.width = `${overlapCount * stride - gap}px`;
            guide.style.height = `${cellSize}px`;
            cardContainer.style.left = `${guideLeft}px`;
            cardContainer.style.top = `${-stride}px`;
          } else if (lastPreviewEdge === 'BOTTOM') {
            const guideLeft = state.preview.attachmentOffset * stride;
            guide.style.left = `${guideLeft}px`;
            guide.style.top = `${matrixExtent + gap}px`;
            guide.style.width = `${overlapCount * stride - gap}px`;
            guide.style.height = `${cellSize}px`;
            cardContainer.style.left = `${guideLeft}px`;
            cardContainer.style.top = `${matrixExtent + gap}px`;
          } else if (lastPreviewEdge === 'LEFT') {
            const guideTop = state.preview.attachmentOffset * stride;
            guide.style.left = `${-stride}px`;
            guide.style.top = `${guideTop}px`;
            guide.style.width = `${cellSize}px`;
            guide.style.height = `${overlapCount * stride - gap}px`;
            cardContainer.style.left = `${-stride}px`;
            cardContainer.style.top = `${guideTop}px`;
          } else {
            const guideTop = state.preview.attachmentOffset * stride;
            guide.style.left = `${matrixExtent + gap}px`;
            guide.style.top = `${guideTop}px`;
            guide.style.width = `${cellSize}px`;
            guide.style.height = `${overlapCount * stride - gap}px`;
            cardContainer.style.left = `${matrixExtent + gap}px`;
            cardContainer.style.top = `${guideTop}px`;
          }
        }
      }
    }

    this.renderHand(state);
    this.updateHeldPosition();
    this.renderStatusOverlay(state);
  }

  private renderHand(state: GameState): void {
    if (!this.handElement) return;
    const handElement = this.handElement;
    
    // Remove cards that are no longer in hand
    const currentCardIds = state.hand.map(c => c.id);
    Array.from(handElement.children).forEach(child => {
      const id = child.getAttribute('data-card-id');
      if (id && !currentCardIds.includes(id)) {
        child.remove();
      }
    });

    state.hand.forEach((card, index) => {
      let cardElement = handElement.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement;
      if (!cardElement) {
        cardElement = createCardElement(card, '', 'vertical', true);
        cardElement.setAttribute('data-card-id', card.id);
        cardElement.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.isAnimating) return;
          this.store.selectCard(card.id);
          this.render();
        });
        handElement.appendChild(cardElement);
      } else {
        // Update blocks if needed (e.g. if flipped)
        const fullImage = cardElement.querySelector('.card-full-image') as HTMLImageElement;
        if (fullImage) {
          const expectedSrc = getCardFullAsset(card);
          if (!fullImage.src.includes(expectedSrc)) {
            fullImage.src = expectedSrc;
          }
        } else {
          const blocks = Array.from(cardElement.querySelectorAll('.card-block')) as HTMLImageElement[];
          card.symbols.forEach((symbol, i) => {
            const expectedSrc = blockAsset(symbol);
            if (blocks[i] && !blocks[i].src.includes(expectedSrc)) {
              blocks[i].src = expectedSrc;
            }
          });
        }
      }

      const isSelected = state.selectedCardIds.includes(card.id);
      const isLastSelected = state.selectedCardIds[state.selectedCardIds.length - 1] === card.id;

      if (isSelected) {
        cardElement.classList.add('selected');
      } else {
        cardElement.classList.remove('selected');
      }

      const total = state.hand.length;
      const spread = 85;
      const angleStep = 4;
      const mid = (total - 1) / 2;
      const offset = index - mid;
      const fanX = offset * spread;
      const fanY = Math.abs(offset) * 5;
      const angle = offset * angleStep;

      if (!cardElement.classList.contains('held')) {
        gsap.to(cardElement, {
          rotation: angle,
          x: fanX,
          y: fanY,
          xPercent: -50,
          yPercent: 0,
          transformOrigin: '50% 50%',
          zIndex: isSelected ? (isLastSelected ? 1100 : 1000 + index) : index,
          duration: 0.4,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    });
  }
}
