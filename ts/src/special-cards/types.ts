import { ShopOffer, SpecialCardInstance } from '../types';

export type SpecialCardRarity = 'common' | 'uncommon' | 'rare';

export interface SpecialCardEffectContext {
  chips: number;
  projectedInterest: number;
  dealsLeft: number;
  shufflesLeft: number;
}

export interface SpecialCardAcquireResult {
  chipsDelta?: number;
  projectedInterestDelta?: number;
  dealsDelta?: number;
  shufflesDelta?: number;
}

export interface SpecialCardDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  rarity: SpecialCardRarity;
  cost: number;
  accent: string;
  bonusDealsPerLevel?: number;
  bonusShufflesPerLevel?: number;
  applyOnAcquire?: (context: SpecialCardEffectContext) => SpecialCardAcquireResult;
  modifyProjectedInterest?: (projectedInterest: number) => number;
}

export interface ShopViewOffer extends ShopOffer {
  definition: SpecialCardDefinition;
}

export interface SpecialCardView extends SpecialCardInstance {
  definition: SpecialCardDefinition;
}
