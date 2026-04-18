using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using Godot;
using Roshambo.Domain;
using Roshambo.SpecialCards;

namespace Roshambo.State;

public partial class GameStore : Node
{
	[Signal]
	public delegate void StateChangedEventHandler();

	private readonly RandomNumberGenerator _rng = new();
	private static readonly List<DeckDefinition> EmptyDecks = new();

	private GameState _state = new();
	private List<LevelConfig> _levelConfigs = new();
	private DeckDefinitionFile? _deckDefinitionFile;
	private readonly Dictionary<int, InitialConfig> _initialConfigs = new()
	{
		{ 1, new InitialConfig { Chips = 10, InterestRate = 0.2f, DealsLeft = 4, ShufflesLeft = 4 } },
		{ 2, new InitialConfig { Chips = 10, InterestRate = 0.2f, DealsLeft = 4, ShufflesLeft = 4 } },
		{ 3, new InitialConfig { Chips = 10, InterestRate = 0.2f, DealsLeft = 4, ShufflesLeft = 4 } }
	};

	private int _selectedDeckConfigIndex = 1;
	private string? _selectedDeckId;
	private InsertEdge? _lastPreviewEdge;
	private int _lastPreviewOffset;
	private float _lastPreviewPointerRatio = 0.5f;

	private static readonly Rps[] SymbolPool = { Rps.Rock, Rps.Scissors, Rps.Paper, Rps.Blank };
	private static readonly Dictionary<char, Rps> MapToRps = new()
	{
		{ '0', Rps.Blank },
		{ '1', Rps.Paper },
		{ '3', Rps.Scissors },
		{ '4', Rps.Rock },
		{ '7', Rps.Tricolor }
	};

	public override void _Ready()
	{
		_rng.Randomize();
		LoadLevelConfigs();
		LoadInitialConfigs();
		LoadDeckDefinitions();
		_state = CreateInitialState();
		EmitSignal(SignalName.StateChanged);
	}

	public GameState GetState()
	{
		return _state.Clone();
	}

	public IReadOnlyList<DeckDefinition> GetDeckDefinitions()
	{
		return _deckDefinitionFile?.Decks ?? EmptyDecks;
	}

	public InsertEdge? GetLastPreviewEdge()
	{
		return _lastPreviewEdge;
	}

	public int GetProjectedInterest()
	{
		var baseInterest = (int)Math.Floor((double)_state.Chips * _state.InterestRate);
		var modifiedInterest = _state.SpecialCards.Aggregate(baseInterest, (current, specialCard) =>
		{
			var definition = SpecialCardRegistry.GetDefinition(specialCard.DefinitionId);
			return definition?.ModifyProjectedInterest is null ? current : definition.ModifyProjectedInterest(current);
		});
		return Math.Max(0, modifiedInterest);
	}

	public void ChooseDeckById(string deckId)
	{
		if (_state.Status != GameStatus.ChooseDeck) return;
		var decks = GetDeckDefinitions();
		var deckIndex = decks.ToList().FindIndex(d => d.Id == deckId);
		_selectedDeckId = deckId;
		_selectedDeckConfigIndex = deckIndex >= 0 ? Math.Min(3, deckIndex + 1) : 1;
		RefillRoundResources();
		BuildDeckForCurrentLevel();
		_state.Status = GameStatus.Playing;
		EmitSignal(SignalName.StateChanged);
	}

	public void SelectCard(string? cardId)
	{
		if (_state.Status != GameStatus.Playing) return;
		if (string.IsNullOrEmpty(cardId))
		{
			_state.SelectedCardIds.Clear();
		}
		else
		{
			var idx = _state.SelectedCardIds.IndexOf(cardId);
			if (idx >= 0) _state.SelectedCardIds.RemoveAt(idx);
			else _state.SelectedCardIds.Add(cardId);
		}

		ClearPreview();
		EmitSignal(SignalName.StateChanged);
	}

	public void FocusCard(string? cardId)
	{
		if (_state.Status != GameStatus.Playing) return;
		_state.SelectedCardIds = string.IsNullOrEmpty(cardId) ? new List<string>() : new List<string> { cardId };
		ClearPreview();
		EmitSignal(SignalName.StateChanged);
	}

	public void FlipSelectedCard()
	{
		if (_state.Status != GameStatus.Playing || _state.SelectedCardIds.Count == 0) return;
		var lastSelected = _state.SelectedCardIds[^1];

		for (var i = 0; i < _state.Hand.Count; i++)
		{
			var card = _state.Hand[i];
			if (card.Id != lastSelected) continue;
			Array.Reverse(card.Symbols);
			card.IsFlipped = !card.IsFlipped;
			break;
		}

		var edge = _lastPreviewEdge;
		if (edge is not null)
		{
			_lastPreviewEdge = null;
			UpdatePreview(edge.Value, _lastPreviewPointerRatio);
			return;
		}

		EmitSignal(SignalName.StateChanged);
	}

	public void UpdatePreview(InsertEdge? edge, float pointerRatio = 0.5f)
	{
		_lastPreviewPointerRatio = pointerRatio;
		var nextOffset = edge is null ? 0 : Logic.ResolveAttachmentOffset(_state.Matrix.Size, Constants.CardLength, pointerRatio);

		if (_lastPreviewEdge == edge && _lastPreviewOffset == nextOffset && (_state.Preview is not null || edge is null))
		{
			return;
		}

		_lastPreviewEdge = edge;
		_lastPreviewOffset = nextOffset;

		if (_state.Status != GameStatus.Playing || _state.SelectedCardIds.Count == 0 || edge is null)
		{
			_state.Preview = null;
			EmitSignal(SignalName.StateChanged);
			return;
		}

		var lastSelected = _state.SelectedCardIds[^1];
		var selectedCard = _state.Hand.FirstOrDefault(c => c.Id == lastSelected);
		if (selectedCard is null)
		{
			_state.Preview = null;
			EmitSignal(SignalName.StateChanged);
			return;
		}

		var res = Logic.ExecuteLaneClash(_state.Matrix.Grid, edge.Value, selectedCard, _lastPreviewOffset);
		res.InsertedCardId = selectedCard.Id;
		_state.Preview = res;
		EmitSignal(SignalName.StateChanged);
	}

	public ClashResult? PlaySelectedToEdge(InsertEdge edge)
	{
		if (_state.Status != GameStatus.Playing || _state.SelectedCardIds.Count == 0) return null;
		var lastSelected = _state.SelectedCardIds[^1];
		var selectedCard = _state.Hand.FirstOrDefault(c => c.Id == lastSelected);
		if (selectedCard is null) return null;
		var res = Logic.ExecuteLaneClash(_state.Matrix.Grid, edge, selectedCard, _lastPreviewOffset);
		res.InsertedCardId = selectedCard.Id;
		return res;
	}

	public void ApplyClashResult(ClashResult result)
	{
		var size = result.NewGrid.GetLength(0);
		_state.Matrix = new Matrix { Size = size, Grid = result.NewGrid };
		_state.CurrentScore += result.ScoreDelta;
		_state.CurrentScore -= result.Penalty;
		_state.LastClash = result.Clone();

		var playedCard = _state.Hand.FirstOrDefault(c => c.Id == result.InsertedCardId);
		if (playedCard is not null) _state.DiscardPile.Add(playedCard);
		_state.Hand = _state.Hand.Where(c => c.Id != result.InsertedCardId).ToList();

		_state.SelectedCardIds.Clear();
		ClearPreview();
		CheckLevelWin();
		ResolveRoundEnd();
		EmitSignal(SignalName.StateChanged);
	}

	public void OpenShop()
	{
		if (_state.Status != GameStatus.RoundReward) return;
		var owned = _state.SpecialCards.Select(s => s.DefinitionId).ToList();
		var definitions = SpecialCardRegistry.DrawShopDefinitions(owned, Constants.ShopOfferCount, _rng);
		_state.ShopOffers = definitions.Select(d => new ShopOffer
		{
			OfferId = Guid.NewGuid().ToString(),
			DefinitionId = d.Id,
			Cost = d.Cost,
			Purchased = false
		}).ToList();
		_state.Status = GameStatus.Shop;
		EmitSignal(SignalName.StateChanged);
	}

	public void BuyShopOffer(string offerId)
	{
		if (_state.Status != GameStatus.Shop) return;
		var offer = _state.ShopOffers.FirstOrDefault(o => o.OfferId == offerId);
		if (offer is null || offer.Purchased || _state.Chips < offer.Cost) return;

		var definition = SpecialCardRegistry.GetDefinition(offer.DefinitionId);
		if (definition is null) return;

		_state.Chips -= offer.Cost;
		offer.Purchased = true;
		_state.SpecialCards.Add(new SpecialCardInstance { InstanceId = Guid.NewGuid().ToString(), DefinitionId = definition.Id });

		var applyResult = definition.ApplyOnAcquire?.Invoke(new SpecialCardEffectContext
		{
			Chips = _state.Chips,
			ProjectedInterest = GetProjectedInterest(),
			DealsLeft = _state.DealsLeft,
			ShufflesLeft = _state.ShufflesLeft
		});

		if (applyResult is not null)
		{
			_state.Chips += applyResult.ChipsDelta;
			_state.DealsLeft += applyResult.DealsDelta;
			_state.ShufflesLeft += applyResult.ShufflesDelta;
		}

		EmitSignal(SignalName.StateChanged);
	}

	public void ContinueAfterShop()
	{
		if (_state.Status != GameStatus.Shop) return;

		if (_state.CurrentLevel >= _levelConfigs.Count)
		{
			_state.Status = GameStatus.Win;
			_state.PendingReward = null;
			_state.ShopOffers.Clear();
			EmitSignal(SignalName.StateChanged);
			return;
		}

		NextLevel();
	}

	public void NextLevel()
	{
		if (_state.Status is not GameStatus.Shop and not GameStatus.RoundReward) return;

		ApplyLevelConfig(_state.CurrentLevel + 1);
		_state.CurrentScore = 0;
		RefillRoundResources();

		_state.Status = GameStatus.Playing;
		_state.SelectedCardIds.Clear();
		_state.Preview = null;
		_state.LastClash = null;
		_state.LastInterestEarned = 0;
		_state.LastLevelReward = 0;
		_state.PendingReward = null;
		_state.ShopOffers.Clear();
		_lastPreviewEdge = null;
		_lastPreviewOffset = 0;
		_lastPreviewPointerRatio = 0.5f;

		BuildDeckForCurrentLevel();
		EmitSignal(SignalName.StateChanged);
	}

	public void ShuffleMatrix()
	{
		if (_state.Status != GameStatus.Playing || _state.ShufflesLeft <= 0) return;
		_state.Matrix = new Matrix { Size = _state.Matrix.Size, Grid = RandomGrid(_state.Matrix.Size) };
		_state.ShufflesLeft -= 1;
		_state.SelectedCardIds.Clear();
		ClearPreview();
		EmitSignal(SignalName.StateChanged);
	}

	public void DealHand()
	{
		if (_state.Status != GameStatus.Playing || _state.DealsLeft <= 0 || _state.Deck.Count == 0) return;

		var cardsToSwap = _state.Hand.Where(c => _state.SelectedCardIds.Contains(c.Id)).ToList();
		if (cardsToSwap.Count == 0) cardsToSwap = new List<Card>(_state.Hand);

		var swapCount = Math.Min(cardsToSwap.Count, _state.Deck.Count);
		if (swapCount == 0) return;

		for (var i = 0; i < swapCount; i++)
		{
			var cardToSwap = cardsToSwap[i];
			var handIdx = _state.Hand.FindIndex(c => c.Id == cardToSwap.Id);
			var deckIdx = (int)_rng.RandiRange(0, _state.Deck.Count - 1);
			var cardFromDeck = _state.Deck[deckIdx];

			_state.Hand[handIdx] = cardFromDeck;
			_state.Deck.RemoveAt(deckIdx);
			_state.DiscardPile.Add(cardToSwap);
		}

		_state.DealsLeft -= 1;
		_state.SelectedCardIds.Clear();
		ClearPreview();
		EmitSignal(SignalName.StateChanged);
	}

	public void ResetGame()
	{
		_selectedDeckConfigIndex = 1;
		_selectedDeckId = null;
		_lastPreviewEdge = null;
		_lastPreviewOffset = 0;
		_lastPreviewPointerRatio = 0.5f;
		_state = CreateInitialState();
		EmitSignal(SignalName.StateChanged);
	}

	private void ClearPreview()
	{
		_state.Preview = null;
		_lastPreviewEdge = null;
		_lastPreviewOffset = 0;
		_lastPreviewPointerRatio = 0.5f;
	}

	private void CheckLevelWin()
	{
		if (_state.Status != GameStatus.Playing) return;
		if (_state.CurrentScore < _state.LevelGoal) return;

		var levelConfig = GetCurrentLevelConfigInternal();
		var interestEarned = GetProjectedInterest();
		var levelReward = levelConfig.Reward;
		var totalReward = interestEarned + levelReward;

		_state.Chips += totalReward;
		_state.LastInterestEarned = interestEarned;
		_state.LastLevelReward = levelReward;
		_state.PendingReward = new RoundRewardSummary
		{
			Level = levelConfig.Level,
			Stage = levelConfig.Stage,
			LevelName = levelConfig.Name,
			Goal = levelConfig.Goal,
			BaseReward = levelReward,
			InterestReward = interestEarned,
			TotalReward = totalReward,
			FinalLevel = _state.CurrentLevel >= _levelConfigs.Count
		};
		_state.ShopOffers.Clear();
		_state.Status = GameStatus.RoundReward;
	}

	private void RefillRoundResources()
	{
		var conf = _initialConfigs.TryGetValue(_selectedDeckConfigIndex, out var val) ? val : _initialConfigs[1];
		var bonuses = GetPerLevelResourceBonuses();
		_state.ShufflesLeft = conf.ShufflesLeft + bonuses.shuffles;
		_state.DealsLeft = conf.DealsLeft + bonuses.deals;
	}

	private (int deals, int shuffles) GetPerLevelResourceBonuses()
	{
		var deals = 0;
		var shuffles = 0;
		foreach (var specialCard in _state.SpecialCards)
		{
			var def = SpecialCardRegistry.GetDefinition(specialCard.DefinitionId);
			if (def is null) continue;
			deals += def.BonusDealsPerLevel;
			shuffles += def.BonusShufflesPerLevel;
		}
		return (deals, shuffles);
	}

	private void ResolveRoundEnd()
	{
		if (_state.Status == GameStatus.Playing && _state.Hand.Count == 0)
		{
			if (_state.CurrentScore < _state.LevelGoal)
			{
				_state.Status = GameStatus.GameOver;
				_state.SelectedCardIds.Clear();
			}
		}
	}

	private GameState CreateInitialState()
	{
		if (_levelConfigs.Count == 0)
		{
			_levelConfigs = CreateDefaultLevels();
		}

		var firstLevel = _levelConfigs[0];
		var conf = _initialConfigs.TryGetValue(_selectedDeckConfigIndex, out var val) ? val : _initialConfigs[1];

		return new GameState
		{
			Matrix = new Matrix { Size = firstLevel.MatrixSize, Grid = RandomGrid(firstLevel.MatrixSize) },
			Hand = new List<Card>(),
			Deck = new List<Card>(),
			DiscardPile = new List<Card>(),
			CurrentScore = 0,
			Chips = conf.Chips,
			InterestRate = conf.InterestRate,
			CurrentLevel = 1,
			CurrentStage = firstLevel.Stage,
			CurrentTier = firstLevel.Tier,
			TotalStages = Constants.TotalStages,
			TotalLevels = _levelConfigs.Count,
			LevelName = firstLevel.Name,
			LevelIcon = firstLevel.Icon,
			LevelGoal = firstLevel.Goal,
			LevelReward = firstLevel.Reward,
			ShufflesLeft = conf.ShufflesLeft,
			DealsLeft = conf.DealsLeft,
			SelectedCardIds = new List<string>(),
			Status = GameStatus.ChooseDeck,
			LastClash = null,
			Preview = null,
			LastInterestEarned = 0,
			LastLevelReward = 0,
			PendingReward = null,
			ShopOffers = new List<ShopOffer>(),
			SpecialCards = new List<SpecialCardInstance>()
		};
	}

	private LevelConfig GetCurrentLevelConfigInternal(int? level = null)
	{
		var lv = level ?? _state.CurrentLevel;
		return _levelConfigs.ElementAtOrDefault(lv - 1) ?? _levelConfigs[0];
	}

	private void ApplyLevelConfig(int level)
	{
		var levelConfig = GetCurrentLevelConfigInternal(level);
		_state.CurrentLevel = levelConfig.Level;
		_state.CurrentStage = levelConfig.Stage;
		_state.CurrentTier = levelConfig.Tier;
		_state.LevelName = levelConfig.Name;
		_state.LevelIcon = levelConfig.Icon;
		_state.LevelGoal = levelConfig.Goal;
		_state.LevelReward = levelConfig.Reward;
		_state.Matrix = new Matrix { Size = levelConfig.MatrixSize, Grid = RandomGrid(levelConfig.MatrixSize) };
	}

	private Rps RandomSymbol()
	{
		return SymbolPool[(int)_rng.RandiRange(0, SymbolPool.Length - 1)];
	}

	private Rps[,] RandomGrid(int size)
	{
		var grid = Logic.CreateEmptyGrid(size);
		for (var r = 0; r < size; r++)
		for (var c = 0; c < size; c++)
		{
			grid[r, c] = RandomSymbol();
		}
		return grid;
	}

	private static Card CreateCardFromCode(string code)
	{
		var symbols = code.Select(ch => MapToRps.TryGetValue(ch, out var sym) ? sym : Rps.Blank).ToArray();
		return new Card { Id = Guid.NewGuid().ToString(), Symbols = symbols };
	}

	private void BuildDeckForCurrentLevel()
	{
		var decks = GetDeckDefinitions();
		var selectedDeck = decks.FirstOrDefault(d => d.Id == _selectedDeckId) ?? decks.FirstOrDefault();
		var fullDeck = selectedDeck is null ? new List<Card>() : CreateDeckFromDefinition(selectedDeck);
		_state.Hand = fullDeck.Take(5).ToList();
		_state.Deck = fullDeck.Skip(5).ToList();
		_state.DiscardPile.Clear();
	}

	private List<Card> CreateDeckFromDefinition(DeckDefinition definition)
	{
		var codes = new List<string>();
		foreach (var entry in definition.Cards)
		{
			var count = Math.Max(0, entry.Count);
			for (var i = 0; i < count; i++) codes.Add(entry.Code);
		}

		var deck = codes.Select(CreateCardFromCode).ToList();
		for (var i = deck.Count - 1; i > 0; i--)
		{
			var j = (int)_rng.RandiRange(0, i);
			(deck[i], deck[j]) = (deck[j], deck[i]);
		}

		return deck;
	}

	private static List<LevelConfig> CreateDefaultLevels()
	{
		var themes = new[]
		{
			new { Name = "Pocket", MatrixSize = 2, Icon = "pocket" },
			new { Name = "Rubik", MatrixSize = 3, Icon = "rubik" },
			new { Name = "Master", MatrixSize = 4, Icon = "master" }
		};

		var defaultGoals = new[] { 10, 30, 80 };
		var defaultRewards = new[] { 10, 18, 28 };

		var levels = new List<LevelConfig>();
		for (var index = 0; index < Constants.TotalStages * Constants.LevelsPerStage; index++)
		{
			var stage = index / Constants.LevelsPerStage + 1;
			var tier = index % Constants.LevelsPerStage + 1;
			var theme = themes[index % themes.Length];
			levels.Add(new LevelConfig
			{
				Level = index + 1,
				Stage = stage,
				Tier = tier,
				Goal = defaultGoals[tier - 1] + (stage - 1) * 20,
				Reward = defaultRewards[tier - 1] + (stage - 1) * 3,
				Name = theme.Name,
				MatrixSize = theme.MatrixSize,
				Icon = theme.Icon
			});
		}

		return levels;
	}

	private void LoadLevelConfigs()
	{
		_levelConfigs = CreateDefaultLevels();
		var text = ReadText("res://Definitions/levels.csv");
		if (string.IsNullOrWhiteSpace(text)) return;

		var lines = text.Trim().Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0).ToList();
		if (lines.Count <= 1) return;

		var map = new Dictionary<int, (int? goal, int? reward)>();
		for (var i = 1; i < lines.Count; i++)
		{
			var parts = lines[i].Split(',').Select(p => p.Trim()).ToArray();
			if (parts.Length < 3) continue;
			if (!int.TryParse(parts[0], out var level)) continue;
			var goal = int.TryParse(parts[1], out var g) ? g : (int?)null;
			var reward = int.TryParse(parts[2], out var r) ? r : (int?)null;
			map[level] = (goal, reward);
		}

		for (var i = 0; i < _levelConfigs.Count; i++)
		{
			var lv = _levelConfigs[i].Level;
			if (!map.TryGetValue(lv, out var overrideVal)) continue;
			_levelConfigs[i].Goal = overrideVal.goal ?? _levelConfigs[i].Goal;
			_levelConfigs[i].Reward = overrideVal.reward ?? _levelConfigs[i].Reward;
		}
	}

	private void LoadInitialConfigs()
	{
		var text = ReadText("res://Definitions/initial.csv");
		if (string.IsNullOrWhiteSpace(text)) return;

		var lines = text.Trim().Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0).ToList();
		if (lines.Count < 2) return;

		var parsed = new Dictionary<string, float[]>();
		for (var i = 1; i < lines.Count; i++)
		{
			var cols = lines[i].Split(',').Select(s => s.Trim()).ToArray();
			if (cols.Length < 4) continue;
			var key = cols[0].ToLowerInvariant();
			var vals = new float[3];
			for (var j = 0; j < 3; j++)
			{
				_ = float.TryParse(cols[j + 1], NumberStyles.Float, CultureInfo.InvariantCulture, out vals[j]);
			}
			parsed[key] = vals;
		}

		if (!parsed.TryGetValue("chips", out var chipsArr)) return;

		for (var deckType = 1; deckType <= 3; deckType++)
		{
			var idx = deckType - 1;
			_initialConfigs[deckType] = new InitialConfig
			{
				Chips = idx < chipsArr.Length ? (int)Math.Floor(chipsArr[idx]) : 10,
				InterestRate = parsed.TryGetValue("interest", out var iArr) && idx < iArr.Length ? iArr[idx] : 0.2f,
				DealsLeft = parsed.TryGetValue("deal", out var dArr) && idx < dArr.Length ? (int)Math.Floor(dArr[idx]) : 4,
				ShufflesLeft = parsed.TryGetValue("shuffle", out var sArr) && idx < sArr.Length ? (int)Math.Floor(sArr[idx]) : 4
			};
		}
	}

	private void LoadDeckDefinitions()
	{
		var text = ReadText("res://Definitions/deckdefinition.json");
		if (string.IsNullOrWhiteSpace(text)) return;

		try
		{
			var doc = JsonDocument.Parse(text);
			var root = doc.RootElement;
			var decks = new List<DeckDefinition>();
			if (root.TryGetProperty("decks", out var decksElem) && decksElem.ValueKind == JsonValueKind.Array)
			{
				foreach (var deckElem in decksElem.EnumerateArray())
				{
					var deck = new DeckDefinition
					{
						Id = deckElem.GetProperty("id").GetString() ?? "",
						Name = deckElem.GetProperty("name").GetString() ?? "",
						UnlockRef = deckElem.TryGetProperty("unlockRef", out var unlockElem) ? (unlockElem.GetString() ?? "") : ""
					};

					if (deckElem.TryGetProperty("cards", out var cardsElem) && cardsElem.ValueKind == JsonValueKind.Array)
					{
						foreach (var cardEntryElem in cardsElem.EnumerateArray())
						{
							deck.Cards.Add(new DeckCardEntry
							{
								Code = cardEntryElem.GetProperty("code").GetString() ?? "",
								Count = cardEntryElem.GetProperty("count").GetInt32()
							});
						}
					}

					decks.Add(deck);
				}
			}

			_deckDefinitionFile = new DeckDefinitionFile { Version = root.TryGetProperty("version", out var v) ? v.GetInt32() : 1, Decks = decks };
		}
		catch (Exception e)
		{
			GD.PushWarning($"Could not parse deckdefinition.json: {e.Message}");
		}
	}

	private static string ReadText(string path)
	{
		if (!Godot.FileAccess.FileExists(path)) return "";
		using var f = Godot.FileAccess.Open(path, Godot.FileAccess.ModeFlags.Read);
		return f.GetAsText();
	}
}
