export interface UnlockDocument {
  title: string;
  description?: string;
}

export interface DeckCardEntry {
  code: string;
  count: number;
}

export interface DeckDefinition {
  id: string;
  name: string;
  unlockRef: string;
  cards: DeckCardEntry[];
}

export interface DeckDefinitionFile {
  version: number;
  unlockDocuments: Record<string, UnlockDocument>;
  decks: DeckDefinition[];
}

const DEFAULT_DECK_DEFINITION: DeckDefinitionFile = {
  version: 1,
  unlockDocuments: {
    'unlock:starter': {
      title: 'Starter',
      description: 'Default unlocked.'
    }
  },
  decks: [
    {
      id: 'deck:balanced',
      name: 'Balanced',
      unlockRef: 'unlock:starter',
      cards: [
        { code: '100', count: 3 },
        { code: '300', count: 3 },
        { code: '400', count: 3 }
      ]
    }
  ]
};

export async function loadDeckDefinitionFile(): Promise<DeckDefinitionFile> {
  try {
    const response = await fetch('/definition/deckdefinition.json');
    if (!response.ok) return DEFAULT_DECK_DEFINITION;
    const parsed = (await response.json()) as DeckDefinitionFile;
    if (!parsed || !Array.isArray(parsed.decks)) return DEFAULT_DECK_DEFINITION;
    return parsed;
  } catch {
    return DEFAULT_DECK_DEFINITION;
  }
}

export function getDeckById(defs: DeckDefinitionFile, deckId: string): DeckDefinition | null {
  return defs.decks.find((deck) => deck.id === deckId) ?? null;
}

export interface UnlockContext {
  flags: Record<string, boolean>;
}

export function isDeckUnlocked(deck: DeckDefinition, context: UnlockContext): boolean {
  if (deck.unlockRef === 'unlock:starter') return true;
  return Boolean(context.flags[deck.unlockRef]);
}
