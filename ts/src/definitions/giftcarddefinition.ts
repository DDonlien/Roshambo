import { isEnabledByToggle, loadEffectToggles } from './effecttoggle';

export type GiftCardTiming = 'prepare_level';
export type LocalizedText = Partial<Record<'EN' | 'ZH' | 'ZH_TW' | 'JA', string>>;

export type GiftCardEffectDefinition =
  | { type: 'copy_last_used' }
  | { type: 'spawn_random_giftcards'; count: number }
  | { type: 'spawn_random_playmats'; count: number }
  | { type: 'double_money_cap'; cap: number }
  | { type: 'add_random_sleeve'; count: number };

export interface GiftCardDefinition {
  id: string;
  name: string;
  shortName: string;
  nameI18n?: LocalizedText;
  shortNameI18n?: LocalizedText;
  timing: GiftCardTiming;
  cost: number;
  accent: string;
  description: string;
  descriptionI18n?: LocalizedText;
  effect: GiftCardEffectDefinition;
}

export interface GiftCardDefinitionFile {
  version: number;
  inventoryLimit: number;
  giftcards: GiftCardDefinition[];
}

const DEFAULT_GIFTCARD_DEFINITION: GiftCardDefinitionFile = {
  version: 1,
  inventoryLimit: 5,
  giftcards: []
};

export async function loadGiftCardDefinitionFile(): Promise<GiftCardDefinitionFile> {
  try {
    const [response, toggles] = await Promise.all([
      fetch('/definition/giftcarddefinition.json'),
      loadEffectToggles()
    ]);
    if (!response.ok) return DEFAULT_GIFTCARD_DEFINITION;
    const parsed = (await response.json()) as GiftCardDefinitionFile;
    if (!parsed || !Array.isArray(parsed.giftcards)) return DEFAULT_GIFTCARD_DEFINITION;
    return {
      ...parsed,
      giftcards: parsed.giftcards.filter((giftcard) => isEnabledByToggle(toggles, giftcard.id, 'giftcard'))
    };
  } catch {
    return DEFAULT_GIFTCARD_DEFINITION;
  }
}
