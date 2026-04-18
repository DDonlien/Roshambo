using Godot;
using Roshambo.State;
using Roshambo.UI;

namespace Roshambo;

public partial class Main : Control
{
	private GameStore? _store;
	private GameUI? _ui;

	public override void _Ready()
	{
		_store = GetNodeOrNull<GameStore>("Store");
		if (_store is null)
		{
			GD.PushError("Store node missing.");
			return;
		}

		_ui = GetNodeOrNull<GameUI>("UI");
		if (_ui is null)
		{
			GD.PushError("UI node missing.");
			return;
		}

		_ui.Initialize(_store);
	}
}
