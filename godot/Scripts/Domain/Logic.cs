using System;
using System.Collections.Generic;

namespace Roshambo.Domain;

public static class Logic
{
	private static readonly Dictionary<Rps, Rps?> WinMap = new()
	{
		{ Rps.Rock, Rps.Scissors },
		{ Rps.Scissors, Rps.Paper },
		{ Rps.Paper, Rps.Rock },
		{ Rps.Blank, null },
		{ Rps.Tricolor, null }
	};

	private static readonly Dictionary<Rps, int> ScoreWeights = new()
	{
		{ Rps.Rock, 4 },
		{ Rps.Scissors, 3 },
		{ Rps.Paper, 1 },
		{ Rps.Blank, 0 },
		{ Rps.Tricolor, 2 }
	};

	private static Rps SymbolThatBeats(Rps target)
	{
		return target switch
		{
			Rps.Rock => Rps.Paper,
			Rps.Paper => Rps.Scissors,
			Rps.Scissors => Rps.Rock,
			_ => Rps.Rock
		};
	}

	private static Rps ResolveTricolor(Rps symbol, Rps opponent, bool wantsAdvantage)
	{
		if (symbol != Rps.Tricolor) return symbol;
		if (opponent == Rps.Blank) return Rps.Tricolor;
		if (!wantsAdvantage) return Rps.Rock;
		return SymbolThatBeats(opponent);
	}

	private static (Rps attacker, Rps defender) ResolvePair(Rps attacker, Rps defender)
	{
		if (attacker == Rps.Tricolor && defender == Rps.Tricolor)
		{
			return (Rps.Rock, Rps.Rock);
		}

		var resolvedAttacker = ResolveTricolor(attacker, defender, true);
		var resolvedDefender = ResolveTricolor(defender, resolvedAttacker, true);
		return (resolvedAttacker, resolvedDefender);
	}

	private static void ShiftLane(Rps[,] grid, int index, string type, int direction)
	{
		var size = grid.GetLength(0);

		if (type == "row")
		{
			if (direction == 1)
			{
				var last = grid[index, size - 1];
				for (var col = size - 1; col > 0; col--)
				{
					grid[index, col] = grid[index, col - 1];
				}
				grid[index, 0] = last;
			}
			else
			{
				var first = grid[index, 0];
				for (var col = 0; col < size - 1; col++)
				{
					grid[index, col] = grid[index, col + 1];
				}
				grid[index, size - 1] = first;
			}
		}
		else
		{
			if (direction == 1)
			{
				var last = grid[size - 1, index];
				for (var row = size - 1; row > 0; row--)
				{
					grid[row, index] = grid[row - 1, index];
				}
				grid[0, index] = last;
			}
			else
			{
				var first = grid[0, index];
				for (var row = 0; row < size - 1; row++)
				{
					grid[row, index] = grid[row + 1, index];
				}
				grid[size - 1, index] = first;
			}
		}
	}

	public static int ResolveAttachmentOffset(int matrixSize, int cardLength, float pointerRatio)
	{
		var minOffset = Math.Min(0, matrixSize - cardLength);
		var maxOffset = Math.Max(0, matrixSize - cardLength);
		if (minOffset == maxOffset) return minOffset;

		var placementCount = maxOffset - minOffset + 1;
		var clampedRatio = Math.Min(Math.Max(pointerRatio, 0f), 0.999999f);
		var placementIndex = Math.Min(placementCount - 1, (int)Math.Floor(clampedRatio * placementCount));
		return minOffset + placementIndex;
	}

	public static ClashResult ExecuteLaneClash(Rps[,] currentGrid, InsertEdge edge, Card card, int attachmentOffset)
	{
		var size = currentGrid.GetLength(0);
		var newGrid = new Rps[size, size];
		Array.Copy(currentGrid, newGrid, currentGrid.Length);

		var totalScore = 0;
		var penalty = 0;
		var laneScores = new int[card.Symbols.Length];
		var replacedCells = new List<ClashCell>();
		var failedCells = new List<ClashCell>();
		var tieCells = new List<ClashCell>();
		var shiftedLanes = new List<ShiftedLane>();

		for (var cardIndex = 0; cardIndex < card.Symbols.Length; cardIndex++)
		{
			var laneIndex = attachmentOffset + cardIndex;
			if (laneIndex < 0 || laneIndex >= size) continue;

			var attackerSymbol = card.Symbols[cardIndex];
			var r = 0;
			var c = 0;
			var dr = 0;
			var dc = 0;

			switch (edge)
			{
				case InsertEdge.Top: r = 0; c = laneIndex; dr = 1; dc = 0; break;
				case InsertEdge.Bottom: r = size - 1; c = laneIndex; dr = -1; dc = 0; break;
				case InsertEdge.Left: r = laneIndex; c = 0; dr = 0; dc = 1; break;
				case InsertEdge.Right: r = laneIndex; c = size - 1; dr = 0; dc = -1; break;
			}

			var defender = newGrid[r, c];
			var resolvedInitial = ResolvePair(attackerSymbol, defender);
			if (attackerSymbol == Rps.Tricolor)
			{
				attackerSymbol = resolvedInitial.attacker;
			}

			var attackerLoses = resolvedInitial.defender != Rps.Blank
				&& (resolvedInitial.attacker == Rps.Blank || (WinMap[resolvedInitial.defender] ?? Rps.Blank) == resolvedInitial.attacker);

			if (attackerLoses)
			{
				penalty += ScoreWeights.TryGetValue(resolvedInitial.attacker, out var attackerVal) ? attackerVal : 0;

				if (defender == Rps.Tricolor)
				{
					newGrid[r, c] = resolvedInitial.defender;
				}

				if (edge is InsertEdge.Left or InsertEdge.Right)
				{
					var shiftDir = edge == InsertEdge.Left ? -1 : 1;
					ShiftLane(newGrid, laneIndex, "row", shiftDir);
					shiftedLanes.Add(new ShiftedLane { Index = laneIndex, Type = "row", Direction = shiftDir });
				}
				else
				{
					var shiftDir = edge == InsertEdge.Top ? -1 : 1;
					ShiftLane(newGrid, laneIndex, "col", shiftDir);
					shiftedLanes.Add(new ShiftedLane { Index = laneIndex, Type = "col", Direction = shiftDir });
				}
			}
			else if (attackerSymbol != Rps.Blank)
			{
				for (var step = 0; step < size; step++)
				{
					var currentDefender = newGrid[r, c];
					var resolved = ResolvePair(attackerSymbol, currentDefender);
					var attackerWins = (WinMap[resolved.attacker] ?? Rps.Blank) == resolved.defender || resolved.defender == Rps.Blank;

					if (attackerWins)
					{
						totalScore += ScoreWeights.TryGetValue(resolved.defender, out var gain) ? gain : 0;
						laneScores[cardIndex] += ScoreWeights.TryGetValue(resolved.defender, out var laneGain) ? laneGain : 0;
						newGrid[r, c] = resolved.attacker;
						replacedCells.Add(new ClashCell { R = r, C = c });
						r += dr;
						c += dc;
						if (r < 0 || r > size - 1 || c < 0 || c > size - 1) break;
					}
					else
					{
						if ((WinMap[resolved.defender] ?? Rps.Blank) == resolved.attacker)
						{
							penalty += ScoreWeights.TryGetValue(resolved.attacker, out var p) ? p : 0;
							failedCells.Add(new ClashCell { R = r, C = c });
							if (currentDefender == Rps.Tricolor)
							{
								newGrid[r, c] = resolved.defender;
							}
						}
						else if (resolved.defender == resolved.attacker)
						{
							tieCells.Add(new ClashCell { R = r, C = c });
							if (currentDefender == Rps.Tricolor)
							{
								newGrid[r, c] = resolved.defender;
							}
						}

						break;
					}
				}
			}
		}

		return new ClashResult
		{
			NewGrid = newGrid,
			ScoreDelta = totalScore,
			Penalty = penalty,
			LaneScores = laneScores,
			ReplacedCells = replacedCells,
			FailedCells = failedCells,
			TieCells = tieCells,
			AttachmentOffset = attachmentOffset,
			ShiftedLanes = shiftedLanes
		};
	}

	public static Rps[,] CreateEmptyGrid(int size)
	{
		var grid = new Rps[size, size];
		for (var r = 0; r < size; r++)
		for (var c = 0; c < size; c++)
		{
			grid[r, c] = Rps.Blank;
		}
		return grid;
	}
}

