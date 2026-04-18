using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Godot;
using Roshambo.Domain;

namespace Roshambo.UI;

public sealed class AssetCatalog
{
	private readonly Dictionary<string, Texture2D> _cardTextures = new();
	private readonly Dictionary<Rps, Texture2D> _blockTextures = new();
	private Texture2D? _triColorTexture;
	private readonly Dictionary<string, Texture2D> _iconTextures = new();
	private Texture2D? _deckBack;
	private Texture2D? _discardBack;

	public Texture2D? GetCardFull(string code)
	{
		return _cardTextures.TryGetValue(code, out var tex) ? tex : null;
	}

	public Texture2D? GetBlock(Rps symbol)
	{
		return _blockTextures.TryGetValue(symbol, out var tex) ? tex : null;
	}

	public Texture2D GetTricolorBlock()
	{
		_triColorTexture ??= BuildTriColorTexture(128);
		return _triColorTexture;
	}

	public Texture2D? GetLevelIcon(string icon)
	{
		return _iconTextures.TryGetValue(icon, out var tex) ? tex : null;
	}

	public Texture2D? GetDeckBack()
	{
		return _deckBack;
	}

	public Texture2D? GetDiscardBack()
	{
		return _discardBack;
	}

	public void LoadAll()
	{
		LoadCardAssets("res://Definitions/cardasset.csv");
		LoadBlockAssets("res://Definitions/blockasset.csv");
		_iconTextures["pocket"] = LoadTexture("res://Assets/Sketch/icon_pocket.png");
		_iconTextures["rubik"] = LoadTexture("res://Assets/Sketch/icon_rubik.png");
		_iconTextures["master"] = LoadTexture("res://Assets/Sketch/icon_master.png");
		_deckBack = LoadTexture("res://Assets/asset/cardback_deck.png");
		_discardBack = LoadTexture("res://Assets/asset/cardback_wasted.png");
	}

	private void LoadCardAssets(string csvPath)
	{
		if (!Godot.FileAccess.FileExists(csvPath)) return;
		using var f = Godot.FileAccess.Open(csvPath, Godot.FileAccess.ModeFlags.Read);
		var lines = f.GetAsText().Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0);
		foreach (var line in lines)
		{
			var parts = line.Split(',').Select(p => p.Trim()).ToArray();
			if (parts.Length < 2) continue;
			var code = parts[0];
			var rel = parts[1];
			var resPath = NormalizePublicPath(rel);
			var tex = LoadTexture(resPath);
			if (tex is null) continue;
			_cardTextures[code] = tex;
		}
	}

	private void LoadBlockAssets(string csvPath)
	{
		if (!Godot.FileAccess.FileExists(csvPath)) return;
		using var f = Godot.FileAccess.Open(csvPath, Godot.FileAccess.ModeFlags.Read);
		var lines = f.GetAsText().Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0);
		foreach (var line in lines)
		{
			var parts = line.Split(',').Select(p => p.Trim()).ToArray();
			if (parts.Length < 2) continue;
			if (!Enum.TryParse<Rps>(parts[0], true, out var symbol)) continue;
			var tex = LoadTexture(NormalizePublicPath(parts[1]));
			if (tex is null) continue;
			_blockTextures[symbol] = tex;
		}
	}

	private static string NormalizePublicPath(string publicRel)
	{
		var rel = publicRel.Trim();
		if (rel.StartsWith("./", StringComparison.Ordinal)) rel = rel[2..];
		return $"res://Assets/{rel}";
	}

	private static Texture2D LoadTexture(string path)
	{
		var tex = ResourceLoader.Load<Texture2D>(path);
		return tex;
	}

	private static Texture2D BuildTriColorTexture(int size)
	{
		var image = Image.CreateEmpty(size, size, false, Image.Format.Rgba8);
		image.Fill(Colors.Transparent);

		var red = new Color(0.9569f, 0.2627f, 0.2118f, 1f);
		var blue = new Color(0.1294f, 0.5882f, 0.9529f, 1f);
		var orange = new Color(1f, 0.5961f, 0f, 1f);

		for (var y = 0; y < size; y++)
		for (var x = 0; x < size; x++)
		{
			var fx = (x + 0.5f) / size;
			var fy = (y + 0.5f) / size;

			Color col;
			if (fy < 0.5f && Math.Abs(fx - 0.5f) < (0.5f - fy))
			{
				col = orange;
			}
			else if (fx < 0.5f)
			{
				col = red;
			}
			else
			{
				col = blue;
			}

			image.SetPixel(x, y, col);
		}

		return ImageTexture.CreateFromImage(image);
	}
}
