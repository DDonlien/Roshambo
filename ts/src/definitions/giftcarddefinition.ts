export type GiftCardTiming = 'immediate' | 'next_round';

export type GiftCardEffectType = 'chips_delta' | 'interest_rate_delta';

export interface GiftCardEffectDefinition {
  type: GiftCardEffectType;
  value: number;
}

export interface GiftCardDefinition {
  id: string;
  name: string;
  timing: GiftCardTiming;
  description: string;
  effectRef: string;
}

export interface GiftCardDefinitionFile {
  version: number;
  giftcards: GiftCardDefinition[];
  effects: Record<string, GiftCardEffectDefinition>;
}

const DEFAULT_GIFTCARD_DEFINITION: GiftCardDefinitionFile = {
  version: 1,
  giftcards: [
    {
      id: 'gift:chips-boost',
      name: 'Chip Boost',
      timing: 'immediate',
      description: 'Placeholder gift card. Grants chips immediately.',
      effectRef: 'effect:chips+5'
    }
  ],
  effects: {
    'effect:chips+5': { type: 'chips_delta', value: 5 }
  }
};

export async function loadGiftCardDefinitionFile(): Promise<GiftCardDefinitionFile> {
  try {
    const response = await fetch('/definition/giftcarddefinition.json');
    if (!response.ok) return DEFAULT_GIFTCARD_DEFINITION;
    const parsed = (await response.json()) as GiftCardDefinitionFile;
    if (!parsed || !Array.isArray(parsed.giftcards)) return DEFAULT_GIFTCARD_DEFINITION;
    return parsed;
  } catch {
    return DEFAULT_GIFTCARD_DEFINITION;
  }
}

export function getGiftCardEffect(defs: GiftCardDefinitionFile, effectRef: string): GiftCardEffectDefinition | null {
  return defs.effects[effectRef] ?? null;
}

export interface GiftCardApplyContext {
  chips: number;
  interestRate: number;
}

export interface GiftCardApplyResult {
  chipsDelta?: number;
  interestRateDelta?: number;
}

export function applyGiftCardEffect(effect: GiftCardEffectDefinition, _context: GiftCardApplyContext): GiftCardApplyResult {
  if (effect.type === 'chips_delta') {
    return { chipsDelta: effect.value };
  }
  return { interestRateDelta: effect.value };
}
