export interface EffectToggleRow {
  id: string;
  type: string;
  enabled: boolean;
}

export async function loadEffectToggles(): Promise<EffectToggleRow[]> {
  try {
    const response = await fetch('/definition/effecttoggle.csv');
    if (!response.ok) return [];
    const text = await response.text();
    return text
      .trim()
      .split('\n')
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const [id, type, enabled] = line.split(',').map((part) => part.trim());
        return {
          id,
          type,
          enabled: enabled.toLowerCase() === 'true'
        };
      });
  } catch {
    return [];
  }
}

export function isEnabledByToggle(toggles: EffectToggleRow[], id: string, type: string): boolean {
  const match = toggles.find((toggle) => toggle.id === id && toggle.type === type);
  return match ? match.enabled : true;
}
