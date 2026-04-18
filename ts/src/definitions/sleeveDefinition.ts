import { Card, ClashResult, RPS } from '../types';
import { isEnabledByToggle, loadEffectToggles } from './effecttoggle';
import {
  countCapturesByAttacker,
  isFlush,
  isFourOfAKind,
  isPair,
  isStraight,
  isThreeOfAKind
} from './shared-effects';

export type SleeveRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type LocalizedText = Partial<Record<'EN' | 'ZH' | 'ZH_TW' | 'JA', string>>;

export type SleevePattern = 'pair' | 'three_kind' | 'four_kind' | 'straight' | 'flush';

export type SleeveEffectDefinition =
  | { type: 'score_flat'; value: number }
  | { type: 'score_flat_random'; min: number; max: number }
  | { type: 'score_flat_per_attacker_symbol_win'; symbol: RPS; value: number }
  | { type: 'score_flat_if_pattern'; pattern: SleevePattern; value: number }
  | { type: 'score_mult_if_pattern'; pattern: SleevePattern; value: number }
  | { type: 'score_mult_per_empty_sleeve_slot'; value: number }
  | { type: 'score_flat_per_owned_sleeve'; value: number }
  | { type: 'score_flat_per_remaining_deal'; value: number }
  | { type: 'score_flat_if_no_deals_left'; value: number }
  | { type: 'score_mult_every_n_hands'; interval: number; value: number }
  | { type: 'score_flat_per_remaining_deck_card'; value: number }
  | { type: 'score_flat_per_chips'; value: number; step?: number }
  | { type: 'score_mult_if_final_hand'; value: number }
  | { type: 'chips_end_level'; value: number }
  | { type: 'chips_interest_per_5'; value: number }
  | { type: 'bonus_deals_per_level'; value: number }
  | { type: 'chips_per_attacker_symbol_win'; symbol: RPS; value: number; chance?: number }
  | { type: 'score_mult_per_attacker_symbol_win'; symbol: RPS; value: number; chance?: number };

export interface SleeveDefinition {
  id: string;
  name: string;
  shortName: string;
  nameI18n?: LocalizedText;
  shortNameI18n?: LocalizedText;
  rarity: SleeveRarity;
  cost: number;
  accent: string;
  description: string;
  descriptionI18n?: LocalizedText;
  effects: SleeveEffectDefinition[];
}

export interface SleeveDefinitionFile {
  version: number;
  slotLimit: number;
  sleeves: SleeveDefinition[];
}

const DEFAULT_SLEEVE_DEFINITION: SleeveDefinitionFile = {
  version: 1,
  slotLimit: 2,
  sleeves: []
};

export interface SleeveRuntimeContext {
  card: Card;
  result: ClashResult;
  ownedSleeveCount: number;
  emptySleeveSlots: number;
  dealsLeft: number;
  remainingDeckCount: number;
  currentChips: number;
  handsPlayedThisRun: number;
  isFinalHand: boolean;
  random: () => number;
}

export interface SleeveClashBonus {
  flatScore: number;
  multiplier: number;
  chipsDelta: number;
  bonusDealsPerLevel: number;
  bonusInterestPer5Chips: number;
}

export async function loadSleeveDefinitionFile(): Promise<SleeveDefinitionFile> {
  try {
    const [response, toggles] = await Promise.all([
      fetch('/definition/sleevedefinition.json'),
      loadEffectToggles()
    ]);
    if (!response.ok) return DEFAULT_SLEEVE_DEFINITION;
    const parsed = (await response.json()) as SleeveDefinitionFile;
    if (!parsed || !Array.isArray(parsed.sleeves)) return DEFAULT_SLEEVE_DEFINITION;
    return {
      ...parsed,
      sleeves: parsed.sleeves.filter((sleeve) => isEnabledByToggle(toggles, sleeve.id, 'sleeve'))
    };
  } catch {
    return DEFAULT_SLEEVE_DEFINITION;
  }
}

function matchesPattern(card: Card, pattern: SleevePattern): boolean {
  if (pattern === 'pair') return isPair(card);
  if (pattern === 'three_kind') return isThreeOfAKind(card);
  if (pattern === 'four_kind') return isFourOfAKind(card);
  if (pattern === 'straight') return isStraight(card);
  return isFlush(card);
}

export function applySleeveEffects(definition: SleeveDefinition, context: SleeveRuntimeContext): SleeveClashBonus {
  const bonus: SleeveClashBonus = {
    flatScore: 0,
    multiplier: 1,
    chipsDelta: 0,
    bonusDealsPerLevel: 0,
    bonusInterestPer5Chips: 0
  };

  definition.effects.forEach((effect) => {
    switch (effect.type) {
      case 'score_flat':
        bonus.flatScore += effect.value;
        break;
      case 'score_flat_random':
        bonus.flatScore += Math.floor(context.random() * (effect.max - effect.min + 1)) + effect.min;
        break;
      case 'score_flat_per_attacker_symbol_win':
        bonus.flatScore += countCapturesByAttacker(context.result, effect.symbol) * effect.value;
        break;
      case 'score_flat_if_pattern':
        if (matchesPattern(context.card, effect.pattern)) bonus.flatScore += effect.value;
        break;
      case 'score_mult_if_pattern':
        if (matchesPattern(context.card, effect.pattern)) bonus.multiplier *= effect.value;
        break;
      case 'score_mult_per_empty_sleeve_slot': {
        const factor = Math.max(1, context.emptySleeveSlots * effect.value);
        bonus.multiplier *= factor;
        break;
      }
      case 'score_flat_per_owned_sleeve':
        bonus.flatScore += context.ownedSleeveCount * effect.value;
        break;
      case 'score_flat_per_remaining_deal':
        bonus.flatScore += context.dealsLeft * effect.value;
        break;
      case 'score_flat_if_no_deals_left':
        if (context.dealsLeft === 0) bonus.flatScore += effect.value;
        break;
      case 'score_mult_every_n_hands':
        if ((context.handsPlayedThisRun + 1) % effect.interval === 0) bonus.multiplier *= effect.value;
        break;
      case 'score_flat_per_remaining_deck_card':
        bonus.flatScore += context.remainingDeckCount * effect.value;
        break;
      case 'score_flat_per_chips': {
        const divisor = effect.step ?? 1;
        bonus.flatScore += Math.floor(context.currentChips / divisor) * effect.value;
        break;
      }
      case 'score_mult_if_final_hand':
        if (context.isFinalHand) bonus.multiplier *= effect.value;
        break;
      case 'chips_end_level':
        bonus.chipsDelta += effect.value;
        break;
      case 'chips_interest_per_5':
        bonus.bonusInterestPer5Chips += effect.value;
        break;
      case 'bonus_deals_per_level':
        bonus.bonusDealsPerLevel += effect.value;
        break;
      case 'chips_per_attacker_symbol_win':
        (context.result.captureEvents ?? []).forEach((event) => {
          if (event.attacker !== effect.symbol || event.defender === RPS.BLANK) return;
          if (effect.chance && context.random() >= effect.chance) return;
          bonus.chipsDelta += effect.value;
        });
        break;
      case 'score_mult_per_attacker_symbol_win':
        (context.result.captureEvents ?? []).forEach((event) => {
          if (event.attacker !== effect.symbol || event.defender === RPS.BLANK) return;
          if (effect.chance && context.random() >= effect.chance) return;
          bonus.multiplier *= effect.value;
        });
        break;
    }
  });

  return bonus;
}
