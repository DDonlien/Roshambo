import { CARD_LENGTH, Card, ClashResult, RPS } from '../types';

export function countCardSymbols(card: Card, symbol: RPS): number {
  return card.symbols.filter((candidate) => candidate === symbol).length;
}

export function isPair(card: Card): boolean {
  const counts = new Map<RPS, number>();
  card.symbols.forEach((symbol) => counts.set(symbol, (counts.get(symbol) ?? 0) + 1));
  return Array.from(counts.values()).some((count) => count >= 2);
}

export function isThreeOfAKind(card: Card): boolean {
  return new Set(card.symbols).size === 1;
}

export function isFourOfAKind(_card: Card): boolean {
  // Roshambo 当前固定为 3 格卡牌，无法自然形成 4 条。
  return false;
}

export function isStraight(card: Card): boolean {
  if (card.symbols.some((symbol) => symbol === RPS.BLANK)) return false;
  const nonWild = new Set(card.symbols.filter((symbol) => symbol !== RPS.TRICOLOR));
  return nonWild.size === CARD_LENGTH || (card.symbols.includes(RPS.TRICOLOR) && nonWild.size >= CARD_LENGTH - 1);
}

export function isFlush(card: Card): boolean {
  const normalized = card.symbols.filter((symbol) => symbol !== RPS.TRICOLOR);
  if (normalized.length === 0) return true;
  return normalized.every((symbol) => symbol === normalized[0]);
}

export function countCapturesByAttacker(result: ClashResult, symbol: RPS): number {
  return (result.captureEvents ?? []).filter((event) => event.attacker === symbol && event.defender !== RPS.BLANK).length;
}

export function countCapturedDefenders(result: ClashResult, symbol: RPS): number {
  return (result.captureEvents ?? []).filter((event) => event.defender === symbol).length;
}
