import { ShopOffer, SpecialCardInstance } from '../types';
import { chipCacheCard } from './chip-cache';
import { interestEngineCard } from './interest-engine';
import { supplyDropCard } from './supply-drop';
import { SpecialCardDefinition, SpecialCardView, ShopViewOffer } from './types';

const SPECIAL_CARD_REGISTRY: Record<string, SpecialCardDefinition> = {
  [chipCacheCard.id]: chipCacheCard,
  [interestEngineCard.id]: interestEngineCard,
  [supplyDropCard.id]: supplyDropCard
};

export function listSpecialCardDefinitions(): SpecialCardDefinition[] {
  return Object.values(SPECIAL_CARD_REGISTRY);
}

export function getSpecialCardDefinition(definitionId: string): SpecialCardDefinition {
  return SPECIAL_CARD_REGISTRY[definitionId];
}

export function toSpecialCardViews(cards: SpecialCardInstance[]): SpecialCardView[] {
  return cards
    .map((card) => {
      const definition = SPECIAL_CARD_REGISTRY[card.definitionId];
      return definition ? { ...card, definition } : null;
    })
    .filter((card): card is SpecialCardView => card !== null);
}

export function toShopViewOffers(offers: ShopOffer[]): ShopViewOffer[] {
  return offers
    .map((offer) => {
      const definition = SPECIAL_CARD_REGISTRY[offer.definitionId];
      return definition ? { ...offer, definition } : null;
    })
    .filter((offer): offer is ShopViewOffer => offer !== null);
}

export function drawShopDefinitions(excludedDefinitionIds: string[], count: number): SpecialCardDefinition[] {
  const candidates = listSpecialCardDefinitions().filter(
    (definition) => !excludedDefinitionIds.includes(definition.id)
  );
  const shuffled = [...candidates];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}
