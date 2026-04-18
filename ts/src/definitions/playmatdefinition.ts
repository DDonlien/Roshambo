import { RPS } from '../types';
import { isEnabledByToggle, loadEffectToggles } from './effecttoggle';

export type LocalizedText = Partial<Record<'EN' | 'ZH' | 'ZH_TW' | 'JA', string>>;
export type PlaymatTiming = 'playing';

export type PlaymatEffectDefinition =
  | { type: 'transform_selected_to_symbol'; count: number; symbol: RPS }
  | { type: 'increase_selected_card_weight'; count: number; amount: number }
  | { type: 'destroy_selected_cards'; count: number }
  | { type: 'copy_right_card_to_left_card' };

export interface PlaymatDefinition {
  id: string;
  name: string;
  shortName: string;
  nameI18n?: LocalizedText;
  shortNameI18n?: LocalizedText;
  timing: PlaymatTiming;
  cost: number;
  accent: string;
  description: string;
  descriptionI18n?: LocalizedText;
  effect: PlaymatEffectDefinition;
}

export interface PlaymatDefinitionFile {
  version: number;
  inventoryLimit: number;
  playmats: PlaymatDefinition[];
}

const DEFAULT_PLAYMAT_DEFINITION: PlaymatDefinitionFile = {
  version: 1,
  inventoryLimit: 5,
  playmats: []
};

export async function loadPlaymatDefinitionFile(): Promise<PlaymatDefinitionFile> {
  try {
    const [response, toggles] = await Promise.all([
      fetch('/definition/playmatdefinition.json'),
      loadEffectToggles()
    ]);
    if (!response.ok) return DEFAULT_PLAYMAT_DEFINITION;
    const parsed = (await response.json()) as PlaymatDefinitionFile;
    if (!parsed || !Array.isArray(parsed.playmats)) return DEFAULT_PLAYMAT_DEFINITION;
    return {
      ...parsed,
      playmats: parsed.playmats.filter((playmat) => isEnabledByToggle(toggles, playmat.id, 'playmat'))
    };
  } catch {
    return DEFAULT_PLAYMAT_DEFINITION;
  }
}
