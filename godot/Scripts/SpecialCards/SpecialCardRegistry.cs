using System.Collections.Generic;
using System.Linq;
using Godot;

namespace Roshambo.SpecialCards;

public static class SpecialCardRegistry
{
	private static readonly Dictionary<string, SpecialCardDefinition> Registry = new()
	{
		{ ChipCache.Definition.Id, ChipCache.Definition },
		{ InterestEngine.Definition.Id, InterestEngine.Definition },
		{ SupplyDrop.Definition.Id, SupplyDrop.Definition }
	};

	public static IReadOnlyList<SpecialCardDefinition> ListDefinitions()
	{
		return Registry.Values.ToList();
	}

	public static SpecialCardDefinition? GetDefinition(string definitionId)
	{
		return Registry.TryGetValue(definitionId, out var def) ? def : null;
	}

	public static List<SpecialCardDefinition> DrawShopDefinitions(IEnumerable<string> excludedDefinitionIds, int count, RandomNumberGenerator rng)
	{
		var excluded = new HashSet<string>(excludedDefinitionIds);
		var candidates = Registry.Values.Where(d => !excluded.Contains(d.Id)).ToList();
		Shuffle(candidates, rng);
		if (candidates.Count <= count) return candidates;
		return candidates.GetRange(0, count);
	}

	private static void Shuffle<T>(IList<T> list, RandomNumberGenerator rng)
	{
		for (var i = list.Count - 1; i > 0; i--)
		{
			var j = (int)rng.RandiRange(0, i);
			(list[i], list[j]) = (list[j], list[i]);
		}
	}
}
