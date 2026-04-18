using System;
using System.Collections.Generic;

namespace Roshambo.Domain;

public enum Rps
{
	Rock,
	Scissors,
	Paper,
	Blank,
	Tricolor
}

public enum InsertEdge
{
	Top,
	Bottom,
	Left,
	Right
}

public static class Constants
{
	public const int CardLength = 3;
	public const int TotalStages = 9;
	public const int LevelsPerStage = 3;
	public const int ShopOfferCount = 3;
}

public sealed class Card
{
	public string Id { get; set; } = "";
	public Rps[] Symbols { get; set; } = Array.Empty<Rps>();
	public bool IsFlipped { get; set; }

	public Card Clone()
	{
		return new Card
		{
			Id = Id,
			Symbols = (Rps[])Symbols.Clone(),
			IsFlipped = IsFlipped
		};
	}
}

public sealed class Matrix
{
	public int Size { get; set; }
	public Rps[,] Grid { get; set; } = new Rps[0, 0];

	public Matrix Clone()
	{
		var copy = new Rps[Size, Size];
		Array.Copy(Grid, copy, Grid.Length);
		return new Matrix { Size = Size, Grid = copy };
	}
}

public enum GameStatus
{
	ChooseDeck,
	Playing,
	RoundReward,
	Shop,
	GameOver,
	Win
}

public sealed class ClashCell
{
	public int R { get; set; }
	public int C { get; set; }
}

public sealed class ShiftedLane
{
	public int Index { get; set; }
	public string Type { get; set; } = "";
	public int Direction { get; set; }
}

public sealed class ClashResult
{
	public Rps[,] NewGrid { get; set; } = new Rps[0, 0];
	public int ScoreDelta { get; set; }
	public int Penalty { get; set; }
	public int[] LaneScores { get; set; } = Array.Empty<int>();
	public List<ClashCell> ReplacedCells { get; set; } = new();
	public List<ClashCell> FailedCells { get; set; } = new();
	public List<ClashCell> TieCells { get; set; } = new();
	public string InsertedCardId { get; set; } = "";
	public int AttachmentOffset { get; set; }
	public List<ShiftedLane> ShiftedLanes { get; set; } = new();

	public ClashResult Clone()
	{
		var size = NewGrid.GetLength(0);
		var gridCopy = new Rps[size, size];
		Array.Copy(NewGrid, gridCopy, NewGrid.Length);

		return new ClashResult
		{
			NewGrid = gridCopy,
			ScoreDelta = ScoreDelta,
			Penalty = Penalty,
			LaneScores = (int[])LaneScores.Clone(),
			ReplacedCells = new List<ClashCell>(ReplacedCells.ConvertAll(c => new ClashCell { R = c.R, C = c.C })),
			FailedCells = new List<ClashCell>(FailedCells.ConvertAll(c => new ClashCell { R = c.R, C = c.C })),
			TieCells = new List<ClashCell>(TieCells.ConvertAll(c => new ClashCell { R = c.R, C = c.C })),
			InsertedCardId = InsertedCardId,
			AttachmentOffset = AttachmentOffset,
			ShiftedLanes = new List<ShiftedLane>(ShiftedLanes.ConvertAll(l => new ShiftedLane { Index = l.Index, Type = l.Type, Direction = l.Direction }))
		};
	}
}

public sealed class LevelConfig
{
	public int Level { get; set; }
	public int Stage { get; set; }
	public int Tier { get; set; }
	public int Goal { get; set; }
	public int Reward { get; set; }
	public string Name { get; set; } = "";
	public int MatrixSize { get; set; }
	public string Icon { get; set; } = "";
}

public sealed class InitialConfig
{
	public int Chips { get; set; }
	public float InterestRate { get; set; }
	public int DealsLeft { get; set; }
	public int ShufflesLeft { get; set; }
}

public sealed class RoundRewardSummary
{
	public int Level { get; set; }
	public int Stage { get; set; }
	public string LevelName { get; set; } = "";
	public int Goal { get; set; }
	public int BaseReward { get; set; }
	public int InterestReward { get; set; }
	public int TotalReward { get; set; }
	public bool FinalLevel { get; set; }
}

public sealed class SpecialCardInstance
{
	public string InstanceId { get; set; } = "";
	public string DefinitionId { get; set; } = "";
}

public sealed class ShopOffer
{
	public string OfferId { get; set; } = "";
	public string DefinitionId { get; set; } = "";
	public int Cost { get; set; }
	public bool Purchased { get; set; }
}

public sealed class GameState
{
	public Matrix Matrix { get; set; } = new();
	public List<Card> Hand { get; set; } = new();
	public List<Card> Deck { get; set; } = new();
	public List<Card> DiscardPile { get; set; } = new();
	public int CurrentScore { get; set; }
	public int Chips { get; set; }
	public float InterestRate { get; set; }
	public int CurrentLevel { get; set; }
	public int CurrentStage { get; set; }
	public int CurrentTier { get; set; }
	public int TotalStages { get; set; }
	public int TotalLevels { get; set; }
	public string LevelName { get; set; } = "";
	public string LevelIcon { get; set; } = "";
	public int LevelGoal { get; set; }
	public int LevelReward { get; set; }
	public int ShufflesLeft { get; set; }
	public int DealsLeft { get; set; }
	public List<string> SelectedCardIds { get; set; } = new();
	public GameStatus Status { get; set; }
	public ClashResult? LastClash { get; set; }
	public ClashResult? Preview { get; set; }
	public int LastInterestEarned { get; set; }
	public int LastLevelReward { get; set; }
	public RoundRewardSummary? PendingReward { get; set; }
	public List<ShopOffer> ShopOffers { get; set; } = new();
	public List<SpecialCardInstance> SpecialCards { get; set; } = new();

	public GameState Clone()
	{
		return new GameState
		{
			Matrix = Matrix.Clone(),
			Hand = new List<Card>(Hand.ConvertAll(c => c.Clone())),
			Deck = new List<Card>(Deck.ConvertAll(c => c.Clone())),
			DiscardPile = new List<Card>(DiscardPile.ConvertAll(c => c.Clone())),
			CurrentScore = CurrentScore,
			Chips = Chips,
			InterestRate = InterestRate,
			CurrentLevel = CurrentLevel,
			CurrentStage = CurrentStage,
			CurrentTier = CurrentTier,
			TotalStages = TotalStages,
			TotalLevels = TotalLevels,
			LevelName = LevelName,
			LevelIcon = LevelIcon,
			LevelGoal = LevelGoal,
			LevelReward = LevelReward,
			ShufflesLeft = ShufflesLeft,
			DealsLeft = DealsLeft,
			SelectedCardIds = new List<string>(SelectedCardIds),
			Status = Status,
			LastClash = LastClash?.Clone(),
			Preview = Preview?.Clone(),
			LastInterestEarned = LastInterestEarned,
			LastLevelReward = LastLevelReward,
			PendingReward = PendingReward is null ? null : new RoundRewardSummary
			{
				Level = PendingReward.Level,
				Stage = PendingReward.Stage,
				LevelName = PendingReward.LevelName,
				Goal = PendingReward.Goal,
				BaseReward = PendingReward.BaseReward,
				InterestReward = PendingReward.InterestReward,
				TotalReward = PendingReward.TotalReward,
				FinalLevel = PendingReward.FinalLevel
			},
			ShopOffers = new List<ShopOffer>(ShopOffers.ConvertAll(o => new ShopOffer
			{
				OfferId = o.OfferId,
				DefinitionId = o.DefinitionId,
				Cost = o.Cost,
				Purchased = o.Purchased
			})),
			SpecialCards = new List<SpecialCardInstance>(SpecialCards.ConvertAll(s => new SpecialCardInstance
			{
				InstanceId = s.InstanceId,
				DefinitionId = s.DefinitionId
			}))
		};
	}
}
