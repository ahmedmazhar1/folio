# Folio Studio / Wrappt

An interactive packaging and apparel mockup website with an original scroll-controlled 3D brand story. Built with HTML, CSS, JavaScript, bundled Three.js and a Python standard-library API. No package installation or build step is needed.

## Run locally

Requires Python 3.9 or newer.

```sh
python3 server.py
```

Open http://localhost:4173/#home. On macOS you can also double-click `Open Folio Studio.command`.

The server binds to the local computer only. Google Fonts uses the network with system-font fallbacks. Three.js is bundled in `vendor/three.min.js` and retains its MIT license header.

## What works

- A reversible scroll story: a flat dieline folds into a box, a shared design appears across a hoodie, Half Sleeved Shirts, Full Sleeved Shirts and a paper bag, then the collection travels by truck to a storefront.
- Five chapter controls, responsive layout, reduced-motion poses and a Dive in link to the mockup library.
- Packaging library with 16 template options, editable dimensions, materials, finishes and quantities.
- Connected-panel 3D folding, rotation, zoom, camera presets and PNG exports.
- Text and image artwork placement, layers, undo/redo, local project storage and JSON backups.
- Live apparel text/art editing, on-model movement, resize/rotation controls, garment switching and PNG exports.
- Quote brief form with local storage and text download.
- Local API for template metadata, validation, unit conversion, illustrative estimates, review SVGs, model geometry, fold poses and rule-based product recommendations.

## Main files

- `index.html`, `styles.css`, `workspace.js`, `product.js` — website, navigation and library
- `story.js`, `story-scene.js`, `story.css` — opening scroll story
- `hoodie.html`, `hoodie.js`, `garment-model.js` — apparel editor and shared garment geometry
- `editor.js`, `studio.js`, `folding-engine.js`, `api-client.js` — packaging workspace
- `server.py`, `packaging.py` — local API and panel geometry

API documentation is available at http://localhost:4173/api-docs. A standalone packaging integration example is at http://localhost:4173/embed-demo.

## Verify

```sh
python3 -m unittest -v test_api.py
```

## Prototype boundaries

This is a working local prototype. There is no connected account service, supplier, payment, real order submission, shipping service or administration backend. Delivery on the homepage is an animated brand story. Projects and quote briefs are stored in the current browser; export a backup to move projects between computers.

Product recommendations are rule-based. No AI model provider is configured. Pricing uses an illustrative USD formula rather than supplier prices. The original garment models are illustrative, not photorealistic scans. Packaging geometry and SVG dielines are for review, not certified cutting dies; board thickness, usable internal dimensions, collisions and physical fit require supplier validation. Retain original production artwork separately, as saved project images are reduced to at most 1400 px.

The Python development server is not a production hosting setup. GitHub stores the source; uploading it does not deploy a public website or run its Python API. Commercial API authentication, billing, quotas and hosted infrastructure remain future work.
