import { GameStore } from './state';
import { GameUI } from './ui';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Root element #app not found.');
}

void (async () => {
  const store = new GameStore();
  await store.initialize();
  const ui = new GameUI(store, root);
  ui.mount();
})();
