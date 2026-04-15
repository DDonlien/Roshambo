import { SpecialCardDefinition } from './types';

export const chipCacheCard: SpecialCardDefinition = {
  id: 'chip-cache',
  name: 'Chip Cache',
  shortName: 'Cache',
  description: 'Acquire: gain 8 chips immediately.',
  rarity: 'common',
  cost: 6,
  accent: '#f6c453',
  applyOnAcquire: () => ({
    chipsDelta: 8
  })
};
