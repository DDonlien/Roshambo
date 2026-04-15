export type SleeveRarity = 'common' | 'uncommon' | 'rare';

export type SleeveEffectType = 'none';

export interface SleeveEffectDefinition {
  type: SleeveEffectType;
}

export interface SleeveDefinition {
  id: string;
  name: string;
  slotCost: number;
  rarity: SleeveRarity;
  description: string;
  effectRef: string;
}

export interface SleeveDefinitionFile {
  version: number;
  slotLimit: number;
  sleeves: SleeveDefinition[];
  effects: Record<string, SleeveEffectDefinition>;
}

const DEFAULT_SLEEVE_DEFINITION: SleeveDefinitionFile = {
  version: 1,
  slotLimit: 2,
  sleeves: [
    {
      id: 'sleeve:starter',
      name: 'Starter Sleeve',
      slotCost: 1,
      rarity: 'common',
      description: 'Placeholder sleeve. No effect yet.',
      effectRef: 'effect:none'
    }
  ],
  effects: {
    'effect:none': { type: 'none' }
  }
};

export async function loadSleeveDefinitionFile(): Promise<SleeveDefinitionFile> {
  try {
    const response = await fetch('/definition/sleevedefinition.json');
    if (!response.ok) return DEFAULT_SLEEVE_DEFINITION;
    const parsed = (await response.json()) as SleeveDefinitionFile;
    if (!parsed || !Array.isArray(parsed.sleeves)) return DEFAULT_SLEEVE_DEFINITION;
    return parsed;
  } catch {
    return DEFAULT_SLEEVE_DEFINITION;
  }
}

export function getSleeveEffect(defs: SleeveDefinitionFile, effectRef: string): SleeveEffectDefinition {
  return defs.effects[effectRef] ?? { type: 'none' };
}
