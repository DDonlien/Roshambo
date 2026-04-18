namespace Roshambo.SpecialCards;

public static class SupplyDrop
{
	public static readonly SpecialCardDefinition Definition = new()
	{
		Id = "special:supply-drop",
		Name = "Supply Drop",
		ShortName = "Supply",
		Description = "Each level: +1 shuffle, +1 deal.",
		Rarity = SpecialCardRarity.Rare,
		Cost = 10,
		Accent = "#2196f3",
		BonusDealsPerLevel = 1,
		BonusShufflesPerLevel = 1
	};
}

