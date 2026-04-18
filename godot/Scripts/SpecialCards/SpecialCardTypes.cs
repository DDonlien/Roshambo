using System;

namespace Roshambo.SpecialCards;

public enum SpecialCardRarity
{
	Common,
	Uncommon,
	Rare
}

public sealed class SpecialCardEffectContext
{
	public int Chips { get; init; }
	public int ProjectedInterest { get; init; }
	public int DealsLeft { get; init; }
	public int ShufflesLeft { get; init; }
}

public sealed class SpecialCardAcquireResult
{
	public int ChipsDelta { get; init; }
	public int DealsDelta { get; init; }
	public int ShufflesDelta { get; init; }
}

public sealed class SpecialCardDefinition
{
	public string Id { get; init; } = "";
	public string Name { get; init; } = "";
	public string ShortName { get; init; } = "";
	public string Description { get; init; } = "";
	public SpecialCardRarity Rarity { get; init; }
	public int Cost { get; init; }
	public string Accent { get; init; } = "";
	public int BonusDealsPerLevel { get; init; }
	public int BonusShufflesPerLevel { get; init; }
	public Func<SpecialCardEffectContext, SpecialCardAcquireResult?>? ApplyOnAcquire { get; init; }
	public Func<int, int>? ModifyProjectedInterest { get; init; }
}

