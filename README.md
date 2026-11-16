# PanniPack

Packaging catalogue and interactive 3D studio. White storefront, 105 products, 411 listed options, product photos, pricing and enquiry forms.

## Open locally

Run `python3 server.py` from this folder, then open http://localhost:4173/#shop. Python 3.9+ is sufficient; no Python packages or npm install are needed. On macOS you can double-click `Open PanniPack.command`.

## Where to edit

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, navigation, main wording, site title and brand name |
| `light-theme.css` | Current white theme and storefront appearance |
| `shop.js` | Product cards, galleries, options, pricing and quote list |
| `product-mockups.js` / `product-mockups.css` | Product-specific 3D studio, controls, branding and catalogue links |
| `product-geometry.js` | 3D shapes for cups, bags, bowls, carriers, cutlery and other products |
| `folding-engine.js` | Renders and animates connected folding panels |
| `catalogue-models.json` | Generated folding models at catalogue dimensions |
| `catalogue-mockups.json` | Product geometry assignments and published/estimated dimensions |
| `shop-catalogue.json` / `shop-data.js` | Product photos, sizes, options and imported prices |
| `assets/ecopak/` | Only the photographs referenced by the catalogue |
| `server.py` / `packaging.py` / `enquiries.py` | Local server, dieline API and enquiry storage |
| `worker.js` / `portpackaging.js` | Hosted Worker implementation |
| `scripts/prepare-site.py` | Generates the deployable Worker in `dist/` |
| `drizzle/` | Hosted enquiry database migration |

`styles.css`, `editor.js`, `workspace.js`, `studio.js`, `product.js` and `fold-study.js` support the separate dieline editor and saved projects. `hoodie.html`, `hoodie.js` and `garment-model.js` retain the apparel module. `vendor/three.min.js` is the bundled 3D library. The other CSS files style the shop and photo galleries.

## Catalogue and 3D coverage

Every product has a direct Design in 3D button. Text and uploaded images can be positioned, resized, rotated and dragged on the live 3D surface. Bundle components and individual folding panels have independent designs. All 105 products have a 3D preview; 33 folding products use connected panel models, while other products use lid-opening, rotatable or grouped previews. All 411 options are mapped. Overall published measurements are retained; missing sizes and small construction details are labelled estimates. These are visual mockups, not approved manufacturing dies.

Refresh catalogue: `python3 scripts/import_ecopak.py`. Then run `python3 scripts/enrich_mockups.py` and `python3 scripts/build_catalogue_models.py`. The importer uses public EcoPak source data. Offline source snapshots and old research exports are intentionally excluded from this clean folder.

## Enquiries

Submitted enquiries are stored before a receipt is returned. Local records live in `.data/`; the hosted version uses the configured D1 database. Email forwarding to theahmedmazhar@gmail.com remains inactive until inbox verification is completed. `backend-config.json` records that state. Do not claim that a receipt means an email has been delivered.

## Checks and deployment

- `python3 -m unittest -q test_api.py`
- `node tests/catalogue-model-alignment.test.cjs`
- `node tests/artwork-coverage.test.cjs`
- `python3 scripts/prepare-site.py`
- `node tests/worker-integration.test.mjs` (Node 22+ for its built-in SQLite module)

The generated Worker is `dist/server/index.js`; hosting identity is `.openai/hosting.json`. The Dockerfile runs the Python server on port 8080. No credentials, customer submissions, old story animation, screenshots, caches or previous builds are included in the clean delivery.
