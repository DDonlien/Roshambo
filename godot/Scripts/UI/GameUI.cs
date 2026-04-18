using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using Roshambo.Domain;
using Roshambo.SpecialCards;
using Roshambo.State;

namespace Roshambo.UI;

public partial class GameUI : Control
{
	private GameStore? _store;
	private readonly AssetCatalog _assets = new();

	private HBoxContainer? _layout;
	private Control? _playArea;
	private Control? _matrixWrapper;
	private GridContainer? _matrixGrid;
	private Control? _previewBox;
	private Control? _handRow;
	private Control? _bottomArea;
	private Control? _sidebar;
	private HBoxContainer? _specialCardsRow;

	private TextureRect? _uiLevelIcon;
	private Label? _uiLevel;
	private Label? _uiLevelName;
	private Label? _uiGoal;
	private Label? _uiScore;
	private Label? _uiChips;
	private Label? _uiInterestPreview;
	private Label? _uiShuffleCount;
	private Label? _uiDealCount;
	private Label? _uiDeckCount;
	private Label? _uiDiscardCount;

	private CanvasLayer? _overlayLayer;
	private TextureRect? _heldCard;
	private Control? _statusOverlay;
	private VBoxContainer? _statusOverlayContent;

	private bool _isAttaching;

	public void Initialize(GameStore store)
	{
		_store = store;
		_assets.LoadAll();

		var usedSceneLayout = CacheSceneNodes();
		if (!usedSceneLayout)
		{
			BuildUiTree();
		}
		else
		{
			WireSceneUi();
		}

		store.StateChanged += OnStoreStateChanged;
		Render();
	}

	private bool CacheSceneNodes()
	{
		_layout = GetNodeOrNull<HBoxContainer>("Layout");
		if (_layout is null) return false;

		_sidebar = GetNodeOrNull<Control>("Layout/Sidebar");
		_playArea = GetNodeOrNull<Control>("Layout/PlayArea");
		_specialCardsRow = GetNodeOrNull<HBoxContainer>("Layout/PlayArea/PlayRoot/SpecialCards");
		_matrixWrapper = GetNodeOrNull<Control>("Layout/PlayArea/PlayRoot/MatrixWrapper");
		_matrixGrid = GetNodeOrNull<GridContainer>("Layout/PlayArea/PlayRoot/MatrixWrapper/MatrixGrid");
		_previewBox = GetNodeOrNull<Control>("Layout/PlayArea/PlayRoot/MatrixWrapper/PreviewBox");
		_bottomArea = GetNodeOrNull<Control>("Layout/PlayArea/PlayRoot/BottomArea");
		_handRow = GetNodeOrNull<Control>("Layout/PlayArea/PlayRoot/BottomArea/HandRow");

		_uiLevelIcon = GetNodeOrNull<TextureRect>("Layout/Sidebar/SidebarRoot/StageBox/LevelIcon");
		_uiLevel = GetNodeOrNull<Label>("Layout/Sidebar/SidebarRoot/StageBox/StageCopy/Level");
		_uiLevelName = GetNodeOrNull<Label>("Layout/Sidebar/SidebarRoot/StageBox/StageCopy/LevelName");
		_uiGoal = GetNodeOrNull<Label>("Layout/Sidebar/SidebarRoot/StageBox/Goal");
		_uiScore = GetNodeOrNull<Label>("Layout/Sidebar/SidebarRoot/ScoreRow/Score");
		_uiChips = GetNodeOrNull<Label>("Layout/Sidebar/SidebarRoot/ChipsRow/Chips");
		_uiInterestPreview = GetNodeOrNull<Label>("Layout/Sidebar/SidebarRoot/InterestPreview");
		_uiShuffleCount = GetNodeOrNull<Label>("Layout/Sidebar/SidebarRoot/DeckActions/ShuffleCount");
		_uiDealCount = GetNodeOrNull<Label>("Layout/Sidebar/SidebarRoot/DeckActions/DealCount");
		_uiDeckCount = GetNodeOrNull<Label>("Layout/PlayArea/PlayRoot/BottomArea/DeckPile/DeckCount");
		_uiDiscardCount = GetNodeOrNull<Label>("Layout/PlayArea/PlayRoot/BottomArea/DiscardPile/DiscardCount");

		_overlayLayer = GetNodeOrNull<CanvasLayer>("Overlay");
		_heldCard = GetNodeOrNull<TextureRect>("Overlay/HeldCard");
		_statusOverlay = GetNodeOrNull<Control>("StatusOverlay");
		_statusOverlayContent = GetNodeOrNull<VBoxContainer>("StatusOverlay/Content");

		return _sidebar is not null
			&& _playArea is not null
			&& _specialCardsRow is not null
			&& _matrixWrapper is not null
			&& _matrixGrid is not null
			&& _previewBox is not null
			&& _bottomArea is not null
			&& _handRow is not null
			&& _uiLevel is not null
			&& _uiLevelName is not null
			&& _uiGoal is not null
			&& _uiScore is not null
			&& _uiChips is not null
			&& _uiInterestPreview is not null
			&& _uiShuffleCount is not null
			&& _uiDealCount is not null
			&& _uiDeckCount is not null
			&& _uiDiscardCount is not null
			&& _overlayLayer is not null
			&& _heldCard is not null
			&& _statusOverlay is not null
			&& _statusOverlayContent is not null;
	}

	private void WireSceneUi()
	{
		if (_uiLevelIcon is not null)
		{
			var state = _store?.GetState();
			if (state is not null)
			{
				_uiLevelIcon.Texture = _assets.GetLevelIcon(state.LevelIcon);
			}
		}

		var deckIcon = GetNodeOrNull<TextureRect>("Layout/PlayArea/PlayRoot/BottomArea/DeckPile/DeckIcon");
		if (deckIcon is not null) deckIcon.Texture = _assets.GetDeckBack();

		var discardIcon = GetNodeOrNull<TextureRect>("Layout/PlayArea/PlayRoot/BottomArea/DiscardPile/DiscardIcon");
		if (discardIcon is not null) discardIcon.Texture = _assets.GetDiscardBack();

		var shuffleBtn = GetNodeOrNull<Button>("Layout/Sidebar/SidebarRoot/DeckActions/ShuffleBtn");
		if (shuffleBtn is not null)
		{
			shuffleBtn.Pressed += () => _store?.ShuffleMatrix();
		}

		var dealBtn = GetNodeOrNull<Button>("Layout/Sidebar/SidebarRoot/DeckActions/DealBtn");
		if (dealBtn is not null)
		{
			dealBtn.Pressed += () => _store?.DealHand();
		}

		var endBtn = GetNodeOrNull<Button>("Layout/Sidebar/SidebarRoot/ActionRow/EndBtn");
		if (endBtn is not null)
		{
			endBtn.Pressed += () => _store?.ResetGame();
		}

		var rotateBtn = GetNodeOrNull<Button>("Layout/Sidebar/SidebarRoot/ActionRow/RotateBtn");
		if (rotateBtn is not null)
		{
			rotateBtn.Pressed += () => _store?.FlipSelectedCard();
		}

		var deckPile = GetNodeOrNull<Control>("Layout/PlayArea/PlayRoot/BottomArea/DeckPile");
		if (deckPile is not null)
		{
			deckPile.GuiInput += e => OnPileClick(true, e);
		}

		var discardPile = GetNodeOrNull<Control>("Layout/PlayArea/PlayRoot/BottomArea/DiscardPile");
		if (discardPile is not null)
		{
			discardPile.GuiInput += e => OnPileClick(false, e);
		}

		if (_bottomArea is not null)
		{
			_bottomArea.MouseEntered += () => _store?.UpdatePreview(null);
		}

		WireDropZone(InsertEdge.Top, "DropZoneTop");
		WireDropZone(InsertEdge.Bottom, "DropZoneBottom");
		WireDropZone(InsertEdge.Left, "DropZoneLeft");
		WireDropZone(InsertEdge.Right, "DropZoneRight");

		if (_previewBox is not null)
		{
			_previewBox.GuiInput += e =>
			{
				if (e is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left })
				{
					var edge = _store?.GetLastPreviewEdge();
					if (edge is not null)
					{
						HandleClash(edge.Value);
					}
				}
			};
		}
	}

	private void WireDropZone(InsertEdge edge, string nodeName)
	{
		var dz = GetNodeOrNull<Control>($"Layout/PlayArea/PlayRoot/MatrixWrapper/{nodeName}");
		if (dz is null) return;

		dz.GuiInput += e => OnDropZoneInput(edge, dz, e);
		dz.MouseEntered += () => { _isAttaching = true; };
		dz.MouseExited += () =>
		{
			_isAttaching = false;
			_store?.UpdatePreview(null);
		};
	}

	public override void _ExitTree()
	{
		if (_store is not null)
		{
			_store.StateChanged -= OnStoreStateChanged;
		}
	}

	public override void _Process(double delta)
	{
		UpdateHeldCard();
	}

	private void BuildUiTree()
	{
		AnchorsPreset = (int)LayoutPreset.FullRect;
		SizeFlagsHorizontal = SizeFlags.ExpandFill;
		SizeFlagsVertical = SizeFlags.ExpandFill;

		_layout = new HBoxContainer
		{
			Name = "Layout",
			SizeFlagsHorizontal = SizeFlags.ExpandFill,
			SizeFlagsVertical = SizeFlags.ExpandFill
		};
		_layout.AnchorsPreset = (int)LayoutPreset.FullRect;
		AddChild(_layout);

		_sidebar = BuildSidebar();
		_layout.AddChild(_sidebar);

		_playArea = BuildPlayArea();
		_layout.AddChild(_playArea);

		_overlayLayer = new CanvasLayer { Name = "Overlay" };
		AddChild(_overlayLayer);

		_heldCard = new TextureRect
		{
			Name = "HeldCard",
			Visible = false,
			ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
			StretchMode = TextureRect.StretchModeEnum.Scale,
			MouseFilter = MouseFilterEnum.Ignore
		};
		_overlayLayer.AddChild(_heldCard);

		_statusOverlay = new PanelContainer
		{
			Name = "StatusOverlay",
			Visible = false,
			AnchorsPreset = (int)LayoutPreset.FullRect,
			MouseFilter = MouseFilterEnum.Stop
		};
		AddChild(_statusOverlay);

		_statusOverlayContent = new VBoxContainer
		{
			Name = "Content",
			AnchorsPreset = (int)LayoutPreset.Center,
			OffsetLeft = -260,
			OffsetTop = -220,
			OffsetRight = 260,
			OffsetBottom = 220,
			SizeFlagsHorizontal = SizeFlags.ShrinkCenter,
			SizeFlagsVertical = SizeFlags.ShrinkCenter
		};
		_statusOverlay.AddChild(_statusOverlayContent);

		ApplyBasicTheme();
	}

	private void ApplyBasicTheme()
	{
		var sidebarStyle = new StyleBoxFlat
		{
			BgColor = new Color(0.1843f, 0.2471f, 0.2706f),
			ContentMarginLeft = 14,
			ContentMarginRight = 14,
			ContentMarginTop = 14,
			ContentMarginBottom = 14
		};

		if (_sidebar is PanelContainer sidebarPanel)
		{
			sidebarPanel.AddThemeStyleboxOverride("panel", sidebarStyle);
		}

		if (_statusOverlay is PanelContainer overlayPanel)
		{
			var overlayStyle = new StyleBoxFlat { BgColor = new Color(0, 0, 0, 0.72f) };
			overlayPanel.AddThemeStyleboxOverride("panel", overlayStyle);
		}
	}

	private Control BuildSidebar()
	{
		var sidebar = new PanelContainer
		{
			Name = "Sidebar",
			CustomMinimumSize = new Vector2(280, 0),
			SizeFlagsVertical = SizeFlags.ExpandFill
		};

		var root = new VBoxContainer
		{
			Name = "Root",
			SizeFlagsHorizontal = SizeFlags.ExpandFill,
			SizeFlagsVertical = SizeFlags.ExpandFill
		};
		sidebar.AddChild(root);

		var header = new HBoxContainer { Name = "Header", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		root.AddChild(header);

		var title = new Label
		{
			Text = "Roshambo!",
			SizeFlagsHorizontal = SizeFlags.ExpandFill,
			HorizontalAlignment = HorizontalAlignment.Center
		};
		title.AddThemeFontSizeOverride("font_size", 24);
		title.AddThemeColorOverride("font_color", Colors.White);
		header.AddChild(title);

		var btnLang = new Button { Text = "EN", CustomMinimumSize = new Vector2(48, 48) };
		btnLang.Disabled = true;
		header.AddChild(btnLang);

		var stageBox = new HBoxContainer { Name = "StageBox", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		stageBox.AddThemeConstantOverride("separation", 12);
		root.AddChild(stageBox);

		var icon = new TextureRect
		{
			Name = "LevelIcon",
			CustomMinimumSize = new Vector2(46, 46),
			ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
			StretchMode = TextureRect.StretchModeEnum.Scale
		};
		stageBox.AddChild(icon);

		var stageCopy = new VBoxContainer { Name = "StageCopy", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		stageBox.AddChild(stageCopy);

		_uiLevel = new Label { Name = "Level", Text = "STAGE 1/9" };
		_uiLevel.AddThemeColorOverride("font_color", new Color(0.6235f, 0.7059f, 0.7529f));
		_uiLevel.AddThemeFontSizeOverride("font_size", 13);
		stageCopy.AddChild(_uiLevel);

		_uiLevelName = new Label { Name = "LevelName", Text = "Pocket" };
		_uiLevelName.AddThemeFontSizeOverride("font_size", 20);
		stageCopy.AddChild(_uiLevelName);

		_uiGoal = new Label
		{
			Name = "Goal",
			Text = "10",
			HorizontalAlignment = HorizontalAlignment.Right,
			SizeFlagsHorizontal = SizeFlags.ShrinkEnd
		};
		_uiGoal.AddThemeFontSizeOverride("font_size", 24);
		_uiGoal.AddThemeColorOverride("font_color", new Color(1f, 0.5961f, 0f));
		stageBox.AddChild(_uiGoal);

		root.AddChild(BuildScoreBox("SCORE", out _uiScore, Colors.White));
		root.AddChild(BuildScoreBox("CHIPS", out _uiChips, new Color(1f, 0.8431f, 0f)));

		_uiInterestPreview = new Label { Text = "+0", HorizontalAlignment = HorizontalAlignment.Right };
		_uiInterestPreview.AddThemeColorOverride("font_color", new Color(0.4863f, 1f, 0.5608f));
		root.AddChild(_uiInterestPreview);

		var deckActions = new HBoxContainer { Name = "DeckActions", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		deckActions.AddThemeConstantOverride("separation", 10);
		root.AddChild(deckActions);

		var shuffleBtn = new Button { Name = "ShuffleBtn", Text = "SHUFFLE", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		shuffleBtn.Pressed += () => _store?.ShuffleMatrix();
		deckActions.AddChild(shuffleBtn);

		_uiShuffleCount = new Label { Name = "ShuffleCount", Text = "4", HorizontalAlignment = HorizontalAlignment.Center };
		deckActions.AddChild(_uiShuffleCount);

		var dealBtn = new Button { Name = "DealBtn", Text = "DEAL CARD", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		dealBtn.Pressed += () => _store?.DealHand();
		deckActions.AddChild(dealBtn);

		_uiDealCount = new Label { Name = "DealCount", Text = "4", HorizontalAlignment = HorizontalAlignment.Center };
		deckActions.AddChild(_uiDealCount);

		var actionRow = new HBoxContainer { Name = "ActionRow", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		actionRow.AddThemeConstantOverride("separation", 10);
		root.AddChild(actionRow);

		var endBtn = new Button { Text = "END", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		endBtn.Pressed += () => _store?.ResetGame();
		actionRow.AddChild(endBtn);

		var rotateBtn = new Button { Text = "Rotate", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		rotateBtn.Pressed += () => _store?.FlipSelectedCard();
		actionRow.AddChild(rotateBtn);

		return sidebar;
	}

	private Control BuildScoreBox(string label, out Label valueLabel, Color valueColor)
	{
		var box = new HBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill };
		box.AddThemeConstantOverride("separation", 10);

		var lbl = new Label { Text = label, SizeFlagsHorizontal = SizeFlags.ExpandFill };
		lbl.AddThemeFontSizeOverride("font_size", 16);
		box.AddChild(lbl);

		valueLabel = new Label { Text = "0", HorizontalAlignment = HorizontalAlignment.Right };
		valueLabel.AddThemeFontSizeOverride("font_size", 18);
		valueLabel.AddThemeColorOverride("font_color", valueColor);
		box.AddChild(valueLabel);

		return box;
	}

	private Control BuildPlayArea()
	{
		var play = new Control
		{
			Name = "PlayArea",
			SizeFlagsHorizontal = SizeFlags.ExpandFill,
			SizeFlagsVertical = SizeFlags.ExpandFill
		};

		var root = new VBoxContainer { Name = "Root", SizeFlagsHorizontal = SizeFlags.ExpandFill, SizeFlagsVertical = SizeFlags.ExpandFill };
		root.AnchorsPreset = (int)LayoutPreset.FullRect;
		play.AddChild(root);

		_specialCardsRow = new HBoxContainer { Name = "SpecialCards", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		_specialCardsRow.AddThemeConstantOverride("separation", 8);
		root.AddChild(_specialCardsRow);

		_matrixWrapper = new Control { Name = "MatrixWrapper", SizeFlagsHorizontal = SizeFlags.ExpandFill, SizeFlagsVertical = SizeFlags.ExpandFill };
		root.AddChild(_matrixWrapper);

		_matrixGrid = new GridContainer { Name = "MatrixGrid", Columns = 3 };
		_matrixGrid.AnchorLeft = 0.5f;
		_matrixGrid.AnchorTop = 0.5f;
		_matrixGrid.AnchorRight = 0.5f;
		_matrixGrid.AnchorBottom = 0.5f;
		_matrixGrid.OffsetLeft = -180;
		_matrixGrid.OffsetTop = -180;
		_matrixGrid.OffsetRight = 180;
		_matrixGrid.OffsetBottom = 180;
		_matrixWrapper.AddChild(_matrixGrid);

		foreach (var edge in new[] { InsertEdge.Top, InsertEdge.Bottom, InsertEdge.Left, InsertEdge.Right })
		{
			var dz = new Control { Name = $"DropZone{edge}", MouseFilter = MouseFilterEnum.Stop };
			_matrixWrapper.AddChild(dz);

			dz.GuiInput += (InputEvent e) => OnDropZoneInput(edge, dz, e);
			dz.MouseEntered += () => { _isAttaching = true; };
			dz.MouseExited += () =>
			{
				_isAttaching = false;
				_store?.UpdatePreview(null);
			};
		}

		_previewBox = new Control
		{
			Name = "PreviewBox",
			MouseFilter = MouseFilterEnum.Stop,
			Visible = false
		};
		_previewBox.GuiInput += e =>
		{
			if (e is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left })
			{
				var edge = _store?.GetLastPreviewEdge();
				if (edge is not null)
				{
					HandleClash(edge.Value);
				}
			}
		};
		_matrixWrapper.AddChild(_previewBox);

		_bottomArea = new HBoxContainer
		{
			Name = "BottomArea",
			SizeFlagsHorizontal = SizeFlags.ExpandFill,
			CustomMinimumSize = new Vector2(0, 170)
		};
		_bottomArea.MouseEntered += () => _store?.UpdatePreview(null);
		root.AddChild(_bottomArea);

		var deckPile = BuildPileIcon(_assets.GetDeckBack(), "DECK", out _uiDeckCount);
		deckPile.GuiInput += e => OnPileClick(true, e);
		_bottomArea.AddChild(deckPile);

		_handRow = new VBoxContainer { Name = "HandRow", SizeFlagsHorizontal = SizeFlags.ExpandFill };
		_bottomArea.AddChild(_handRow);

		var discardPile = BuildPileIcon(_assets.GetDiscardBack(), "WASTED", out _uiDiscardCount);
		discardPile.GuiInput += e => OnPileClick(false, e);
		_bottomArea.AddChild(discardPile);

		return play;
	}

	private Control BuildPileIcon(Texture2D? tex, string label, out Label countLabel)
	{
		var root = new VBoxContainer
		{
			CustomMinimumSize = new Vector2(110, 150),
			MouseFilter = MouseFilterEnum.Stop
		};

		var icon = new TextureRect
		{
			Texture = tex,
			CustomMinimumSize = new Vector2(92, 124),
			ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
			StretchMode = TextureRect.StretchModeEnum.Scale
		};
		root.AddChild(icon);

		countLabel = new Label { Text = "0", HorizontalAlignment = HorizontalAlignment.Center };
		root.AddChild(countLabel);

		var lbl = new Label { Text = label, HorizontalAlignment = HorizontalAlignment.Center };
		lbl.AddThemeFontSizeOverride("font_size", 12);
		root.AddChild(lbl);

		return root;
	}

	private void OnPileClick(bool isDeck, InputEvent e)
	{
		if (e is not InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left }) return;
		ShowPileModal(isDeck);
	}

	private void ShowPileModal(bool isDeck)
	{
		if (_store is null || _statusOverlay is null || _statusOverlayContent is null) return;
		_statusOverlay.Visible = true;
		_statusOverlayContent.QueueFreeChildren();

		var state = _store.GetState();
		var list = isDeck ? state.Deck : state.DiscardPile;

		var header = new Label { Text = isDeck ? "DECK" : "WASTED", HorizontalAlignment = HorizontalAlignment.Center };
		header.AddThemeFontSizeOverride("font_size", 24);
		_statusOverlayContent.AddChild(header);

		var scroll = new ScrollContainer { CustomMinimumSize = new Vector2(520, 340) };
		_statusOverlayContent.AddChild(scroll);
		var grid = new GridContainer { Columns = 6, SizeFlagsHorizontal = SizeFlags.ExpandFill };
		scroll.AddChild(grid);

		foreach (var card in list)
		{
			grid.AddChild(BuildCardTexture(card, 64, clickable: false));
		}

		var close = new Button { Text = "Close" };
		close.Pressed += () => _statusOverlay.Visible = false;
		_statusOverlayContent.AddChild(close);
	}

	private void OnDropZoneInput(InsertEdge edge, Control zone, InputEvent e)
	{
		if (_store is null) return;
		if (_store.GetState().Status != GameStatus.Playing) return;

		if (e is InputEventMouseMotion mm)
		{
			var ratio = GetPointerRatio(edge, zone, mm.Position);
			_store.UpdatePreview(edge, ratio);
		}

		if (e is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left })
		{
			if (_store.GetState().SelectedCardIds.Count > 0)
			{
				HandleClash(edge);
			}
		}
	}

	private static float GetPointerRatio(InsertEdge edge, Control zone, Vector2 localPos)
	{
		var size = zone.Size;
		return edge is InsertEdge.Top or InsertEdge.Bottom
			? (size.X <= 0 ? 0.5f : Mathf.Clamp(localPos.X / size.X, 0f, 1f))
			: (size.Y <= 0 ? 0.5f : Mathf.Clamp(localPos.Y / size.Y, 0f, 1f));
	}

	private void HandleClash(InsertEdge edge)
	{
		if (_store is null) return;
		var res = _store.PlaySelectedToEdge(edge);
		if (res is null) return;

		_store.ApplyClashResult(res);
	}

	private void OnStoreStateChanged()
	{
		Render();
	}

	private void Render()
	{
		if (_store is null) return;
		var state = _store.GetState();

		_uiLevel!.Text = $"STAGE {state.CurrentStage}/{state.TotalStages}";
		_uiLevelName!.Text = state.LevelName;
		if (_uiLevelIcon is not null)
		{
			_uiLevelIcon.Texture = _assets.GetLevelIcon(state.LevelIcon);
		}
		_uiGoal!.Text = state.LevelGoal.ToString();
		_uiScore!.Text = state.CurrentScore.ToString();
		_uiChips!.Text = state.Chips.ToString();
		_uiInterestPreview!.Text = $"+{_store.GetProjectedInterest()}";
		_uiShuffleCount!.Text = state.ShufflesLeft.ToString();
		_uiDealCount!.Text = state.DealsLeft.ToString();
		_uiDeckCount!.Text = state.Deck.Count.ToString();
		_uiDiscardCount!.Text = state.DiscardPile.Count.ToString();

		RenderSpecialCards(state);
		RenderMatrix(state);
		RenderHand(state);
		RenderDropZones(state);
		RenderOverlay(state);
	}

	private void RenderSpecialCards(GameState state)
	{
		if (_specialCardsRow is null) return;
		_specialCardsRow.QueueFreeChildren();
		foreach (var instance in state.SpecialCards)
		{
			var def = SpecialCardRegistry.GetDefinition(instance.DefinitionId);
			if (def is null) continue;
			var pill = new Label { Text = def.ShortName };
			pill.AddThemeColorOverride("font_color", Colors.White);
			_specialCardsRow.AddChild(pill);
		}
	}

	private void RenderMatrix(GameState state)
	{
		if (_matrixGrid is null) return;
		_matrixGrid.QueueFreeChildren();

		_matrixGrid.Columns = state.Matrix.Size;
		var cellSize = Mathf.Clamp(540f / state.Matrix.Size, 110f, 160f);
		_matrixGrid.OffsetLeft = -cellSize * state.Matrix.Size * 0.5f;
		_matrixGrid.OffsetTop = -cellSize * state.Matrix.Size * 0.5f;
		_matrixGrid.OffsetRight = cellSize * state.Matrix.Size * 0.5f;
		_matrixGrid.OffsetBottom = cellSize * state.Matrix.Size * 0.5f;

		for (var r = 0; r < state.Matrix.Size; r++)
		for (var c = 0; c < state.Matrix.Size; c++)
		{
			var sym = state.Matrix.Grid[r, c];
			var tex = sym == Rps.Tricolor ? _assets.GetTricolorBlock() : _assets.GetBlock(sym);
			var cell = new TextureRect
			{
				Texture = tex,
				CustomMinimumSize = new Vector2(cellSize, cellSize),
				ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
				StretchMode = TextureRect.StretchModeEnum.Scale
			};
			_matrixGrid.AddChild(cell);
		}

		if (_previewBox is not null)
		{
			_previewBox.Visible = state.Preview is not null;
			if (state.Preview is not null)
			{
				var rect = state.Matrix.Size * cellSize;
				_previewBox.AnchorLeft = 0.5f;
				_previewBox.AnchorTop = 0.5f;
				_previewBox.AnchorRight = 0.5f;
				_previewBox.AnchorBottom = 0.5f;
				_previewBox.OffsetLeft = -rect * 0.5f - 10;
				_previewBox.OffsetTop = -rect * 0.5f - 10;
				_previewBox.OffsetRight = rect * 0.5f + 10;
				_previewBox.OffsetBottom = rect * 0.5f + 10;

				_previewBox.QueueFreeChildren();

				var outline = new ColorRect
				{
					Color = new Color(1f, 1f, 1f, 0.08f),
					AnchorsPreset = (int)LayoutPreset.FullRect,
					MouseFilter = MouseFilterEnum.Ignore
				};
				_previewBox.AddChild(outline);

				var card = state.Hand.FirstOrDefault(c => c.Id == state.Preview.InsertedCardId);
				var edge = _store?.GetLastPreviewEdge();
				if (card is not null && edge is not null)
				{
					var laneOffset = state.Preview.AttachmentOffset;

					for (var i = 0; i < Constants.CardLength; i++)
					{
						var laneIndex = laneOffset + i;
						if (laneIndex < 0 || laneIndex >= state.Matrix.Size) continue;

						var sym = card.Symbols[i];
						var tex = sym == Rps.Tricolor ? _assets.GetTricolorBlock() : _assets.GetBlock(sym);
						var frag = new TextureRect
						{
							Texture = tex,
							CustomMinimumSize = new Vector2(cellSize, cellSize),
							ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
							StretchMode = TextureRect.StretchModeEnum.Scale,
							MouseFilter = MouseFilterEnum.Ignore
						};

						var local = Vector2.Zero;
						switch (edge.Value)
						{
							case InsertEdge.Top:
								local = new Vector2(laneIndex * cellSize, 0);
								break;
							case InsertEdge.Bottom:
								local = new Vector2(laneIndex * cellSize, rect - cellSize);
								break;
							case InsertEdge.Left:
								local = new Vector2(0, laneIndex * cellSize);
								break;
							case InsertEdge.Right:
								local = new Vector2(rect - cellSize, laneIndex * cellSize);
								break;
						}

						frag.Position = local;
						_previewBox.AddChild(frag);
					}
				}
			}
			else
			{
				_previewBox.QueueFreeChildren();
			}
		}
	}

	private void RenderHand(GameState state)
	{
		if (_handRow is null) return;
		_handRow.QueueFreeChildren();

		HBoxContainer row;
		if (_handRow is HBoxContainer asRow)
		{
			row = asRow;
		}
		else
		{
			row = new HBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill };
			_handRow.AddChild(row);
		}
		row.AddThemeConstantOverride("separation", 12);
		row.QueueFreeChildren();

		for (var i = 0; i < state.Hand.Count; i++)
		{
			var card = state.Hand[i];
			var isSelected = state.SelectedCardIds.Contains(card.Id);
			var view = BuildCardTexture(card, 96, clickable: true);
			if (isSelected)
			{
				view.Modulate = new Color(1f, 1f, 1f, 1f);
				view.Scale = new Vector2(1.06f, 1.06f);
			}
			else
			{
				view.Modulate = new Color(0.9f, 0.9f, 0.9f, 1f);
			}
			row.AddChild(view);
		}
	}

	private Control BuildCardTexture(Card card, float width, bool clickable)
	{
		Control node;

		if (card.Symbols.Contains(Rps.Tricolor))
		{
			var v = new VBoxContainer { CustomMinimumSize = new Vector2(width, width * 1.5f), MouseFilter = clickable ? MouseFilterEnum.Stop : MouseFilterEnum.Ignore };
			for (var i = 0; i < card.Symbols.Length; i++)
			{
				var sym = card.Symbols[i];
				var tex = sym == Rps.Tricolor ? _assets.GetTricolorBlock() : _assets.GetBlock(sym);
				v.AddChild(new TextureRect
				{
					Texture = tex,
					CustomMinimumSize = new Vector2(width, width * 0.48f),
					ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
					StretchMode = TextureRect.StretchModeEnum.Scale
				});
			}
			node = v;
		}
		else
		{
			var code = string.Concat(card.Symbols.Select(ToCodeDigit));
			var tex = _assets.GetCardFull(code);
			node = new TextureRect
			{
				Texture = tex,
				CustomMinimumSize = new Vector2(width, width * 1.5f),
				ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
				StretchMode = TextureRect.StretchModeEnum.Scale,
				MouseFilter = clickable ? MouseFilterEnum.Stop : MouseFilterEnum.Ignore
			};
		}

		if (clickable)
		{
			node.GuiInput += e =>
			{
				if (e is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left })
				{
					_store?.SelectCard(card.Id);
				}
			};
		}

		return node;
	}

	private static char ToCodeDigit(Rps sym)
	{
		return sym switch
		{
			Rps.Blank => '0',
			Rps.Paper => '1',
			Rps.Scissors => '3',
			Rps.Rock => '4',
			Rps.Tricolor => '7',
			_ => '0'
		};
	}

	private void RenderDropZones(GameState state)
	{
		if (_matrixWrapper is null || _matrixGrid is null) return;
		var matrixRect = _matrixGrid.GetGlobalRect();

		foreach (var child in _matrixWrapper.GetChildren())
		{
			if (child is not Control dz) continue;
			var name = dz.Name.ToString();
			if (!name.StartsWith("DropZone", StringComparison.Ordinal)) continue;
			var edgeName = name["DropZone".Length..];
			if (!Enum.TryParse<InsertEdge>(edgeName, out var edge)) continue;

			const float thickness = 60f;
			switch (edge)
			{
				case InsertEdge.Top:
					SetZoneRect(dz, matrixRect.Position + new Vector2(0, -thickness), new Vector2(matrixRect.Size.X, thickness));
					break;
				case InsertEdge.Bottom:
					SetZoneRect(dz, matrixRect.Position + new Vector2(0, matrixRect.Size.Y), new Vector2(matrixRect.Size.X, thickness));
					break;
				case InsertEdge.Left:
					SetZoneRect(dz, matrixRect.Position + new Vector2(-thickness, 0), new Vector2(thickness, matrixRect.Size.Y));
					break;
				case InsertEdge.Right:
					SetZoneRect(dz, matrixRect.Position + new Vector2(matrixRect.Size.X, 0), new Vector2(thickness, matrixRect.Size.Y));
					break;
			}
		}
	}

	private void RenderOverlay(GameState state)
	{
		if (_statusOverlay is null || _statusOverlayContent is null) return;

		if (state.Status is GameStatus.ChooseDeck or GameStatus.RoundReward or GameStatus.Shop or GameStatus.GameOver or GameStatus.Win)
		{
			_statusOverlay.Visible = true;
			_statusOverlayContent.QueueFreeChildren();

			switch (state.Status)
			{
				case GameStatus.ChooseDeck:
					RenderDeckChoice();
					break;
				case GameStatus.RoundReward:
					RenderRoundReward(state);
					break;
				case GameStatus.Shop:
					RenderShop(state);
					break;
				case GameStatus.GameOver:
					RenderEndScreen("GAME OVER", "Restart");
					break;
				case GameStatus.Win:
					RenderEndScreen("YOU WIN", "Restart");
					break;
			}

			return;
		}

		if (!_statusOverlay.Visible) return;
		_statusOverlay.Visible = false;
	}

	private void RenderDeckChoice()
	{
		if (_store is null || _statusOverlayContent is null) return;

		var header = new Label { Text = "CHOOSE DECK", HorizontalAlignment = HorizontalAlignment.Center };
		header.AddThemeFontSizeOverride("font_size", 26);
		_statusOverlayContent.AddChild(header);

		var scroll = new ScrollContainer { CustomMinimumSize = new Vector2(520, 340) };
		_statusOverlayContent.AddChild(scroll);
		var list = new VBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill };
		scroll.AddChild(list);

		foreach (var deck in _store.GetDeckDefinitions())
		{
			var btn = new Button { Text = deck.Name };
			btn.Pressed += () => _store.ChooseDeckById(deck.Id);
			list.AddChild(btn);
		}
	}

	private void RenderRoundReward(GameState state)
	{
		if (_store is null || _statusOverlayContent is null) return;

		var sum = state.PendingReward;
		var header = new Label { Text = "ROUND CLEAR", HorizontalAlignment = HorizontalAlignment.Center };
		header.AddThemeFontSizeOverride("font_size", 26);
		_statusOverlayContent.AddChild(header);

		if (sum is not null)
		{
			_statusOverlayContent.AddChild(new Label { Text = $"Goal: {sum.Goal}" });
			_statusOverlayContent.AddChild(new Label { Text = $"Reward: {sum.BaseReward}" });
			_statusOverlayContent.AddChild(new Label { Text = $"Interest: {sum.InterestReward}" });
			_statusOverlayContent.AddChild(new Label { Text = $"Total: {sum.TotalReward}" });
		}

		var btn = new Button { Text = "Open Shop" };
		btn.Pressed += () => _store.OpenShop();
		_statusOverlayContent.AddChild(btn);
	}

	private void RenderShop(GameState state)
	{
		if (_store is null || _statusOverlayContent is null) return;

		var header = new Label { Text = "SHOP", HorizontalAlignment = HorizontalAlignment.Center };
		header.AddThemeFontSizeOverride("font_size", 26);
		_statusOverlayContent.AddChild(header);

		foreach (var offer in state.ShopOffers)
		{
			var def = SpecialCardRegistry.GetDefinition(offer.DefinitionId);
			var name = def?.Name ?? offer.DefinitionId;
			var row = new HBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill };
			row.AddChild(new Label { Text = $"{name} - {offer.Cost} chips", SizeFlagsHorizontal = SizeFlags.ExpandFill });
			var buy = new Button { Text = offer.Purchased ? "Bought" : "Buy", Disabled = offer.Purchased || state.Chips < offer.Cost };
			buy.Pressed += () => _store.BuyShopOffer(offer.OfferId);
			row.AddChild(buy);
			_statusOverlayContent.AddChild(row);
		}

		var cont = new Button { Text = "Continue" };
		cont.Pressed += () => _store.ContinueAfterShop();
		_statusOverlayContent.AddChild(cont);
	}

	private void RenderEndScreen(string title, string buttonText)
	{
		if (_store is null || _statusOverlayContent is null) return;
		var header = new Label { Text = title, HorizontalAlignment = HorizontalAlignment.Center };
		header.AddThemeFontSizeOverride("font_size", 28);
		_statusOverlayContent.AddChild(header);
		var btn = new Button { Text = buttonText };
		btn.Pressed += () => _store.ResetGame();
		_statusOverlayContent.AddChild(btn);
	}

	private static void SetZoneRect(Control zone, Vector2 globalPos, Vector2 size)
	{
		if (zone.GetParent() is not Control parent) return;
		var local = globalPos - parent.GetGlobalRect().Position;
		zone.Position = local;
		zone.Size = size;
	}

	private void UpdateHeldCard()
	{
		if (_store is null || _heldCard is null || _sidebar is null || _bottomArea is null) return;
		var state = _store.GetState();
		if (state.Status != GameStatus.Playing || state.SelectedCardIds.Count == 0)
		{
			_heldCard.Visible = false;
			return;
		}

		if (_isAttaching)
		{
			_heldCard.Visible = false;
			return;
		}

		var lastId = state.SelectedCardIds[^1];
		var card = state.Hand.FirstOrDefault(c => c.Id == lastId);
		if (card is null)
		{
			_heldCard.Visible = false;
			return;
		}

		var globalMouse = GetGlobalMousePosition();
		if (_sidebar.GetGlobalRect().HasPoint(globalMouse) || _bottomArea.GetGlobalRect().HasPoint(globalMouse))
		{
			_heldCard.Visible = false;
			_store.UpdatePreview(null);
			return;
		}

		var tex = card.Symbols.Contains(Rps.Tricolor) ? _assets.GetTricolorBlock() : _assets.GetCardFull(string.Concat(card.Symbols.Select(ToCodeDigit)));
		_heldCard.Texture = tex;
		_heldCard.CustomMinimumSize = new Vector2(96, 144);
		_heldCard.Position = globalMouse + new Vector2(16, 16);
		_heldCard.Visible = tex is not null;
	}
}

public static class NodeExtensions
{
	public static void QueueFreeChildren(this Node node)
	{
		foreach (var child in node.GetChildren())
		{
			child.QueueFree();
		}
	}
}
