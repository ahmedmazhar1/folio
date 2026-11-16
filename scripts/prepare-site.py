#!/usr/bin/env python3
"""Build the existing EcoPak site as one portable Sites Worker ES module.

No frontend framework or package install is needed. Public text files and the
essential logo are embedded; product image paths proxy only pinned imported
Shopify source URLs. Python/Docker continues serving the local photo copies.
"""
import argparse,ast,hashlib,json,mimetypes,shutil,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from server import TEMPLATES
from packaging import manifest

def build(output):
    hosting_path=ROOT/'.openai/hosting.json'
    if not hosting_path.is_file():raise SystemExit('Create .openai/hosting.json with the Sites project ID before building.')
    hosting=json.loads(hosting_path.read_text())
    if hosting.get('static') is not None:raise SystemExit('Remove static configuration for the Worker deployment.')
    if hosting.get('d1')!='DB':raise SystemExit('The enquiry Worker requires the logical D1 binding "DB".')
    tree=ast.parse((ROOT/'server.py').read_text());allowed=None
    for node in ast.walk(tree):
        if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='allowed' for t in node.targets):allowed=ast.literal_eval(node.value);break
    if allowed is None:raise SystemExit('Could not read server public-file allowlist.')
    resources={};binary={}
    for route,name in allowed.items():
        path=ROOT/name
        if not path.is_file():continue
        mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        if path.suffix=='.js':mime='text/javascript'
        if path.suffix in ('.html','.js','.css','.json','.txt','.svg'):resources[route]={'body':path.read_text(),'type':mime+('; charset=utf-8' if path.suffix!='.svg' else '')}
    catalogue=json.loads((ROOT/'shop-catalogue.json').read_text())
    resources['/catalog.js']={'body':'window.FOLIO_TEMPLATES='+json.dumps(TEMPLATES,separators=(',',':'))+';window.FOLIO_MODELS='+json.dumps({t['id']:manifest(t['id'],t['dimensions_mm']) for t in TEMPLATES},separators=(',',':'))+';','type':'text/javascript; charset=utf-8'}
    photo_sources={}
    def walk(value):
        if isinstance(value,list):
            for item in value:walk(item)
        elif isinstance(value,dict):
            if isinstance(value.get('src'),str):
                src=value['src'];source=value.get('sourceUrl')
                if src.startswith('/assets/ecopak/') and source:photo_sources[src]=source
                elif src.startswith('https://cdn.shopify.com/'):
                    prefix=hashlib.sha256(src.encode()).hexdigest()[:20]
                    for local in (ROOT/'assets/ecopak').glob(prefix+'.*'):photo_sources['/assets/ecopak/'+local.name]=src
            for item in value.values():walk(item)
    walk(catalogue)
    site_config=json.loads((ROOT/'backend-config.json').read_text())
    dates=[o.get('source',{}).get('date','') for p in catalogue for o in p.get('options',[])]
    site_config['catalogueDate']=max(dates,default='')
    site_config['emailActivated']=False if site_config.get('emailActivated') is not True else True
    declarations='\n'.join('const '+name+'='+json.dumps(value,separators=(',',':'))+';' for name,value in [('STATIC_TEXT',resources),('STATIC_BINARY',binary),('PHOTO_SOURCES',photo_sources),('SITE_CONFIG',site_config),('TEMPLATES',TEMPLATES),('CATALOGUE',catalogue)])
    geometry=(ROOT/'portpackaging.js').read_text().replace('export function ','function ')
    worker='\n'.join(line for line in (ROOT/'worker.js').read_text().splitlines() if not line.startswith('import '))
    (output/'server').mkdir(parents=True,exist_ok=True)
    (output/'.openai').mkdir(parents=True,exist_ok=True)
    (output/'server/index.js').write_text(declarations+'\n'+geometry+'\n'+worker)
    (output/'.openai/hosting.json').write_text(json.dumps(hosting,indent=2)+'\n')
    if (ROOT/'drizzle').is_dir():shutil.copytree(ROOT/'drizzle',output/'.openai/drizzle',dirs_exist_ok=True)
    size=(output/'server/index.js').stat().st_size
    print(json.dumps({'worker':str(output/'server/index.js'),'bytes':size,'textRoutes':len(resources),'photoRoutes':len(photo_sources),'embeddedLogos':len(binary),'d1Binding':'DB','emailActivated':site_config['emailActivated']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'dist');args=parser.parse_args();build(args.output.resolve())
