# PaintBridge

Turn digital colors into acrylic paint you can actually mix.

**Live site:** https://dc-guo.github.io/paintbridge/

Upload artwork, pull out its dominant colors with draggable sample markers, match each color to the closest Liquitex BASICS acrylics, and get starter mix recipes ("2 parts Titanium White + 1 part Payne's Gray") from the paints you own — plus a paint-usage chart and copyable mixing summary per saved palette.

Everything runs in your browser. Images are never uploaded to a server, and palettes and your paint inventory are stored locally.

## Running locally

```bash
npm install
npm run dev    # dev server
npm test       # typecheck + unit tests
npm run build  # production build
```

## Accuracy note

PaintBridge is a planning assistant, not a color-management system. Paint color values are hand-approximated from swatch references, mix estimates use simplified color math, and every result should be tested with a small physical swatch first. Approximations, not formulas.

Liquitex and Liquitex BASICS are trademarks of their respective owner. This project is not affiliated with or endorsed by Liquitex.

## License

Source is available for reference. All rights reserved.
