import { useEffect, useRef, useState } from 'react';
import { PaletteDetailPage } from './pages/PaletteDetailPage';
import { PalettesPage } from './pages/PalettesPage';
import { StartPage } from './pages/StartPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { extractPaletteFromDataUrl } from './lib/paletteExtraction';
import type { ExtractedColor } from './lib/paletteExtraction';
import { clonePalette, moveColorInList, normalizeLabel } from './lib/paletteEdits';
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
  // Bumped whenever the project resets (new artwork, hex start, or opening a
  // saved palette) so in-flight extractions/timers from an abandoned project
  // can tell they're stale and avoid corrupting the new one.
  const projectGenRef = useRef(0);

  useEffect(() => {
    const handleHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Skip the initial-mount runs: they would rewrite the just-loaded data
  // (including base64 thumbnails) back to localStorage unchanged.
  const hasHydrated = useRef(false);

  // Recipe edits (parts steppers, alt-mix picks) flow through setSavedPalettes
  // on every click, and each write re-serializes every palette's color data
  // plus every base64 artwork thumbnail. Debounce so a burst of clicks
  // collapses into one write; a pending write is always flushed before the
  // tab can go away (pagehide) or this component unmounts.
  const savedPalettesRef = useRef(savedPalettes);
  savedPalettesRef.current = savedPalettes;
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hasHydrated.current) {
      return;
    }

    // Re-running because savedPalettes changed again inside the debounce
    // window: cancel the stale timer (no flush here — that would defeat the
    // debounce) and arm a fresh one for the latest value.
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistSavedPalettes(savedPalettes);
    }, 400);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, [savedPalettes]);

  // Mount-once: flush any pending debounced write immediately when the tab
  // is closing (pagehide) or this component unmounts, so the last edits in a
  // burst are never lost.
  useEffect(() => {
    const flushPendingWrite = () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
        persistSavedPalettes(savedPalettesRef.current);
      }
    };

    window.addEventListener('pagehide', flushPendingWrite);
    return () => {
      window.removeEventListener('pagehide', flushPendingWrite);
      flushPendingWrite();
    };
  }, []);

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

  /** Colors the replace-on-regen pass must never touch: manual/image picks,
   * and auto colors the user has since invested in (named or given a mix). A
   * plain auto-extracted swatch with neither is still disposable. */
  const isKeepableColor = (color: SampledColor) =>
    color.source !== 'auto' || Boolean(color.label) || Boolean(color.preferredRecipe);

  /** Re-extracts the palette at the chosen size, replacing the disposable
   * auto-extracted colors while keeping anything the user added by hand or
   * invested in. Returns the number of fresh colors placed, 0 when extraction
   * succeeded but every extracted hex was already kept (old disposable autos
   * are still cleared out in this case), or null when extraction failed or
   * the project moved on before this result could be applied. */
  const autoGeneratePalette = async (
    dataUrl: string,
    size = paletteSize,
  ): Promise<number | null> => {
    const gen = projectGenRef.current;
    try {
      const extracted = await extractPaletteFromDataUrl(dataUrl, size);

      // The project changed (new artwork, hex start, or another palette
      // opened) while extraction was in flight — this result belongs to an
      // abandoned project. Bail before touching any state.
      if (gen !== projectGenRef.current) {
        return null;
      }

      // Keep colors the user added by hex or by clicking the artwork, and any
      // auto color they've since invested in; only disposable autos are
      // replaced by the fresh set.
      const kept = workingColors.filter(isKeepableColor);
      const keptHexes = new Set(kept.map((color) => color.hex));
      const fresh = extracted
        .filter((color) => !keptHexes.has(color.hex))
        .map(toSampledColor);

      // Always run the replacement, even when nothing fresh survived the
      // dedup (e.g. a solid-color logo whose one extracted hex is already
      // kept) — otherwise stale disposable autos from a previous size/regen
      // linger on screen while the caller reports "nothing found".
      setWorkingColors((current) => {
        // Recompute kept colors against the latest state so anything added while
        // extraction was running survives.
        const keptNow = current.filter(isKeepableColor);
        const keptNowHexes = new Set(keptNow.map((color) => color.hex));
        return [...fresh.filter((color) => !keptNowHexes.has(color.hex)), ...keptNow];
      });

      if (fresh.length === 0) {
        return 0;
      }

      // Move focus to the first fresh color unless a kept color is still selected.
      setActiveColorId((activeId) =>
        activeId && kept.some((color) => color.id === activeId) ? activeId : fresh[0].id,
      );
      // The gen-guard above already rules out the only known race (a second
      // extraction landing after this one), so fresh.length is the true
      // inserted count here — no need to recompute it from inside the
      // updater above.
      return fresh.length;
    } catch {
      return null;
    }
  };

  const selectArtwork = (dataUrl: string, name: string) => {
    // New artwork starts a fresh working palette and a fresh project. Bump
    // the generation and cancel any pending debounced re-extract so a
    // previous project's timer/in-flight extraction can't land here.
    projectGenRef.current += 1;
    const gen = projectGenRef.current;
    if (regenTimerRef.current !== null) {
      window.clearTimeout(regenTimerRef.current);
      regenTimerRef.current = null;
    }
    setArtwork({ dataUrl, name });
    setWorkingColors([]);
    setActiveColorId(null);
    setEditingPaletteId(null);

    void (async () => {
      try {
        const fresh = (await extractPaletteFromDataUrl(dataUrl, paletteSize)).map(toSampledColor);

        // A second selectArtwork (or startFromHex/editPalette) may have run
        // while this extraction was in flight — discard the stale merge.
        if (gen !== projectGenRef.current) {
          return;
        }

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
    // Starting from a hex on the Start page begins a fresh project; bump the
    // generation and cancel any pending debounced re-extract from before.
    projectGenRef.current += 1;
    if (regenTimerRef.current !== null) {
      window.clearTimeout(regenTimerRef.current);
      regenTimerRef.current = null;
    }
    setArtwork(null);
    setWorkingColors([]);
    setEditingPaletteId(null);
    addColor(hex, 'manual');
    navigate('workspace');
  };

  const updateColor = (id: string, hex: string, position?: SampledColor['position']) => {
    setWorkingColors((current) =>
      current.map((color) => {
        if (color.id !== id) {
          return color;
        }
        if (color.hex === hex) {
          // Position-only nudge (arrow key / sub-pixel drag): the sampled
          // color didn't actually change, so keep its source and any stored
          // mix — only the marker moved.
          return { ...color, position };
        }
        // A genuine re-sample: the hex changed. Re-sampling is a sanctioned
        // way to pick a color from the artwork (same as clicking it), so
        // treat it as user-owned rather than a disposable auto-extracted
        // color, and drop the now-invalid stored mix.
        return { ...color, hex, position, source: 'image', preferredRecipe: undefined };
      }),
    );
  };

  const setWorkingColorRecipe = (colorId: string, recipe: MixRecipe | null) => {
    setWorkingColors((current) =>
      current.map((color) =>
        color.id === colorId ? { ...color, preferredRecipe: recipe ?? undefined } : color,
      ),
    );
  };

  const setWorkingColorLabel = (id: string, label: string) => {
    const normalized = normalizeLabel(label);
    setWorkingColors((current) =>
      current.map((color) => (color.id === id ? { ...color, label: normalized } : color)),
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

    // editPalette snapshots the same color ids into workingColors, so if this
    // palette's draft is open in the workspace, apply the edit there too —
    // otherwise a later "Update palette" would silently revert it.
    if (paletteId === editingPaletteId) {
      setWorkingColors((current) =>
        current.map((color) =>
          color.id === colorId ? { ...color, preferredRecipe: recipe ?? undefined } : color,
        ),
      );
    }
  };

  const removeColor = (id: string) => {
    setWorkingColors((current) => current.filter((color) => color.id !== id));
    setActiveColorId((current) => (current === id ? null : current));
  };

  const moveColor = (id: string, delta: number) => {
    setWorkingColors((current) => moveColorInList(current, id, delta));
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
    // Opening a saved palette for editing starts a fresh project too; bump
    // the generation and cancel any pending debounced re-extract from before.
    projectGenRef.current += 1;
    if (regenTimerRef.current !== null) {
      window.clearTimeout(regenTimerRef.current);
      regenTimerRef.current = null;
    }
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

  const duplicatePalette = (id: string) => {
    const original = savedPalettes.find((palette) => palette.id === id);

    if (!original) {
      return;
    }

    const copy = clonePalette(original, createId, new Date().toISOString());
    setSavedPalettes((current) => [copy, ...current]);
    window.location.hash = `#/palettes/${encodeURIComponent(copy.id)}`;
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
            onSetColorLabel={setWorkingColorLabel}
            onMoveColor={moveColor}
            onPaletteSizeChange={changePaletteSize}
            paletteSize={paletteSize}
          />
        ) : null}
        {route.page === 'palettes' ? <PalettesPage palettes={savedPalettes} /> : null}
        {route.page === 'palette' ? (
          <PaletteDetailPage
            key={route.paletteId}
            onDelete={(id) => {
              deletePalette(id);
              navigate('palettes');
            }}
            onDuplicate={duplicatePalette}
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
