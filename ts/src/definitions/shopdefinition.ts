export interface WeightedChoiceMap {
  [key: string]: number;
}

export interface CardPricingRules {
  base: number;
  rock: number;
  scissors: number;
  paper: number;
  blank: number;
  tricolor: number;
  duplicateDiscount: number;
  diversityBonus: number;
  tricolorMixBonus: number;
}

export interface ShopDefinitionFile {
  version: number;
  offerSlotCount: number;
  offerFormWeights: WeightedChoiceMap;
  directTypeWeights: WeightedChoiceMap;
  packTypeWeights: WeightedChoiceMap;
  packChoiceCountWeights: WeightedChoiceMap;
  packCostMultiplier: number;
  cardPricing: CardPricingRules;
}

const DEFAULT_SHOP_DEFINITION: ShopDefinitionFile = {
  version: 1,
  offerSlotCount: 3,
  offerFormWeights: {
    direct: 70,
    pack: 30
  },
  directTypeWeights: {
    sleeve: 25,
    giftcard: 15,
    playmat: 15,
    card: 45
  },
  packTypeWeights: {
    sleeve: 20,
    giftcard: 15,
    playmat: 25,
    card: 40
  },
  packChoiceCountWeights: {
    '2': 65,
    '3': 35
  },
  packCostMultiplier: 1.6,
  cardPricing: {
    base: 2,
    rock: 2,
    scissors: 2,
    paper: 1,
    blank: 0,
    tricolor: 4,
    duplicateDiscount: 1,
    diversityBonus: 1,
    tricolorMixBonus: 2
  }
};

export async function loadShopDefinitionFile(): Promise<ShopDefinitionFile> {
  try {
    const response = await fetch('/definition/shopdefinition.json');
    if (!response.ok) return DEFAULT_SHOP_DEFINITION;
    const parsed = (await response.json()) as ShopDefinitionFile;
    if (!parsed || typeof parsed.offerSlotCount !== 'number') return DEFAULT_SHOP_DEFINITION;
    return parsed;
  } catch {
    return DEFAULT_SHOP_DEFINITION;
  }
}
