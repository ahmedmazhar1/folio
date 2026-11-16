FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app
RUN useradd --system --uid 10001 --create-home folio
COPY server.py packaging.py enquiries.py backend-config.json index.html styles.css editor.js workspace.js api-client.js studio.js product.js folding-engine.js fold-study.js hoodie.html hoodie.js garment-model.js ecopak.css shop-photos.css shop.css shop.js shop-art.js shop-data.js shop-catalogue.json favicon.svg pannipack-logo.svg robots.txt api-docs.html embed-demo.html ./
COPY light-theme.css product-geometry.js product-mockups.js product-mockups.css launch.js catalogue-mockups.json catalogue-models.json ./
COPY assets/ ./assets/
COPY vendor/three.min.js ./vendor/three.min.js
RUN mkdir -p /app/.data && chown -R folio:folio /app/.data
ENV ECOPAK_DATA_DIR=/app/.data
USER folio
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8080')+'/api/v1/health',timeout=3).read()"
CMD ["python", "server.py"]
