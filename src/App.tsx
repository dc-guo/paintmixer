import { useEffect, useRef, useState } from 'react';
import { PaletteDetailPage } from './pages/PaletteDetailPage';
import { PalettesPage } from './pages/PalettesPage';
import { StartPage } from './pages/StartPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { extractPaletteFromDataUrl } from './lib/paletteExtraction';
import type { ExtractedColor } from './lib/paletteExtraction';
import { createArtworkThumbnail } from './lib/thumbnails';
import {
  clampPaletteSize,
  createId,
  loadOwnedPaintIds,
  loadPaletteSize,
  loadSavedPalettes,
  persistOwnedPaintIds,
  persistPaletteSize,
  persistSavedPalettes,
} from './lib/storage';
import type { MixRecipe } from './types/paint';
import type { ColorSource, SampledColor, SavedPalette } from './types/palette';

type Page = 'start' | 'workspace' | 'palettes';

type Route = { page: Page } | { page: 'palette'; paletteId: string };

type Artwork = {
  dataUrl: string;
  name: string;
};

const NAV_ITEMS: Array<{ page: Page; label: string; hash: string }> = [
  { page: 'start', label: 'Start', hash: '#/' },
  { page: 'workspace', label: 'Workspace', hash: '#/workspace' },
  { page: 'palettes', label: 'Saved palettes', hash: '#/palettes' },
];

function routeFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');

  if (hash === 'workspace' || hash === 'palettes') {
    return { page: hash };
  }

  const detail = /^palettes\/(.+)$/.exec(hash);

  if (detail) {
    try {
      return { page: 'palette', paletteId: decodeURIComponent(detail[1]) };
    } catch {
      // Malformed percent-encoding in a shared link; fall back to the gallery.
      return { page: 'palettes' };
    }
  }

  return { page: 'start' };
}

function toSampledColor(extracted: ExtractedColor): SampledColor {
  return {
    id: createId(),
    hex: extracted.hex,
    source: 'auto',
    position: { x: extracted.x, y: extracted.y },
  };
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [workingColors, setWorkingColors] = useState<SampledColor[]>([]);
  const [activeColorId, setActiveColorId] = useState<string | null>(null);
  const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>(loadSavedPalettes);
  const [ownedPaintIds, setOwnedPaintIds] = useState<string[]>(loadOwnedPaintIds);
  const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
  const [paletteSize, setPaletteSize] = useState<number>(loadPaletteSize);
  // Debounce timer for auto-applying palette-size changes to the artwork.
  const regenTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Skip the initial-mount runs: they would rewrite the just-loaded data
  // (including base64 thumbnails) back to localStorage unchanged.
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) {
      persistSavedPalettes(savedPalettes);
    }
  }, [savedPalettes]);

  useEffect(() => {
    if (hasHydrated.current) {
      persistOwnedPaintIds(ownedPaintIds);
    }
  }, [ownedPaintIds]);

  useEffect(() => {
    hasHydrated.current = true;
  }, []);

  const toggleOwnedPaint = (id: string) => {
    setOwnedPaintIds((current) =>
      current.includes(id) ? current.filter((owned) => owned !== id) : [...current, id],
    );
  };

  const navigate = (next: Page) => {
    const item = NAV_ITEMS.find((candidate) => candidate.page === next);
    window.location.hash = item ? item.hash : '#/';
  };

  const addColor = (hex: string, source: ColorSource, position?: SampledColor['position']) => {
    const color: SampledColor = { id: createId(), hex, source, position };
    setWorkingColors((current) => [...current, color]);
    setActiveColorId(color.id);
  };

  const changePaletteSize = (next: number) => {
    // Keep the stored preference and the UI in lockstep, clamped to [3, 8].
    const clamped = clampPaletteSize(next);
    setPaletteSize(clamped);
    persistPaletteSize(clamped);

    // Auto-apply: re-extract at the new size. Debounced so rapid stepping
    // re-extracts once at the size the user lands on, not on every tap.
    if (!artwork) {
      return;
    }
    const { dataUrl } = artwork;
    if (regenTimerRef.current !== null) {
      window.clearTimeout(regenTimerRef.current);
    }
    regenTimerRef.current = window.setTimeout(() => {
      regenTimerRef.current = null;
      void autoGeneratePalette(dataUrl, clamped);
    }, 250);
  };

  /** Re-extracts the palette at the chosen size, replacing the auto-extracted
   * colors while keeping any the user added by hand. Returns the number of fresh
   * colors placed, or null when extraction failed. */
  const autoGeneratePalette = async (
    dataUrl: string,
    size = paletteSize,
  ): Promise<number | null> => {
    try {
      const extracted = await extractPaletteFromDataUrl(dataUrl, size);
      // Keep colors the user added by hex or by clicking the artwork; only the
      // previously auto-extracted colors are replaced by the fresh set.
      const kept = workingColors.filter((color) => color.source !== 'auto');
      const keptHexes = new Set(kept.map((color) => color.hex));
      const fresh = extracted
        .filter((color) => !keptHexes.has(color.hex))
        .map(toSampledColor);

      if (fresh.length === 0) {
        return 0;
      }

      setWorkingColors((current) => {
        // Recompute kept colors against the latest state so anything added while
        // extraction was running survives.
        const keptNow = current.filter((color) => color.source !== 'auto');
        const keptNowHexes = new Set(keptNow.map((color) => color.hex));
        return [...fresh.filter((color) => !keptNowHexes.has(color.hex)), ...keptNow];
      });
      // Move focus to the first fresh color unless a kept color is still selected.
      setActiveColorId((activeId) =>
        activeId && kept.some((color) => color.id === activeId) ? activeId : fresh[0].id,
      );
      return fresh.length;
    } catch {
      return null;
    }
  };

  const selectArtwork = (dataUrl: string, name: string) => {
    // New artwork starts a fresh working palette and a fresh project.
    setArtwork({ dataUrl, name });
    setWorkingColors([]);
    setActiveColorId(null);
    setEditingPaletteId(null);

    void (async () => {
      try {
        const fresh = (await extractPaletteFromDataUrl(dataUrl, paletteSize)).map(toSampledColor);

        // Merge rather than replace: keep colors the user added while
        // extraction was still running.
        setWorkingColors((current) => {
          const extractedHexes = new Set(fresh.map((color) => color.hex));
          return [...fresh, ...current.filter((color) => !extractedHexes.has(color.hex))];
        });
        setActiveColorId((active) => active ?? fresh[0]?.id ?? null);
      } catch {
        // Extraction is a convenience; manual sampling still works if it fails.
      }
    })();
  };

  const startFromHex = (hex: string) => {
    // Starting from a hex on the Start page begins a fresh project.
    setArtwork(null);
    setWorkingColors([]);
    setEditingPaletteId(null);
    addColor(hex, 'manual');
    navigate('workspace');
  };

  const updateColor = (id: string, hex: string, position?: SampledColor['position']) => {
    setWorkingColors((current) =>
      current.map((color) =>
        color.id === id
          ? // A re-sampled color invalidates any stored mix choice.
            { ...color, hex, position, preferredRecipe: undefined }
          : color,
      ),
    );
  };

  const setWorkingColorRecipe = (colorId: string, recipe: MixRecipe | null) => {
    setWorkingColors((current) =>
      current.map((color) =>
        color.id === colorId ? { ...color, preferredRecipe: recipe ?? undefined } : color,
      ),
    );
  };

  const setPaletteColorRecipe = (paletteId: string, colorId: string, recipe: MixRecipe | null) => {
    setSavedPalettes((current) =>
      current.map((palette) =>
        palette.id === paletteId
          ? {
              ...palette,
              colors: palette.colors.map((color) =>
                color.id === colorId
                  ? { ...color, preferredRecipe: recipe ?? undefined }
                  : color,
              ),
            }
          : palette,
      ),
    );
  };

  const removeColor = (id: string) => {
    setWorkingColors((current) => current.filter((color) => color.id !== id));
    setActiveColorId((current) => (current === id ? null : current));
  };

  const savePalette = async (name: string) => {
    if (workingColors.length === 0) {
      return false;
    }

    const editingPalette = editingPaletteId
      ? savedPalettes.find((palette) => palette.id === editingPaletteId)
      : undefined;

    let paletteArtwork: SavedPalette['artwork'];

    if (artwork && editingPalette?.artwork?.thumbnailDataUrl === artwork.dataUrl) {
      // Editing with the stored thumbnail as the canvas: keep the stored
      // image instead of re-encoding a thumbnail of a thumbnail.
      paletteArtwork = editingPalette.artwork;
    } else if (artwork) {
      try {
        paletteArtwork = {
          thumbnailDataUrl: await createArtworkThumbnail(artwork.dataUrl),
          name: artwork.name,
        };
      } catch {
        // Thumbnail is a nicety; save the palette without it.
      }
    }

    if (editingPalette) {
      setSavedPalettes((current) =>
        current.map((palette) =>
          palette.id === editingPalette.id
            ? { ...palette, name, colors: workingColors, artwork: paletteArtwork ?? palette.artwork }
            : palette,
        ),
      );
      return true;
    }

    const palette: SavedPalette = {
      id: createId(),
      name,
      colors: workingColors,
      createdAt: new Date().toISOString(),
      artwork: paletteArtwork,
    };
    setSavedPalettes((current) => [palette, ...current]);
    setEditingPaletteId(palette.id);
    return true;
  };

  const renamePalette = (id: string, name: string) => {
    setSavedPalettes((current) =>
      current.map((palette) => (palette.id === id ? { ...palette, name } : palette)),
    );
  };

  const editPalette = (palette: SavedPalette) => {
    setEditingPaletteId(palette.id);
    setArtwork(
      palette.artwork
        ? { dataUrl: palette.artwork.thumbnailDataUrl, name: palette.artwork.name }
        : null,
    );
    setWorkingColors(palette.colors);
    setActiveColorId(palette.colors[0]?.id ?? null);
    navigate('workspace');
  };

  const deletePalette = (id: string) => {
    setSavedPalettes((current) => current.filter((palette) => palette.id !== id));
  };

  return (
    <div className="app-shell">
      <header className="top-nav">
        <a className="brand" href="#/">
          PaintBridge
        </a>
        <nav aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <a
              aria-current={
                route.page === item.page || (item.page === 'palettes' && route.page === 'palette')
                  ? 'page'
                  : undefined
              }
              href={item.hash}
              key={item.page}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        {route.page === 'start' ? (
          <StartPage
            onArtworkSelected={(dataUrl, name) => {
              selectArtwork(dataUrl, name);
              navigate('workspace');
            }}
            onManualColor={startFromHex}
            savedPalettes={savedPalettes}
          />
        ) : null}
        {route.page === 'workspace' ? (
          <WorkspacePage
            activeColorId={activeColorId}
            artwork={artwork}
            colors={workingColors}
            editingPaletteName={
              editingPaletteId
                ? savedPalettes.find((palette) => palette.id === editingPaletteId)?.name ?? null
                : null
            }
            onAddColor={addColor}
            onUpdateColor={updateColor}
            onArtworkSelected={selectArtwork}
            ownedPaintIds={ownedPaintIds}
            onToggleOwnedPaint={toggleOwnedPaint}
            onAutoGenerate={() =>
              artwork ? autoGeneratePalette(artwork.dataUrl) : Promise.resolve(0)
            }
            onRemoveColor={removeColor}
            onSavePalette={savePalette}
            onSelectColor={setActiveColorId}
            onSetColorRecipe={setWorkingColorRecipe}
            onPaletteSizeChange={changePaletteSize}
            paletteSize={paletteSize}
          />
        ) : null}
        {route.page === 'palettes' ? <PalettesPage palettes={savedPalettes} /> : null}
        {route.page === 'palette' ? (
          <PaletteDetailPage
            onDelete={(id) => {
              deletePalette(id);
              navigate('palettes');
            }}
            onEdit={editPalette}
            onRename={renamePalette}
            onSetColorRecipe={setPaletteColorRecipe}
            ownedPaintIds={ownedPaintIds}
            palette={savedPalettes.find((palette) => palette.id === route.paletteId) ?? null}
          />
        ) : null}
      </main>
    </div>
  );
}
