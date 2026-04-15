import { SpecialCardDefinition } from './types';

export const interestEngineCard: SpecialCardDefinition = {
  id: 'interest-engine',
  name: 'Interest Engine',
  shortName: 'Engine',
  description: 'Passive: gain +3 extra interest after each cleared level.',
  rarity: 'uncommon',
  cost: 8,
  accent: '#76d6ff',
  modifyProjectedInterest: (projectedInterest) => projectedInterest + 3
};
