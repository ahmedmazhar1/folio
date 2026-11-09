# Folio Studio / Wrappt

A packaging, print and apparel catalogue with interactive 3D mockup tools and an original scroll-controlled brand story. Built with HTML, CSS, JavaScript, bundled Three.js and a Python standard-library API. No package installation or frontend build is needed.

## Run locally

Requires Python 3.9 or newer.

```sh
python3 server.py
```

Open http://localhost:4173/#home. On macOS you can also double-click `Open Folio Studio.command`. The local default binds to `127.0.0.1:4173`. Set `HOST` and `PORT` when a hosting platform requires a different address:

```sh
HOST=0.0.0.0 PORT=8080 python3 server.py
```

Google Fonts uses the network with system-font fallbacks. Three.js is bundled in `vendor/three.min.js` and retains its MIT license header.

## What works

- A reversible scroll story: a dieline folds into a box, a shared design appears across a hoodie, Half Sleeved Shirts, Full Sleeved Shirts and a paper bag, then the collection travels by truck to a storefront.
- A searchable catalogue with product families, use-based filters, product specifications, pack sizes and a locally saved quote list.
- PKR guide prices where a reference product and quantity are known. Custom specifications and unverified price combinations stay quote-based.
- Quote briefs checked by the API and downloaded as text. The server calculates guide totals from its own catalogue and rejects invalid quantities.
- Packaging library with 16 template options; connected-panel 3D folding; editable dimensions, materials, finishes and quantities; rotation, zoom, camera presets and PNG exports.
- Text/image artwork placement, layers, undo/redo, local project storage and JSON backups.
- Live apparel text/art editing with movement, size/rotation controls, garment switching and PNG exports.
- API for catalogue data, guide totals, template metadata, dimensional validation, review SVGs, model geometry, fold poses and rule-based product recommendations.

## Pricing and catalogue maintenance

`shop-catalogue.json` is the authoritative catalogue used by `/api/v1/products` and `/api/v1/catalogue/estimate`. `shop-data.js` supplies the matching initial browser catalogue. Keep the products and options synchronized whenever editing either file.

`unitPrice` is PKR per physical item. `unitsPerPack` is the number of items in one selected pack, and `quantity` counts those packs. For example, two packs of 50 stickers at PKR7 each have a guide total of PKR700. A `null` price or custom-print request produces no numeric line total. The guide subtotal includes priced lines only, with an explicit flag for unpriced work.

Prices are research-based guides pending confirmation, not a supplier agreement, inventory feed, guaranteed wholesale rate or binding offer. Source URLs, the checked date and price basis are recorded per option. Merchant costs, custom work, artwork/setup, tax and delivery must be confirmed before accepting orders. No fabricated discount formula is used. `/api/v1/estimates` returns a custom-quote requirement with null prices for editor configurations.

## Run with Docker

The container listens on port 8080 as an unprivileged user and includes a health check. Requires Docker; no external database or credentials are needed for the present preview.

```sh
docker build -t folio-studio .
docker run --rm -p 8080:8080 folio-studio
```

Open http://localhost:8080/#home. To use another internal port:

```sh
docker run --rm -e PORT=9000 -p 9000:9000 folio-studio
```

A container-capable host can build this Dockerfile, expose the configured `PORT`, and check `/api/v1/health`. Use HTTPS at the host or reverse proxy and preserve the original `Host` header. The API accepts browser POST requests only from that same host; it sends no cross-origin access headers. Requests without an `Origin` header, such as command-line API examples, are allowed. This origin check is not authentication.

The container setup prepares a public catalogue/mockup preview; it does not create a public URL or configure a domain. GitHub stores the source and does not run this Python service by itself. The Python standard-library server needs host-level TLS, request limits and monitoring for an internet-facing preview; a commercial API needs a production application server and the services below.

## Main files

- `index.html`, `styles.css`, `workspace.js`, `product.js` — website, navigation and studio library
- `shop.js`, `shop.css`, `shop-art.js`, `shop-data.js`, `shop-catalogue.json` — catalogue, original illustrations and quote list
- `story.js`, `story-scene.js`, `story.css` — opening scroll story
- `hoodie.html`, `hoodie.js`, `garment-model.js` — apparel editor and shared garment geometry
- `editor.js`, `studio.js`, `folding-engine.js`, `api-client.js` — packaging workspace
- `server.py`, `packaging.py` — API and panel geometry
- `Dockerfile`, `.dockerignore` — container packaging

API documentation is available at `/api-docs`. A standalone packaging integration example is at `/embed-demo`.

## Verify

```sh
python3 -m unittest -v test_api.py
```

## Current boundaries

The catalogue, mockup tools and downloadable briefs work. There is no connected account service, supplier, payment, actual order submission, shipping service or administration backend. Quote briefs are downloaded; they are not sent to a business. Delivery in the opening animation is a brand story, not order tracking. Projects and quote lists live in the current browser; export backups to move work between computers.

Product recommendations are rule-based; no AI provider is configured. Paid API credentials, authentication, quotas, customer billing, license enforcement and hosted service guarantees are not implemented.

The original garment models are illustrative rather than photorealistic scans. Packaging geometry and SVG dielines are for review, not certified cutting dies; board thickness, usable internal dimensions, collisions and physical fit require supplier validation. Retain original production artwork separately, as saved project images are reduced to at most 1400 px.
