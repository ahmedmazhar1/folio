#!/usr/bin/env python3
"""Refresh the public EcoPak Shopify catalogue and its image assets. No credentials required.
Prices are preserved per listed variant/package. No unit-price or stock inference is made.
"""
import argparse, concurrent.futures, hashlib, html, json, pathlib, re, subprocess, time
import xml.etree.ElementTree as ET
from datetime import date
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='https://www.ecopakonline.com'
DATE=date.today().isoformat()
CATEGORIES=[('bundles','Bundles','gift'),('bakery','Bakery & cake boxes','cake'),('boxes','Shipping & retail boxes','mailer'),('bags','Paper bags','bag'),('bagasse','Bagasse bowls & trays','bowl'),('bowls','Kraft bowls & lids','bowl'),('food','Food boxes & trays','burger'),('coffee','Coffee cups & carriers','cup'),('cutlery','Cutlery & skewers','cutlery'),('wraps','Butter paper & straws','wrap'),('stickers','Custom stickers','sticker'),('samples','Sample packs','gift')]
def fetch(url, image=False):
    for attempt in range(5):
        result=subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','45','--user-agent','Mozilla/5.0 (compatible; authorised EcoPak catalogue migration)','--retry','1']+(['-H','Accept: image/webp'] if image else [])+[url],capture_output=True)
        if result.returncode==0:return result.stdout
        if attempt<4:time.sleep(2**attempt)
    raise RuntimeError('Download failed: '+url+' '+result.stderr.decode()[:200])
def get_json(url):return json.loads(fetch(url))
def save(name,data): (ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def paginated(path,key):
    all_items=[];pages=[]
    for page in range(1,30):
        url=BASE+path+('?page=' if '?' not in path else '&page=')+str(page)
        items=get_json(url).get(key,[]);pages.append({'url':url,'count':len(items)})
        all_items.extend(items)
        if len(items)<250:break
        time.sleep(.3)
    return all_items,pages

def text(body):
    body=re.sub(r'<(?:br|/p|/li|/div|/h[1-6])\b[^>]*>','\n',body or '',flags=re.I)
    return re.sub(r'[ \t]+',' ',html.unescape(re.sub(r'<[^>]+>','',body))).strip()
def classify(p):
    s=(p['title']+' '+p['handle']).lower()
    if 'sample' in s:return 'samples','gift'
    if 'bundle' in s or 'combo' in s or p['handle'] in ['fast-food-essentials','green-cafe-pack']:return 'bundles','gift'
    if 'sticker' in s:return 'stickers','sticker'
    if 'straw' in s:return 'wraps','straws'
    if 'butter' in s:return 'wraps','wrap'
    if any(w in s for w in ['fork','spork','spoon','stirrer','skewer','chopstick','cutlery']):return 'cutlery','cutlery'
    if 'carrier' in s or 'coffee-cup' in s:return 'coffee','carrier' if 'carrier' in s else 'cup'
    if 'bagasse' in s:return 'bagasse','tray' if 'tray' in s else 'bowl'
    if 'bowl' in s:return 'bowls','bowl'
    if 'bag' in s:return 'bags','bag'
    if any(w in s for w in ['corrugated','shipping','e-commerce','frame-box','apparel-box','flat-box']):return 'boxes','mailer'
    if any(w in s for w in ['cake','brownie','cookie','dessert','doughnut','donut','loaf','bakery']):return 'bakery','cake'
    return 'food','tray' if 'tray' in s else 'burger'
def dims(p,body):
    # The product title is authoritative for straightforward L × W × H sizes only.
    for s in [p['title']]+[l for l in body.splitlines() if 'size' in l.lower()]:
        m=re.search(r'(\d+(?:\.\d+)?)\s*["”]?\s*[x×]\s*(\d+(?:\.\d+)?)\s*["”]?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:["”]|inches|inch|in\b)',s,re.I)
        if m:return dict(zip(['L','W','H'],[round(float(v)*25.4,2) for v in m.groups()]))
    return None

def image_asset(entry):
    src=entry['src'];urlparts=urlsplit(src);query=dict(parse_qsl(urlparts.query));query['width']='1600';query['format']='webp'
    url=urlunsplit((urlparts.scheme or 'https',urlparts.netloc,urlparts.path,urlencode(query),''))
    ext=pathlib.Path(urlparts.path).suffix.lower();ext=ext if ext in ['.jpg','.jpeg','.png','.webp','.gif','.avif','.svg'] else '.jpg'
    if ext not in ['.svg','.gif']:ext='.webp'
    name=hashlib.sha256(src.encode()).hexdigest()[:20]+ext
    path=ROOT/'assets/ecopak'/name
    if not path.exists():
        body=fetch(url,image=True)
        valid=(body.startswith(b'\xff\xd8\xff') or body.startswith(b'\x89PNG\r\n\x1a\n') or body[:6] in [b'GIF87a',b'GIF89a'] or body.startswith(b'RIFF') and body[8:12]==b'WEBP' or b'ftypavif' in body[:32] or b'<svg' in body[:500])
        if not valid:raise RuntimeError('Not an image: '+src)
        path.write_bytes(body)
    body=path.read_bytes()
    actual_ext='.webp' if body.startswith(b'RIFF') and body[8:12]==b'WEBP' else '.jpg' if body.startswith(b'\xff\xd8\xff') else '.png' if body.startswith(b'\x89PNG') else ext
    if actual_ext!=path.suffix:
        actual_path=path.with_suffix(actual_ext);path.replace(actual_path);path=actual_path;name=path.name
    return src,'/assets/ecopak/'+name

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true',help='Rebuild catalogue from saved source and existing assets');args=parser.parse_args()
    if args.offline:
        raw=json.loads((ROOT/'ecopak-source-products.json').read_text());coll=json.loads((ROOT/'ecopak-source-collections.json').read_text());products=raw['products'];collections=coll['collections'];pages=raw['pages']
    else:
        products,pages=paginated('/products.json?limit=250','products')
        # Verify pagination termination with the next page even when page 1 contains fewer than 250.
        if len(pages)==1:pages.append({'url':BASE+'/products.json?limit=250&page=2','count':len(get_json(BASE+'/products.json?limit=250&page=2').get('products',[]))})
        collections,collectionpages=paginated('/collections.json?limit=250','collections')
        memberships={}
        for i,c in enumerate(collections):
            members,memberpages=paginated('/collections/'+c['handle']+'/products.json?limit=250','products')
            memberships[c['handle']]={'productIds':[p['id'] for p in members],'publicProductCount':len(members),'pages':memberpages}
            time.sleep(.12)
        sitemap=ET.fromstring(fetch(BASE+'/sitemap.xml'))
        productmaps=[e.text for e in sitemap.findall('.//{*}loc') if '/sitemap_products_' in e.text]
        sitemapurls=[]
        for u in productmaps:
            tree=ET.fromstring(fetch(u));sitemapurls.extend(e.find('{*}loc').text for e in tree if e.find('{*}loc') is not None and '/products/' in e.find('{*}loc').text)
        feedurls={BASE+'/products/'+p['handle'] for p in products}
        verification={'sitemapProductCount':len(set(sitemapurls)),'sitemapOnly':sorted(set(sitemapurls)-feedurls),'feedOnly':sorted(feedurls-set(sitemapurls)),'sources':productmaps}
        raw={'source':BASE,'importedAt':DATE,'pages':pages,'sitemapVerification':verification,'products':products}
        coll={'source':BASE,'importedAt':DATE,'pages':collectionpages,'collections':collections,'memberships':memberships}
        save('ecopak-source-products.json',raw);save('ecopak-source-collections.json',coll)
    assets={}
    for p in products:
        for im in p['images']:assets[im['src']]=im
    for c in collections:
        if c.get('image'):assets[c['image']['src']]=c['image']
    (ROOT/'assets/ecopak').mkdir(parents=True,exist_ok=True)
    failures=[];mapping={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        jobs={pool.submit(image_asset,im):src for src,im in assets.items()}
        for i,future in enumerate(concurrent.futures.as_completed(jobs)):
            try:
                src,path=future.result();mapping[src]=path
            except Exception as e:failures.append({'url':jobs[future],'error':str(e)})
            if i%50==0:print('Images',i+1,'/',len(assets),flush=True)
    if failures:save('ecopak-image-errors.json',failures)
    converted=[]
    for p in products:
        body=text(p['body_html']);cat,kind=classify(p);source={'name':'EcoPak Online','url':BASE+'/products/'+p['handle'],'date':raw['importedAt']}
        options=[]
        for v in p['variants']:
            label=v['title'] if v['title']!='Default Title' else ('Bundle as listed' if cat=='bundles' else 'As listed')
            pack=re.search(r'(\d[\d,]*)\s*(?:pieces?|pcs|pairs?)',label,re.I)
            count=int(pack.group(1).replace(',','')) if pack else None
            unit='bundle' if cat=='bundles' else 'sample pack' if cat=='samples' else 'pack of '+str(count) if count and count>1 else 'piece' if count==1 else 'listed option'
            options.append({'label':label,'unitPrice':float(v['price']),'unitsPerPack':1,'minQty':1,'step':1,'basis':'EcoPak listed price for '+label+'. Quantity counts this complete option, not individual contents.','source':source,'available':v['available'],'variantId':str(v['id']),'sku':v.get('sku',''),'compareAtPrice':float(v['compare_at_price']) if v.get('compare_at_price') else None,'quantityLabel':'Packs' if count and count>1 or cat in ['bundles','samples'] else 'Quantity','priceUnit':unit,'piecesPerOption':count,'options':[v.get('option1'),v.get('option2'),v.get('option3')],'imageId':str(v['featured_image']['id']) if v.get('featured_image') else None})
        images=[{'src':mapping.get(im['src'],im['src']),'alt':im.get('alt') or p['title'],'sourceUrl':im['src'],'id':str(im['id']),'width':im.get('width'),'height':im.get('height'),'variantIds':[str(x) for x in im.get('variant_ids',[])]} for im in p['images']]
        d=dims(p,body) if cat!='bags' else None;studio=None
        if cat=='boxes':studio='mailer'
        if cat=='bags' and 'handle' not in p['title'].lower():studio='board-paper-bag'
        if cat=='bakery' and 'box' in p['title'].lower() and not any(w in p['title'].lower() for w in ['slice','cupcake','doughnut','donut','loaf','window']):studio='mailer'
        if p['handle']=='brownie-box-10x6x3-inches':studio='board-self-locking-tuck'
        if p['handle'] in ('kraft-cake-box-8-5x8-5x4','cakebox8-5x8-5x4'):studio='board-window-cake'
        size=next((l.strip() for l in body.splitlines() if re.match(r'^(size|dimension|capacity)',l,re.I)),'See product details and listed options')
        material=next((l.strip() for l in body.splitlines() if re.match(r'^material',l,re.I)), 'Bagasse (sugarcane pulp)' if cat=='bagasse' else 'Kraft paper' if 'kraft' in p['title'].lower() else 'See EcoPak product details')
        membership=[c['handle'] for c in collections if p['id'] in coll.get('memberships',{}).get(c['handle'],{}).get('productIds',[])]
        uses=['cafe'] if cat in ['coffee','food','cutlery','bagasse','bowls','wraps'] else ['bakery','event'] if cat=='bakery' else ['brand'] if cat in ['boxes','stickers'] else ['cafe','bakery','brand']
        converted.append({'id':p['handle'],'name':p['title'],'category':cat,'kind':kind,'description':body,'descriptionHtml':p['body_html'],'size':size,'material':material,'uses':uses,'studio':studio,'studioNote':'Illustrative folding structure. Photo and selected EcoPak specification are authoritative; the mockup is not an exact production dieline.','options':options,'minimumConfirmed':True,'quantityDefault':1,'defaultOptionIndex':next((i for i,o in enumerate(options) if o['available']),0),'available':any(o['available'] for o in options),'images':images,'image':images[0]['src'] if images else None,'sourceUrl':source['url'],'productId':str(p['id']),'vendor':p['vendor'],'tags':p['tags'],'collections':membership,'featuredRank':next((i for i,pid in enumerate(coll.get('memberships',{}).get('best-selling',{}).get('productIds',[])) if pid==p['id']),10000),'dimensionsMm':d,'dimensionsNote':'Explicit three-axis box/tray measurement converted from inches; bag axis order is not inferred.' if d else 'See listed measurements. Axis order or complete three-axis dimensions require confirmation.','updatedAt':p['updated_at'],'importedAt':raw['importedAt']})
    save('shop-catalogue.json',converted)
    cats=[dict(id=i,name=n,kind=k,image=next((p['image'] for p in converted if p['category']==i and p['image']),None)) for i,n,k in CATEGORIES if any(p['category']==i for p in converted)]
    (ROOT/'shop-data.js').write_text('/* EcoPak public catalogue snapshot. Refresh with python3 scripts/import_ecopak.py. */\nwindow.FOLIO_SHOP_CATEGORIES='+json.dumps(cats,ensure_ascii=False,separators=(',',':'))+';\nwindow.FOLIO_SHOP_PRODUCTS='+json.dumps(converted,ensure_ascii=False,separators=(',',':'))+';\n')
    report={'source':BASE,'importedAt':raw['importedAt'],'sourceProductsSha256':hashlib.sha256((ROOT/'ecopak-source-products.json').read_bytes()).hexdigest(),'sourceCollectionsSha256':hashlib.sha256((ROOT/'ecopak-source-collections.json').read_bytes()).hexdigest(),'catalogueSha256':hashlib.sha256((ROOT/'shop-catalogue.json').read_bytes()).hexdigest(),'products':len(converted),'variants':sum(len(p['options']) for p in converted),'availableProducts':sum(p['available'] for p in converted),'availableVariants':sum(o['available'] for p in converted for o in p['options']),'productImageReferences':sum(len(p['images']) for p in converted),'uniqueImageDownloads':len(mapping),'assetBytes':sum((ROOT/path.lstrip('/')).stat().st_size for path in mapping.values()),'imageFormat':'Shopify WebP transform where supported, JPEG fallback, maximum requested width 1600; original URLs preserved','imageDownloadFailures':failures,'collections':len(collections),'categories':cats,'productPages':pages,'sitemapVerification':raw.get('sitemapVerification'),'collectionCountsNote':'Collection products_count can include products not available to the public Online Store channel. memberships contains actual public collection product IDs.','priceSemantics':'unitPrice is the exact price of the whole listed Shopify variant. unitsPerPack=1 intentionally avoids double multiplying the pack contents. piecesPerOption preserves explicit pack size as information only.','mockupNote':'Existing folding models are illustrative and are mapped only to selected box/bag products. All supplier photographs remain independent of the 3D preview.'}
    save('ecopak-import-report.json',report)
    print(json.dumps({k:report[k] for k in ['products','variants','availableProducts','availableVariants','uniqueImageDownloads','collections']},indent=2),flush=True)
    if failures:raise SystemExit('Some images failed; see ecopak-image-errors.json')
if __name__=='__main__':main()
