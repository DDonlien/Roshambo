namespace Roshambo.SpecialCards;

public static class ChipCache
{
	public static readonly SpecialCardDefinition Definition = new()
	{
		Id = "special:chip-cache",
		Name = "Chip Cache",
		ShortName = "Cache",
		Description = "Gain +8 chips immediately.",
		Rarity = SpecialCardRarity.Common,
		Cost = 6,
		Accent = "#ffd700",
		ApplyOnAcquire = _ => new SpecialCardAcquireResult { ChipsDelta = 8 }
	};
}

