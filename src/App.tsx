import { useEffect, useState } from 'react';
import { PalettesPage } from './pages/PalettesPage';
import { StartPage } from './pages/StartPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { extractPaletteFromDataUrl } from './lib/paletteExtraction';
import { createId, loadSavedPalettes, persistSavedPalettes } from './lib/storage';
import type { ColorSource, SampledColor, SavedPalette } from './types/palette';

type Route = 'start' | 'workspace' | 'palettes';

type Artwork = {
  dataUrl: string;
  name: string;
};

const NAV_ITEMS: Array<{ route: Route; label: string; hash: string }> = [
  { route: 'start', label: 'Start', hash: '#/' },
  { route: 'workspace', label: 'Workspace', hash: '#/workspace' },
  { route: 'palettes', label: 'Saved palettes', hash: '#/palettes' },
];

function routeFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');

  if (hash === 'workspace' || hash === 'palettes') {
    return hash;
  }

  return 'start';
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [workingColors, setWorkingColors] = useState<SampledColor[]>([]);
  const [activeColorId, setActiveColorId] = useState<string | null>(null);
  const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>(loadSavedPalettes);

  useEffect(() => {
    const handleHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    persistSavedPalettes(savedPalettes);
  }, [savedPalettes]);

  const navigate = (next: Route) => {
    const item = NAV_ITEMS.find((candidate) => candidate.route === next);
    window.location.hash = item ? item.hash : '#/';
  };

  const addColor = (hex: string, source: ColorSource) => {
    const color: SampledColor = { id: createId(), hex, source };
    setWorkingColors((current) => [...current, color]);
    setActiveColorId(color.id);
  };

  const autoGeneratePalette = async (dataUrl: string) => {
    try {
      const hexes = await extractPaletteFromDataUrl(dataUrl, 6);
      const existing = new Set(workingColors.map((color) => color.hex));
      const fresh = hexes
        .filter((hex) => !existing.has(hex))
        .map((hex): SampledColor => ({ id: createId(), hex, source: 'auto' }));

      if (fresh.length === 0) {
        return 0;
      }

      setWorkingColors((current) => {
        const currentHexes = new Set(current.map((color) => color.hex));
        return [...current, ...fresh.filter((color) => !currentHexes.has(color.hex))];
      });
      setActiveColorId((activeId) => activeId ?? fresh[0].id);
      return fresh.length;
    } catch {
      // Extraction is a convenience; manual sampling still works if it fails.
      return 0;
    }
  };

  const selectArtwork = (dataUrl: string, name: string) => {
    setArtwork({ dataUrl, name });
    void autoGeneratePalette(dataUrl);
  };

  const removeColor = (id: string) => {
    setWorkingColors((current) => current.filter((color) => color.id !== id));
    setActiveColorId((current) => (current === id ? null : current));
  };

  const savePalette = (name: string) => {
    if (workingColors.length === 0) {
      return false;
    }

    const palette: SavedPalette = {
      id: createId(),
      name,
      colors: workingColors,
      createdAt: new Date().toISOString(),
    };
    setSavedPalettes((current) => [palette, ...current]);
    return true;
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
              aria-current={route === item.route ? 'page' : undefined}
              href={item.hash}
              key={item.route}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        {route === 'start' ? (
          <StartPage
            onArtworkSelected={(dataUrl, name) => {
              selectArtwork(dataUrl, name);
              navigate('workspace');
            }}
            onManualColor={(hex) => {
              addColor(hex, 'manual');
              navigate('workspace');
            }}
            savedPalettes={savedPalettes}
          />
        ) : null}
        {route === 'workspace' ? (
          <WorkspacePage
            activeColorId={activeColorId}
            artwork={artwork}
            colors={workingColors}
            onAddColor={addColor}
            onArtworkSelected={selectArtwork}
            onAutoGenerate={() =>
              artwork ? autoGeneratePalette(artwork.dataUrl) : Promise.resolve(0)
            }
            onRemoveColor={removeColor}
            onSavePalette={savePalette}
            onSelectColor={setActiveColorId}
          />
        ) : null}
        {route === 'palettes' ? (
          <PalettesPage onDelete={deletePalette} palettes={savedPalettes} />
        ) : null}
      </main>
    </div>
  );
}
