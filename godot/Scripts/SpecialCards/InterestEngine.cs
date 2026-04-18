namespace Roshambo.SpecialCards;

public static class InterestEngine
{
	public static readonly SpecialCardDefinition Definition = new()
	{
		Id = "special:interest-engine",
		Name = "Interest Engine",
		ShortName = "Interest",
		Description = "Projected interest +3.",
		Rarity = SpecialCardRarity.Uncommon,
		Cost = 8,
		Accent = "#7cff8f",
		ModifyProjectedInterest = projected => projected + 3
	};
}

