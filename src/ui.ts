import { GameStore, KNOWN_ASSETS } from './state';
import { Card, InsertEdge, RPS } from './types';

const EDGE_ORDER: readonly InsertEdge[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];

function blockAsset(symbol: RPS): string {
  const nameMap: Record<RPS, string> = {
    [RPS.ROCK]: 'Rock',
    [RPS.SCISSORS]: 'Scissors',
    [RPS.PAPER]: 'Paper',
    [RPS.BLANK]: 'Blank'
  };
  return `Sketch/BlockType=${nameMap[symbol]}.png`;
}


function cardAsset(card: Card): { src: string; rotate: boolean } {
  const map: Record<RPS, string> = {
    [RPS.BLANK]: '0',
    [RPS.PAPER]: '1',
    [RPS.SCISSORS]: '3',
    [RPS.ROCK]: '4'
  };
  const code = card.symbols.map((s) => map[s]).join('');
  
  if (KNOWN_ASSETS.includes(code)) {
    return { src: `Sketch/CardType=${code}.png`, rotate: false };
  }

  const flippedSymbols = [...card.symbols].reverse();
  const flippedCode = flippedSymbols.map((s) => map[s as RPS]).join('');
  
  if (KNOWN_ASSETS.includes(flippedCode)) {
    return { src: `Sketch/CardType=${flippedCode}.png`, rotate: true };
  }

  return { src: `Sketch/CardType=000.png`, rotate: false };
}

function iconAsset(symbol: RPS): string {
  if (symbol === RPS.ROCK) return 'Sketch/IconType=Rock.png';
  if (symbol === RPS.SCISSORS) return 'Sketch/IconType=Scissors.png';
  if (symbol === RPS.PAPER) return 'Sketch/IconType=Paper.png';
  return '';
}

export class GameUI {
  private matrixWrapperElement: HTMLElement | null = null;
  private matrixElement: HTMLElement | null = null;
  private previewBoxElement: HTMLElement | null = null;
  private handElement: HTMLElement | null = null;
  private heldCardElement: HTMLImageElement | null = null;

  constructor(private readonly store: GameStore, private readonly root: HTMLElement) {}

  mount(): void {
    this.initialRender();
  }

  private setupMouseFollow(): void {
    let isDragging = false;
    let dragStartTime = 0;

    window.addEventListener('mousemove', (e) => {
      if (this.heldCardElement) {
        this.heldCardElement.style.left = `${e.clientX}px`;
        this.heldCardElement.style.top = `${e.clientY}px`;
      }
      
      // Update preview based on element under cursor
      if (this.store.getState().selectedCardId) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const dropZone = elements.find(el => el.classList.contains('drop-zone'));
        const previewBox = elements.find(el => el.classList.contains('preview-box'));
        const currentEdge = (this.store as any).storeInternal?.lastPreviewEdge;
        
        if (dropZone) {
          const edge = dropZone.getAttribute('data-edge') as InsertEdge;
          if (currentEdge !== edge || !this.store.getState().preview) {
            this.store.updatePreview(edge);
            this.render();
          }
        } else if (previewBox && currentEdge) {
          // If we are inside the preview box, keep the current preview active
        } else {
          if (this.store.getState().preview) {
            this.store.updatePreview(null);
            this.render();
          }
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      const cardEl = (e.target as HTMLElement).closest('.card-asset:not(.held)');
      if (cardEl && cardEl.parentElement === this.handElement) {
        isDragging = true;
        dragStartTime = Date.now();
        // Set immediate position so it doesn't blink in a corner
        if (this.heldCardElement) {
          this.heldCardElement.style.left = `${e.clientX}px`;
          this.heldCardElement.style.top = `${e.clientY}px`;
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const dragDuration = Date.now() - dragStartTime;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const dropZone = elements.find(el => el.classList.contains('drop-zone'));
      const previewBox = elements.find(el => el.classList.contains('preview-box'));
      
      if (dropZone) {
        const edge = dropZone.getAttribute('data-edge') as InsertEdge;
        this.store.playSelectedToEdge(edge);
        this.render();
      } else if (previewBox) {
        const edge = (this.store as any).storeInternal?.lastPreviewEdge;
        if (edge) {
          this.store.playSelectedToEdge(edge);
          this.render();
        }
      } else if (dragDuration > 200) {
        // If it was a real drag (not a quick click) and we didn't drop on a valid zone, cancel the pick
        this.store.selectCard('');
        this.render();
      }
    });
  }

  private initialRender(): void {
    this.root.innerHTML = '';
    this.root.id = 'app'; // Ensure root has the right id for styling

    const app = this.root;

    // Left Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-title">Roshambo!</div>
      
      <div style="flex: 1"></div>

      <div class="score-box">
        <span class="label">SCORE</span>
        <span class="value" id="ui-score">0</span>
      </div>

      <div class="vs-panel">
        <div class="vs-result" id="ui-vs-result">?</div>
        <div class="vs-row">
          <div class="vs-block vs-blue">
            <span class="val" id="ui-vs-new-power">0</span>
            <img id="ui-vs-new-icon" src="" style="display:none;" />
          </div>
          <div class="vs-text">VS</div>
          <div class="vs-block vs-red">
            <img id="ui-vs-old-icon" src="" style="display:none;" />
            <span class="val" id="ui-vs-old-power">0</span>
          </div>
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

      <div style="flex: 1"></div>

      <div class="action-row">
        <button class="btn-end" id="ui-btn-end">END</button>
        <button class="btn-rotate" id="ui-btn-rotate" disabled>Rotate</button>
      </div>
    `;
    app.appendChild(sidebar);

    // Right Play Area
    const playArea = document.createElement('div');
    playArea.className = 'play-area';
    
    // Relics
    const relics = document.createElement('div');
    relics.className = 'relics-row';
    relics.innerHTML = '<div class="relic-slot"></div><div class="relic-slot"></div>';
    playArea.appendChild(relics);

    // Matrix Wrapper
    const matrixWrapper = document.createElement('div');
    matrixWrapper.className = 'matrix-wrapper';
    this.matrixWrapperElement = matrixWrapper;

    const matrix = document.createElement('div');
    matrix.className = 'matrix';
    this.matrixElement = matrix;
    matrixWrapper.appendChild(matrix);

    // Drop Zones
    EDGE_ORDER.forEach(edge => {
      const dz = document.createElement('div');
      dz.className = `drop-zone drop-zone-${edge.toLowerCase()}`;
      dz.setAttribute('data-edge', edge);
      
      dz.addEventListener('mouseenter', () => {
        this.store.updatePreview(edge);
        this.render();
      });
      dz.addEventListener('mouseleave', () => {
        this.store.updatePreview(null);
        this.render();
      });
      dz.addEventListener('click', () => {
        this.store.playSelectedToEdge(edge);
        this.render();
      });
      
      matrixWrapper.appendChild(dz);
    });

    // Preview Bounding Box
    const previewBox = document.createElement('div');
    previewBox.className = 'preview-box';
    previewBox.addEventListener('click', () => {
      const edge = (this.store as any).storeInternal?.lastPreviewEdge;
      if (edge) {
        this.store.playSelectedToEdge(edge);
        this.render();
      }
    });
    this.previewBoxElement = previewBox;
    matrixWrapper.appendChild(previewBox);

    playArea.appendChild(matrixWrapper);

    // Hand Row
    const handRow = document.createElement('div');
    handRow.className = 'hand-row';
    this.handElement = handRow;
    playArea.appendChild(handRow);

    app.appendChild(playArea);

    // Held Card
    const heldCard = document.createElement('img');
    heldCard.className = 'card-asset held hidden';
    this.heldCardElement = heldCard;
    app.appendChild(heldCard);

    // Removed this.root.appendChild(app) since app IS this.root

    // Event Listeners
    app.querySelector('#ui-btn-rotate')?.addEventListener('click', () => {
      this.store.flipSelectedCard();
      this.render();
    });

    app.querySelector('#ui-btn-end')?.addEventListener('click', () => {
      this.store.resetGame();
      this.render();
    });

    app.querySelector('#ui-btn-shuffle')?.addEventListener('click', () => {
      const state = this.store.getState();
      if (state.shufflesLeft > 0 && state.status === 'PLAYING') {
        this.store.shuffleMatrix();
        this.render();
      }
    });

    app.querySelector('#ui-btn-deal')?.addEventListener('click', () => {
      const state = this.store.getState();
      if (state.dealsLeft > 0 && state.status === 'PLAYING') {
        this.store.dealHand();
        this.render();
      }
    });

    playArea.addEventListener('click', (e) => {
      if (e.target === playArea || e.target === handRow) {
        if (this.store.getState().selectedCardId) {
          this.store.selectCard('');
          this.render();
        }
      }
    });

    this.setupMouseFollow();
    window.addEventListener('resize', () => this.render());
    this.render();
  }

  private isPushedOut(r: number, c: number, edge: InsertEdge | null): boolean {
    if (!edge) return false;
    if (edge === 'TOP') return r === 2;
    if (edge === 'BOTTOM') return r === 0;
    if (edge === 'LEFT') return c === 2;
    if (edge === 'RIGHT') return c === 0;
    return false;
  }

  private render(): void {
    const state = this.store.getState();
    const lastPreviewEdge = (this.store as any).storeInternal?.lastPreviewEdge as InsertEdge | null;
    const selectedCard = state.selectedCardId ? state.hand.find(c => c.id === state.selectedCardId) : null;

    // Sidebar Update
    const scoreEl = document.getElementById('ui-score');
    if (scoreEl) {
      const currentScoreStr = scoreEl.textContent;
      const newScoreStr = state.currentScore.toString();
      if (currentScoreStr !== newScoreStr && currentScoreStr !== '0') {
        scoreEl.classList.remove('score-animate');
        // trigger reflow
        void scoreEl.offsetWidth;
        scoreEl.classList.add('score-animate');
      }
      scoreEl.textContent = newScoreStr;
    }

    const shuffleBtn = document.getElementById('ui-btn-shuffle');
    if (shuffleBtn) {
      const val = shuffleBtn.querySelector('.val');
      if (val) val.textContent = state.shufflesLeft.toString();
      if (state.shufflesLeft <= 0 || state.status !== 'PLAYING') {
        shuffleBtn.classList.add('disabled');
      } else {
        shuffleBtn.classList.remove('disabled');
      }
    }

    const dealBtn = document.getElementById('ui-btn-deal');
    if (dealBtn) {
      const val = dealBtn.querySelector('.val');
      if (val) val.textContent = state.dealsLeft.toString();
      if (state.dealsLeft <= 0 || state.status !== 'PLAYING') {
        dealBtn.classList.add('disabled');
      } else {
        dealBtn.classList.remove('disabled');
      }
    }

    const rotateBtn = document.getElementById('ui-btn-rotate') as HTMLButtonElement;
    if (rotateBtn) rotateBtn.disabled = !state.selectedCardId;

    const vsResult = document.getElementById('ui-vs-result');
    const newPower = document.getElementById('ui-vs-new-power');
    const newIcon = document.getElementById('ui-vs-new-icon') as HTMLImageElement;
    const oldPower = document.getElementById('ui-vs-old-power');
    const oldIcon = document.getElementById('ui-vs-old-icon') as HTMLImageElement;

    if (oldPower && oldIcon) {
      oldPower.textContent = state.matrix.theme.power.toString();
      if (state.matrix.theme.element !== RPS.BLANK) {
        oldIcon.src = iconAsset(state.matrix.theme.element);
        oldIcon.style.display = 'block';
      } else {
        oldIcon.style.display = 'none';
      }
    }

    if (state.preview) {
      if (vsResult) {
        const result = state.preview.result;
        if (result === 'WIN') {
          vsResult.innerHTML = `WIN = <span style="color: var(--orange-accent)">${state.preview.scoreDelta} Points</span>`;
          vsResult.className = `vs-result win`;
        } else if (result === 'LOSE') {
          vsResult.innerHTML = `LOSE = <span style="color: var(--red-accent)">Lose Card</span>`;
          vsResult.className = `vs-result lose`;
        } else {
          vsResult.innerHTML = `DUAL = Get Card`;
          vsResult.className = `vs-result dual`;
        }
      }
      if (newPower && newIcon) {
        newPower.textContent = state.preview.newTheme.power.toString();
        if (state.preview.newTheme.element !== RPS.BLANK) {
          newIcon.src = iconAsset(state.preview.newTheme.element);
          newIcon.style.display = 'block';
        } else {
          newIcon.style.display = 'none';
        }
      }
    } else {
      if (vsResult) {
        vsResult.textContent = '?';
        vsResult.className = 'vs-result';
      }
      if (newPower && newIcon) {
        newPower.textContent = '?';
        newIcon.style.display = 'none';
      }
    }

    // Right Area Update
    if (this.matrixWrapperElement) {
      this.matrixWrapperElement.className = 'matrix-wrapper';
      if (state.selectedCardId) {
        this.matrixWrapperElement.classList.add('state-pick');
      }
      if (state.preview && lastPreviewEdge) {
        this.matrixWrapperElement.classList.add('state-preview');
        if (this.previewBoxElement) {
          this.previewBoxElement.className = `preview-box preview-${lastPreviewEdge.toLowerCase()}`;
        }
      }
    }

    // Matrix
    if (this.matrixElement) {
      this.matrixElement.innerHTML = '';
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const img = document.createElement('img');
          img.src = blockAsset(state.matrix.grid[r][c]);
          if (state.preview && lastPreviewEdge && this.isPushedOut(r, c, lastPreviewEdge)) {
            img.classList.add('pushed-out');
          }
          this.matrixElement.appendChild(img);
        }
      }
    }

    // Drop Zones
    EDGE_ORDER.forEach(edge => {
      const dz = this.matrixWrapperElement?.querySelector(`.drop-zone-${edge.toLowerCase()}`) as HTMLElement;
      if (!dz) return;
      
      dz.innerHTML = '';
      if (state.preview && lastPreviewEdge === edge && selectedCard) {
        // Render the attached card inside the drop zone
        const asset = cardAsset(selectedCard);
        
        const cardContainer = document.createElement('div');
        selectedCard.symbols.forEach(symbol => {
          const img = document.createElement('img');
          img.src = blockAsset(symbol);
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'contain';
          cardContainer.appendChild(img);
        });
        
        cardContainer.setAttribute('data-flipped', asset.rotate ? 'true' : 'false');
        dz.appendChild(cardContainer);

        dz.style.borderStyle = 'solid';
        dz.style.borderColor = 'transparent';
        dz.style.background = 'transparent';
      } else {
        dz.style.borderStyle = '';
        dz.style.borderColor = '';
        dz.style.background = '';
      }
    });

    // Held Card
    if (this.heldCardElement) {
      if (state.selectedCardId && !state.preview) {
        this.heldCardElement.classList.remove('hidden');
        const asset = cardAsset(selectedCard!);
        this.heldCardElement.src = asset.src;
        // Keep it visible and slightly tilted when held
        this.heldCardElement.style.transform = `translate(-50%, -50%) rotate(${asset.rotate ? 175 : -5}deg)`;
      } else {
        this.heldCardElement.classList.add('hidden');
      }
    }

    // Hand
    if (this.handElement) {
      this.handElement.innerHTML = '';
      const cardCount = state.hand.length;
      state.hand.forEach((card, index) => {
        const img = document.createElement('img');
        img.className = `card-asset ${state.selectedCardId === card.id ? 'hidden' : ''}`;
        const asset = cardAsset(card);
        img.src = asset.src;
        
        const angleStep = 6;
        const startAngle = -((cardCount - 1) * angleStep) / 2;
        const angle = startAngle + index * angleStep;
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const vmin = Math.min(vh, vw);
        
        const x = Math.sin(angle * Math.PI / 180) * (vmin * 0.08);
        const y = (1 - Math.cos(angle * Math.PI / 180)) * (vmin * 0.02);
        
        const transformStr = `rotate(${angle}deg) translate(${x}px, ${y}px) ${asset.rotate ? 'rotate(180deg) translateY(100%)' : ''}`;
        img.style.transform = transformStr;
        img.style.zIndex = `${index}`;

        img.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          this.store.selectCard(card.id);
          this.render();
        });

        this.handElement!.appendChild(img);
      });
    }

    // Game Over
    let overlay = this.root.querySelector('.modal-overlay');
    if (state.status === 'GAME_OVER') {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
          <div class="modal-content" style="background:#2F3F45; padding:40px; border-radius:12px; text-align:center;">
            <h1>Game Over</h1>
            <p id="final-score-text" style="font-size:1.5rem; margin:20px 0; color:#FFC107;"></p>
            <button id="restart-btn" style="padding:15px 30px; font-size:1.2rem; background:#F44336; color:white; border:none; border-radius:8px; cursor:pointer;">Try Again</button>
          </div>
        `;
        this.root.appendChild(overlay);
        overlay.querySelector('#restart-btn')?.addEventListener('click', () => {
          this.store.resetGame();
          this.render();
        });
      }
      const scoreText = overlay.querySelector('#final-score-text');
      if (scoreText) scoreText.textContent = `Final Score: ${state.currentScore}`;
    } else if (overlay) {
      overlay.remove();
    }
  }
}
