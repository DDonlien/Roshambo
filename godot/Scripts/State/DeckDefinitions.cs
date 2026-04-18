using System.Collections.Generic;

namespace Roshambo.State;

public sealed class DeckDefinitionFile
{
	public int Version { get; set; }
	public List<DeckDefinition> Decks { get; set; } = new();
}

public sealed class DeckDefinition
{
	public string Id { get; set; } = "";
	public string Name { get; set; } = "";
	public string UnlockRef { get; set; } = "";
	public List<DeckCardEntry> Cards { get; set; } = new();
}

public sealed class DeckCardEntry
{
	public string Code { get; set; } = "";
	public int Count { get; set; }
}

