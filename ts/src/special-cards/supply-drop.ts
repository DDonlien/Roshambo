import { SpecialCardDefinition } from './types';

export const supplyDropCard: SpecialCardDefinition = {
  id: 'supply-drop',
  name: 'Supply Drop',
  shortName: 'Supply',
  description: 'Passive: start each level with +1 shuffle and +1 deal.',
  rarity: 'common',
  cost: 7,
  accent: '#ff8b8b',
  bonusDealsPerLevel: 1,
  bonusShufflesPerLevel: 1
};
