using Roshambo.Domain;
using Xunit;

namespace Roshambo.Tests;

public sealed class LogicTests
{
	[Fact]
	public void ResolveAttachmentOffset_MatrixSmallerThanCard()
	{
		Assert.Equal(-1, Logic.ResolveAttachmentOffset(2, 3, 0f));
		Assert.Equal(0, Logic.ResolveAttachmentOffset(2, 3, 0.5f));
		Assert.Equal(0, Logic.ResolveAttachmentOffset(2, 3, 0.99999f));
	}

	[Fact]
	public void ExecuteLaneClash_EmptyGrid_InsertsWithoutScore()
	{
		var grid = Logic.CreateEmptyGrid(3);
		var card = new Card { Id = "c1", Symbols = new[] { Rps.Rock, Rps.Rock, Rps.Rock } };

		var res = Logic.ExecuteLaneClash(grid, InsertEdge.Top, card, 0);

		Assert.Equal(0, res.ScoreDelta);
		Assert.Equal(0, res.Penalty);
		Assert.Equal(Rps.Rock, res.NewGrid[0, 0]);
		Assert.Equal(Rps.Rock, res.NewGrid[1, 0]);
		Assert.Equal(Rps.Rock, res.NewGrid[2, 0]);
	}

	[Fact]
	public void ExecuteLaneClash_ImmediateLoss_ShiftsLaneAndPenalizes()
	{
		var grid = Logic.CreateEmptyGrid(3);
		grid[0, 0] = Rps.Paper;
		var card = new Card { Id = "c1", Symbols = new[] { Rps.Rock, Rps.Blank, Rps.Blank } };

		var res = Logic.ExecuteLaneClash(grid, InsertEdge.Top, card, 0);

		Assert.Equal(0, res.ScoreDelta);
		Assert.Equal(4, res.Penalty);
		Assert.Contains(res.ShiftedLanes, l => l.Type == "col" && l.Index == 0 && l.Direction == -1);
		Assert.Equal(Rps.Blank, res.NewGrid[0, 0]);
		Assert.Equal(Rps.Blank, res.NewGrid[1, 0]);
		Assert.Equal(Rps.Paper, res.NewGrid[2, 0]);
	}

	[Fact]
	public void ExecuteLaneClash_Tie_AddsTieCellAndStops()
	{
		var grid = Logic.CreateEmptyGrid(3);
		grid[0, 1] = Rps.Scissors;
		var card = new Card { Id = "c1", Symbols = new[] { Rps.Blank, Rps.Scissors, Rps.Blank } };

		var res = Logic.ExecuteLaneClash(grid, InsertEdge.Top, card, 0);

		Assert.Equal(0, res.ScoreDelta);
		Assert.Equal(0, res.Penalty);
		Assert.Single(res.TieCells);
		Assert.Equal(0, res.TieCells[0].R);
		Assert.Equal(1, res.TieCells[0].C);
		Assert.Equal(Rps.Scissors, res.NewGrid[0, 1]);
	}
}

