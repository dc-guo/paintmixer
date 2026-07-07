# PaintBridge

PaintBridge is a demoable web app MVP for helping artists translate digital colors into approximate Liquitex BASICS acrylic paint decisions.

The app is intentionally local-first for the MVP: artwork uploads and future image processing happen in the browser, with no backend, auth, or cloud services.

## Scripts

After installing Node.js and dependencies:

```bash
npm install
npm run dev
npm run build
```

## Accuracy Note

PaintBridge uses approximate RGB/CMYK and paint match guidance. It is a planning assistant, not an exact paint formulation or color-management system.
