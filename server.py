"""Folio API v1 and local website server. Python standard library only."""
import json, math, os
from decimal import Decimal, ROUND_HALF_UP
from packaging import manifest, pose, recommend_product
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
LIMITS = {'L': (100,400), 'W': (80,300), 'H': (30,200)}
TEMPLATES = [dict(id=i,name=n,dimensions_mm=dict(zip(('L','W','H'),d)),structure='simplified-hinged-box',production_ready=False) for i,n,d in [('mailer','Mailer box',(220,150,60)),('deep-gift','Deep gift box',(160,160,100)),('slim-flat','Slim flat box',(300,200,40))]]
TEMPLATES.append(dict(id='tuck-carton',name='Folding carton',dimensions_mm={'L':100,'W':80,'H':160},structure='folding-carton',production_ready=False))
for board,families in [('Cardboard',['tuck-end','auto-bottom','roll-end','roll-end-wing','simple-tray','frame-tray','paper-bag']),('Corrugated',['tuck-end','auto-bottom','roll-end','roll-end-wing','flap-box'])]:
    for family in families:
        sizes={'tuck-end':(100,80,160),'auto-bottom':(140,80,170),'roll-end':(220,150,50),'roll-end-wing':(220,150,50),'simple-tray':(190,130,45),'frame-tray':(190,130,45),'paper-bag':(150,90,195),'flap-box':(240,160,140)}
        name=family.replace('-',' ').title() if family!='roll-end-wing' else 'Roll End · Wing Closure'
        TEMPLATES.append(dict(id=('board-' if board=='Cardboard' else 'corr-')+family,name=name,board=board,structure=family,dimensions_mm=dict(zip(('L','W','H'),sizes[family])),production_ready=False))
SOURCE='https://support.pakfactory.com/portal/en/kb/articles/how-do-i-determine-what-size-box-i-need'
class Invalid(ValueError): pass

def number(v,field,lo,hi):
    if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not lo <= v <= hi:
        raise Invalid(f'{field} must be a number from {lo} to {hi}.')
    return float(v)

def dimensions(data):
    unit=data.get('unit','mm')
    if unit not in ('mm','in'): raise Invalid('unit must be mm or in.')
    scale=25.4 if unit=='in' else 1
    dims=data.get('dimensions',{})
    if not isinstance(dims,dict): raise Invalid('dimensions must be an object with L, W and H.')
    result={}
    for k,(lo,hi) in LIMITS.items():
        raw=number(dims.get(k),k,0.001,10000)*scale
        result[k]=round(number(raw,k+' in mm',lo-1e-8,hi+1e-8),4)
    return result

def config(data):
    template=data.get('template_id','mailer')
    if template not in [t['id'] for t in TEMPLATES]: raise Invalid('Unknown template_id.')
    d=dimensions(data)
    mat=data.get('material','kraft'); finish=data.get('finish','matte'); q=data.get('quantity',500)
    if mat not in ('kraft','sbs','rigid'): raise Invalid('Unknown material.')
    if finish not in ('matte','gloss','soft'): raise Invalid('Unknown finish.')
    if isinstance(q,bool) or not isinstance(q,int) or q not in (100,250,500,1000,2500,5000): raise Invalid('Unsupported quantity.')
    return dict(template_id=template,dimensions_mm=d,material=mat,finish=finish,quantity=q,dimension_basis='nominal preview dimensions; usable internal size is not verified',production_ready=False)

def estimate(c):
    return dict(currency='PKR',unit_price=None,total=None,quantity=c['quantity'],quote_required=True,
                illustrative=False,excludes=['shipping','taxes'],
                notice='Custom dimensions, material and printing need a confirmed quote. No price has been calculated.')

def load_catalogue():
    """Load the merchant-maintained guide catalogue, never request-supplied prices."""
    path=ROOT/'shop-catalogue.json'
    if not path.is_file(): return []
    products=json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(products,list): raise ValueError('Product catalogue must be an array.')
    return products

def catalogue_estimate(data):
    items=data.get('items')
    if not isinstance(items,list) or not 1<=len(items)<=100:
        raise Invalid('items must contain between 1 and 100 products.')
    products={p['id']:p for p in load_catalogue()}
    lines=[]
    subtotal=Decimal('0')
    for item in items:
        if not isinstance(item,dict): raise Invalid('Each item must be an object.')
        product_id=item.get('productId')
        if not isinstance(product_id,str) or product_id not in products:
            raise Invalid('Unknown productId.')
        product=products[product_id]
        option_index=item.get('optionIndex',0)
        options=product.get('options',[])
        if isinstance(option_index,bool) or not isinstance(option_index,int) or not 0<=option_index<len(options):
            raise Invalid('Unknown optionIndex.')
        option=options[option_index]
        quantity=item.get('quantity')
        minimum=option.get('minQty',1)
        step=option.get('step',1)
        if isinstance(quantity,bool) or not isinstance(quantity,int) or not minimum<=quantity<=100000:
            raise Invalid(f'quantity must be a whole number from {minimum} to 100000.')
        if (quantity-minimum)%step: raise Invalid(f'quantity must increase in steps of {step} from {minimum}.')
        custom_print=item.get('customPrint',False)
        if not isinstance(custom_print,bool): raise Invalid('customPrint must be true or false.')
        unit_price=option.get('unitPrice')
        has_price=(not isinstance(unit_price,bool) and isinstance(unit_price,(int,float))
                   and math.isfinite(unit_price) and unit_price>=0)
        quote_required=custom_print or not has_price
        pack_units=option.get('unitsPerPack',1)
        total_units=quantity*pack_units
        total=None
        if not quote_required:
            amount=(Decimal(str(unit_price))*total_units).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
            total=float(amount)
            subtotal+=amount
        lines.append(dict(productId=product_id,name=product['name'],optionIndex=option_index,
                          optionLabel=option['label'],quantity=quantity,unitsPerPack=pack_units,
                          totalUnits=total_units,unitPrice=unit_price if has_price else None,
                          guideTotal=total,lineTotal=total,quoteRequired=quote_required,customPrint=custom_print,
                          basis=option.get('basis',''),source=option.get('source'),currency='PKR'))
    unpriced=any(line['quoteRequired'] for line in lines)
    return dict(currency='PKR',subtotal=float(subtotal),quoteRequired=unpriced,hasUnpriced=unpriced,
                guideOnly=True,lines=lines,excludes=['shipping','taxes'],
                notice='Guide prices pending confirmation. Custom printing, delivery and taxes are quoted separately. This is not an order.')

def same_origin(origin,host):
    """Match browser origins against the served host; accept TLS terminated by a proxy."""
    if origin is None: return True
    try:
        source=urlsplit(origin)
        destination=urlsplit('//'+(host or ''))
        if source.scheme not in ('http','https') or source.username or source.password:
            return False
        if source.path or source.query or source.fragment or not source.hostname or not destination.hostname:
            return False
        source_port=source.port or (443 if source.scheme=='https' else 80)
        destination_port=destination.port or (443 if source.scheme=='https' else 80)
        return source.hostname.lower()==destination.hostname.lower() and source_port==destination_port
    except ValueError:
        return False

def server_address():
    host=os.environ.get('HOST','127.0.0.1')
    try: port=int(os.environ.get('PORT','4173'))
    except ValueError: raise ValueError('PORT must be a whole number from 1 to 65535.')
    if not 1<=port<=65535: raise ValueError('PORT must be a whole number from 1 to 65535.')
    return host,port

def recommend(data):
    unit=data.get('unit','mm')
    if unit not in ('mm','in'): raise Invalid('unit must be mm or in.')
    factor=25.4 if unit=='in' else 1
    product=data.get('product',{})
    if not isinstance(product,dict): raise Invalid('product must contain L, W and H.')
    clearance=number(data.get('clearance_mm',4),'clearance_mm',0,50)
    p={k:number(product.get(k),'product.'+k,.01,10000)*factor for k in LIMITS}
    target={k:round(v+clearance,3) for k,v in p.items()}
    supported=all(lo<=target[k]<=hi for k,(lo,hi) in LIMITS.items())
    return dict(target_internal_mm=target,clearance_added_per_dimension_mm=clearance,within_editor_range=supported,source=SOURCE,notice='Starting target for usable internal space, not a confirmed fit. Add insert/cushioning allowances and verify board thickness and a physical sample. Editor geometry uses nominal dimensions.')

def dieline(c):
    model=manifest(c['template_id'],c['dimensions_mm'])
    origins={}
    paths={'cut':[],'crease':[]}
    points=[]
    for panel in model['panels']:
        x,y=origins.get(panel['parent'],(0,0))
        x+=panel['hinge'][0]
        y+=panel['hinge'][1]
        origins[panel['id']]=(x,y)
        points.extend((x+a,-y-b) for a,b in panel['outline'])
        for kind,segments in [('cut',panel['cuts']),('crease',([panel['crease']] if 'crease' in panel else [])+panel.get('scores',[]))]:
            for (a,b),(e,f) in segments:
                paths[kind].append(f'M{x+a:.4f},{-y-b:.4f} L{x+e:.4f},{-y-f:.4f}')
    xs,ys=zip(*points)
    left,top=min(xs)-8,min(ys)-8
    width,height=max(xs)-left+8,max(ys)-top+8
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}mm" height="{height}mm" viewBox="{left} {top} {width} {height}">'
            '<title>Folio review dieline. Not production ready.</title>'
            f'<path id="cuts" d="{" ".join(paths["cut"])}" fill="none" stroke="#d83e57" stroke-width=".35"/>'
            f'<path id="creases" d="{" ".join(paths["crease"])}" fill="none" stroke="#178258" stroke-width=".35" stroke-dasharray="2 1"/></svg>')


class Handler(BaseHTTPRequestHandler):
    server_version='Folio/1.0'
    def send(self,status,body,kind='application/json'):
        content=json.dumps(body,allow_nan=False).encode() if kind=='application/json' else (body.encode() if isinstance(body,str) else body)
        self.send_response(status);self.send_header('Content-Type',kind+'; charset=utf-8' if kind.startswith('text/') or kind=='application/json' else kind)
        self.send_header('Content-Length',str(len(content)));self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(content)
    def do_GET(self):
        path=urlsplit(self.path).path
        if path=='/api/v1/health': return self.send(200,dict(status='ok',service='Folio Packaging API',version='1.0',mode='catalogue-and-mockup-preview'))
        if path=='/catalog.js': return self.send(200,'window.FOLIO_TEMPLATES='+json.dumps(TEMPLATES)+';window.FOLIO_MODELS='+json.dumps({t['id']:manifest(t['id'],t['dimensions_mm']) for t in TEMPLATES})+';', 'text/javascript')
        if path=='/api/v1/templates': return self.send(200,dict(templates=TEMPLATES,limits_mm=LIMITS,materials=['kraft','sbs','rigid'],finishes=['matte','gloss','soft']))
        if path=='/api/v1/products': return self.send(200,dict(currency='PKR',products=load_catalogue()))
        allowed={'/shop.css':'shop.css','/shop.js':'shop.js','/shop-art.js':'shop-art.js','/shop-data.js':'shop-data.js','/shop-catalogue.json':'shop-catalogue.json','/favicon.svg':'favicon.svg','/robots.txt':'robots.txt','/garment-model.js':'garment-model.js','/story.css':'story.css','/story.js':'story.js','/story-scene.js':'story-scene.js','/hoodie':'hoodie.html','/hoodie.js':'hoodie.js','/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/editor.js':'editor.js','/workspace.js':'workspace.js','/api-client.js':'api-client.js','/studio.js':'studio.js','/folding-engine.js':'folding-engine.js','/product.js':'product.js','/embed-demo':'embed-demo.html','/api-docs':'api-docs.html','/vendor/three.min.js':'vendor/three.min.js'}
        if path not in allowed:return self.send(404,dict(error='not_found',message='Route not found.'))
        f=ROOT/allowed[path]
        if not f.is_file():return self.send(404,dict(error='not_found',message='Route not found.'))
        kinds={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain'}
        if f.suffix=='.json': return self.send(200,json.loads(f.read_text(encoding='utf-8')))
        return self.send(200,f.read_bytes(),kinds.get(f.suffix,'application/octet-stream'))
    def do_POST(self):
        path=urlsplit(self.path).path
        if path not in ['/api/v1/configurations/validate','/api/v1/estimates','/api/v1/catalogue/estimate','/api/v1/dielines','/api/v1/sizing/recommend','/api/v1/models','/api/v1/models/pose','/api/v1/recommendations']:return self.send(404,dict(error='not_found',message='Route not found.'))
        # The API is same-origin. No cross-site browser submissions or CORS access.
        origin=self.headers.get('Origin')
        if not same_origin(origin,self.headers.get('Host')):return self.send(403,dict(error='origin_not_allowed',message='Use the Folio website on the same domain.'))
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.send(415,dict(error='content_type',message='Send application/json.'))
        try:
            size=int(self.headers.get('Content-Length',0))
            if size<1 or size>32768: return self.send(413,dict(error='body_size',message='Body must be 1–32768 bytes.'))
            self.connection.settimeout(10)
            data=json.loads(self.rfile.read(size))
            if not isinstance(data,dict):raise Invalid('Request body must be an object.')
            if path.endswith('/catalogue/estimate'):return self.send(200,catalogue_estimate(data))
            if path.endswith('/recommendations'):
                description=data.get('description','')
                if not isinstance(description,str) or not 10<=len(description)<=2000:raise Invalid('Describe the product in 10–2000 characters.')
                product=data.get('product')
                if product is not None:
                    if not isinstance(product,dict):raise Invalid('product must be an object.')
                    product={k:number(product.get(k),'product.'+k,1,2000) for k in ('L','W','H')}
                return self.send(200,recommend_product(description,product))
            if path.endswith('/sizing/recommend'):return self.send(200,recommend(data))
            c=config(data)
            if path.endswith('/models'):return self.send(200,manifest(c['template_id'],c['dimensions_mm']))
            if path.endswith('/models/pose'):
                progress=number(data.get('progress',0),'progress',0,1)
                return self.send(200,pose(manifest(c['template_id'],c['dimensions_mm']),progress))
            if path.endswith('/validate'):return self.send(200,c)
            if path.endswith('/estimates'):return self.send(200,estimate(c))
            return self.send(200,dieline(c),'image/svg+xml')
        except (Invalid,ValueError,UnicodeDecodeError) as e:return self.send(422,dict(error='validation_error',message=str(e)))
        except TimeoutError:return self.send(408,dict(error='timeout',message='Request timed out.'))

if __name__=='__main__':
    host,port=server_address()
    display_host='localhost' if host in ('0.0.0.0','127.0.0.1','::') else host
    print(f'Folio Studio: http://{display_host}:{port} | API docs: http://{display_host}:{port}/api-docs',flush=True)
    ThreadingHTTPServer((host,port),Handler).serve_forever()
