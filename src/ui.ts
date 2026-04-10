import { GameStore } from './state';
import { CARD_LENGTH, Card, GameState, InsertEdge, LevelIcon, RPS } from './types';
import { gsap } from 'gsap';

const EDGE_ORDER: readonly InsertEdge[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];

const SCORE_WEIGHTS: Record<RPS, number> = {
  [RPS.ROCK]: 4,
  [RPS.SCISSORS]: 3,
  [RPS.PAPER]: 1,
  [RPS.BLANK]: 0
};

function blockAsset(symbol: RPS): string {
  const nameMap: Record<RPS, string> = {
    [RPS.ROCK]: 'Rock',
    [RPS.SCISSORS]: 'Scissors',
    [RPS.PAPER]: 'Paper',
    [RPS.BLANK]: 'Blank'
  };
  return `Sketch/BlockType=${nameMap[symbol]}.png`;
}

function iconAsset(icon: LevelIcon): string {
  return `Sketch/IconType=${icon}.png`;
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
  card.symbols.forEach((symbol) => {
    const image = document.createElement('img');
    image.className = 'card-block';
    image.src = blockAsset(symbol);
    element.appendChild(image);
  });
  return element;
}

function createCardMarkup(card: Card): string {
  return `
    <div class="render-card modal-card" style="--card-block-count:${card.symbols.length}">
      ${card.symbols.map((symbol) => `<img class="card-block" src="${blockAsset(symbol)}">`).join('')}
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

  private isInLeftReturnZone(): boolean {
    if (!this.handElement) {
      return false;
    }

    const handRect = this.handElement.getBoundingClientRect();
    return this.mouseX < handRect.left - 40
      && this.mouseY >= handRect.top - 60
      && this.mouseY <= handRect.bottom + 60;
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
      <div class="sidebar-title">Roshambo!</div>
      <div class="stage-box">
        <img id="ui-level-icon" class="stage-icon" src="${iconAsset('Paper')}" alt="stage">
        <div class="stage-copy">
          <span class="stage-label">STAGE</span>
          <span class="stage-name" id="ui-level-name">Pocket</span>
        </div>
      </div>
      <div class="score-box">
        <span class="label">LEVEL</span>
        <span class="value" id="ui-level">1/3</span>
      </div>
      <div class="score-box">
        <span class="label">GOAL</span>
        <span class="value" id="ui-goal">100</span>
      </div>
      <div class="score-box">
        <span class="label">SCORE</span>
        <span class="value" id="ui-score">0</span>
      </div>
      <div class="score-box chips-box" id="ui-chips-box">
        <span class="label chips-label">CHIPS</span>
        <div class="chips-value-wrap">
          <span class="value chips-value" id="ui-chips">10</span>
          <span class="interest-preview" id="ui-interest-preview">+2</span>
        </div>
      </div>
      <div class="deck-actions">
        <div class="deck-btn" id="ui-btn-shuffle">
          <span class="label">SHUFFLE</span>
          <div class="val-box"><span class="val blue" id="ui-shuffle-count">4</span></div>
        </div>
        <div class="deck-btn" id="ui-btn-deal">
          <span class="label">DEAL</span>
          <div class="val-box"><span class="val red" id="ui-deal-count">4</span></div>
        </div>
      </div>
      <div class="vs-panel" style="padding: 10px;">
        <div class="vs-result" id="ui-clash-score" style="font-size: 1.2rem; color: var(--orange-accent); text-align: center;">
          LANE CLASH
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
    const dz = this.matrixWrapperElement?.querySelector(`.drop-zone-${edge.toLowerCase()}`) as HTMLElement;
    const dzBlocks = dz ? Array.from(dz.querySelectorAll('.card-block')) as HTMLElement[] : [];
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
        const firstCell = this.matrixElement?.children[firstCellIdx] as HTMLElement;
        if (firstCell) {
          const startRect = attackerBlock.getBoundingClientRect();
          const endRect = firstCell.getBoundingClientRect();
          const localDx = endRect.left - startRect.left;
          const localDy = endRect.top - startRect.top;
          await gsap.to(attackerBlock, { x: localDx, y: localDy, duration: 0.4, ease: 'back.inOut(2)' });
        }
      } else if (attackerBlock) {
        gsap.to(attackerBlock, { scale: 0, opacity: 0, rotation: (Math.random() - 0.5) * 180, duration: 0.4, ease: 'power2.in' });
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      for (let step = 0; step < size; step += 1) {
        const index = laneIndices[step];
        const cellPos = { r: Math.floor(index / size), c: index % size };
        if (!result.replacedCells.some((cell) => cell.r === cellPos.r && cell.c === cellPos.c)) break;

        const img = this.matrixElement?.children[index] as HTMLImageElement;
        const defenderSymbol = state.matrix.grid[cellPos.r][cellPos.c];
        const gain = SCORE_WEIGHTS[defenderSymbol];

        if (img) {
          const smash = 60; let sx = 0, sy = 0;
          if (edge === 'TOP') sy = -smash; else if (edge === 'BOTTOM') sy = smash;
          else if (edge === 'LEFT') sx = -smash; else if (edge === 'RIGHT') sx = smash;

          img.src = blockAsset(result.newGrid[cellPos.r][cellPos.c]);
          gsap.fromTo(img,
            { x: sx, y: sy, scale: 2.2, zIndex: 100, filter: 'brightness(3) contrast(1.2) drop-shadow(0 0 30px rgba(255,160,0,1))' },
            { x: 0, y: 0, scale: 1, zIndex: 1, filter: 'brightness(1) contrast(1) drop-shadow(0 0 0px rgba(0,0,0,0))', duration: 0.4, ease: 'back.out(2.5)' }
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
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    this.store.applyClashResult(result);
    this.isAnimating = false;
    this.render();
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

    const handRect = this.handElement.getBoundingClientRect();
    const isInsideReturnZone =
      this.mouseX >= handRect.left &&
      this.mouseX <= handRect.right &&
      this.mouseY >= handRect.top - 24 &&
      this.mouseY <= handRect.bottom + 24;
    const shouldReturnToHand = isInsideReturnZone || this.isInLeftReturnZone();

    if (shouldReturnToHand) {
      if (state.preview) {
        this.store.updatePreview(null);
      }
      if (cardElement.classList.contains('held') || state.preview) {
        cardElement.classList.remove('held');
        cardElement.style.left = '';
        cardElement.style.top = '';
        gsap.set(cardElement, { clearProps: 'all' });
        this.render();
      }
      return;
    }

    if (!cardElement.classList.contains('held')) {
      cardElement.classList.add('held');
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
      pointerEvents: state.preview ? 'none' : 'auto'
    });
  }

  private showPileModal(type: 'DECK' | 'DISCARD'): void {
    const state = this.store.getState();
    const cards = type === 'DECK' ? state.deck : state.discardPile;
    const title = type === 'DECK' ? 'Deck' : 'Wasted Cards';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay pile-overlay';
    overlay.innerHTML = `
      <div class="modal-content pile-view">
        <div class="modal-header"><h2>${title} (${cards.length})</h2><button class="close-btn">&times;</button></div>
        <div class="pile-grid">
          ${cards.map((card) => `<div class="pile-card-item">${createCardMarkup(card)}</div>`).join('')}
          ${cards.length === 0 ? '<p style="color:#888; grid-column: 1/-1;">No cards here yet.</p>' : ''}
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
          <h1>Choose Your Deck</h1>
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
          <h1 class="status-title success">LEVEL COMPLETE!</h1>
          <p class="status-copy">Interest: CHIPS +${state.lastInterestEarned}</p>
          <button id="next-btn" class="status-button success">NEXT LEVEL</button>
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
          <h1 class="status-title gold">CONGRATULATIONS!</h1>
          <p class="status-copy">You conquered all 3 levels!</p>
          <p class="status-copy">Final Chips: ${state.chips}</p>
          <button id="restart-btn" class="status-button primary">New Game</button>
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
        <h1 class="status-title">Game Over</h1>
        <p class="status-copy">Final Score: ${state.currentScore}</p>
        <button id="restart-btn" class="status-button danger">Try Again</button>
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

    const levelEl = document.getElementById('ui-level'); if (levelEl) levelEl.textContent = `${state.currentLevel}/3`;
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
      this.matrixWrapperElement.className = `matrix-wrapper ${state.selectedCardIds.length > 0 ? 'state-pick' : ''} ${state.preview ? 'state-preview' : ''}`;
      if (this.previewBoxElement) this.previewBoxElement.className = `preview-box preview-${lastPreviewEdge?.toLowerCase() || ''}`;
    }

    if (this.matrixElement) {
      this.matrixElement.innerHTML = '';
      this.matrixElement.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      this.matrixElement.style.gridTemplateRows = `repeat(${size}, 1fr)`;
      const gridToRender = state.matrix.grid;
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          const img = document.createElement('img');
          img.src = blockAsset(gridToRender[r][c]);
          if (state.preview && state.preview.replacedCells.some((cell) => cell.r === r && cell.c === c)) {
            img.style.filter = 'drop-shadow(0 0 5px rgba(255, 152, 0, 0.4))';
          }
          this.matrixElement.appendChild(img);
        }
      }
    }

    EDGE_ORDER.forEach(edge => {
      const dz = this.matrixWrapperElement?.querySelector(`.drop-zone-${edge.toLowerCase()}`) as HTMLElement;
      if (!dz) return;
      dz.innerHTML = '';
    });

    if (this.previewBoxElement) {
      const { cellSize, gap, stride } = this.getCellMetrics(size);
      const matrixExtent = this.matrixElement?.offsetWidth ?? 0;
      this.previewBoxElement.innerHTML = '';
      this.previewBoxElement.style.display = state.preview ? 'block' : 'none';
      this.previewBoxElement.style.inset = '0';

      if (state.preview && lastPreviewEdge) {
        const selectedCard = state.hand.find((card) => card.id === state.selectedCardIds[state.selectedCardIds.length - 1]);
        if (selectedCard) {
          const overlapCount = selectedCard.symbols.length;
          const guide = document.createElement('div');
          guide.className = 'preview-guide';
          guide.style.position = 'absolute';

          const cardContainer = createCardElement(
            selectedCard,
            'preview-card',
            lastPreviewEdge === 'TOP' || lastPreviewEdge === 'BOTTOM' ? 'horizontal' : 'vertical'
          );
          cardContainer.style.position = 'absolute';

          if (lastPreviewEdge === 'TOP') {
            const guideLeft = Math.max(0, state.preview.attachmentOffset) * stride;
            guide.style.left = `${guideLeft}px`;
            guide.style.top = `${-stride}px`;
            guide.style.width = `${overlapCount * stride - gap}px`;
            guide.style.height = `${cellSize}px`;
            cardContainer.style.left = `${state.preview.attachmentOffset * stride}px`;
            cardContainer.style.top = `${-stride}px`;
          } else if (lastPreviewEdge === 'BOTTOM') {
            const guideLeft = Math.max(0, state.preview.attachmentOffset) * stride;
            guide.style.left = `${guideLeft}px`;
            guide.style.top = `${matrixExtent + gap}px`;
            guide.style.width = `${overlapCount * stride - gap}px`;
            guide.style.height = `${cellSize}px`;
            cardContainer.style.left = `${state.preview.attachmentOffset * stride}px`;
            cardContainer.style.top = `${matrixExtent + gap}px`;
          } else if (lastPreviewEdge === 'LEFT') {
            const guideTop = Math.max(0, state.preview.attachmentOffset) * stride;
            guide.style.left = `${-stride}px`;
            guide.style.top = `${guideTop}px`;
            guide.style.width = `${cellSize}px`;
            guide.style.height = `${overlapCount * stride - gap}px`;
            cardContainer.style.left = `${-stride}px`;
            cardContainer.style.top = `${state.preview.attachmentOffset * stride}px`;
          } else {
            const guideTop = Math.max(0, state.preview.attachmentOffset) * stride;
            guide.style.left = `${matrixExtent + gap}px`;
            guide.style.top = `${guideTop}px`;
            guide.style.width = `${cellSize}px`;
            guide.style.height = `${overlapCount * stride - gap}px`;
            cardContainer.style.left = `${matrixExtent + gap}px`;
            cardContainer.style.top = `${state.preview.attachmentOffset * stride}px`;
          }

          this.previewBoxElement.appendChild(guide);
          this.previewBoxElement.appendChild(cardContainer);
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
    handElement.innerHTML = '';

    state.hand.forEach((card, index) => {
      const cardElement = createCardElement(card, '', 'vertical', true);
      cardElement.setAttribute('data-card-id', card.id);
      cardElement.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isAnimating) return;
        this.store.selectCard(card.id);
        this.render();
      });

      const isSelected = state.selectedCardIds.includes(card.id);
      const isLastSelected = state.selectedCardIds[state.selectedCardIds.length - 1] === card.id;

      if (isSelected) cardElement.classList.add('selected');

      handElement.appendChild(cardElement);

      const total = state.hand.length;
      const spread = 85;
      const angleStep = 4;
      const mid = (total - 1) / 2;
      const offset = index - mid;
      const fanX = offset * spread;
      const fanY = Math.abs(offset) * 5;
      const angle = offset * angleStep;

      gsap.to(cardElement, {
          rotation: angle,
          x: fanX,
          y: fanY,
          xPercent: -50,
          yPercent: 0,
          transformOrigin: '50% 50%',
          zIndex: isSelected ? (isLastSelected ? 1100 : 1000 + index) : index,
          duration: 0.4,
          ease: 'power2.out'
        });
    });
  }
}
