#!/usr/bin/env python3
"""Enrich the saved EcoPak catalogue; never changes supplier catalogue or prices.

Published dimensions are separate from explicitly estimated display geometry.
Pacdora URLs below were followed from official catalogue/tool pages on 2026-11-15.
Their existence is verified; equivalence to EcoPak dies is not asserted.
"""
import json, re, hashlib
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'shop-catalogue.json'
DATE='2026-11-15'

def ref(name,url,source,model=None,page='dieline'):
    return dict(name=name,url=url,modelId=model,pageType=page,discoveredOn=source,
                verification='official-link-confirmed',matchStatus='candidate',
                note='Official page/link verified. EcoPak construction, flaps, locks and manufacturing allowances still need visual/dieline confirmation.')

PACDORA={
 'cake-window':ref('Cake box with window template','https://www.pacdora.com/dielines-detail/custom-dimensions-cake-box-gift-dieline-160025','https://www.pacdora.com/tools/cake-box-template','160025'),
 'cake-carton':ref('Cake box template / angled tuck-end variation','https://www.pacdora.com/dielines-detail/custom-dimensions-tuck-end-box-variations-angled-dieline-110180','https://www.pacdora.com/tools/cake-box-template','110180'),
 'bakery-window':ref('Dessert box template / flip-top with window','https://www.pacdora.com/dielines-detail/custom-dimensions-flip-top-boxes-with-window-dieline-153181','https://www.pacdora.com/tools/cake-box-template','153181'),
 'loaf-window':ref('Loaf cake box template / flip-top with window','https://www.pacdora.com/dielines-detail/custom-dimensions-flip-top-boxes-with-window-dieline-150301','https://www.pacdora.com/tools/cake-box-template','150301'),
 'cake-slice':ref('Cake slice template / flip-top pizza variation','https://www.pacdora.com/dielines-detail/custom-dimensions-flip-top-boxes-pizza-dieline-156211','https://www.pacdora.com/tools/cake-box-template','156211'),
 'gable-handle':ref('Cake box with handle / gable box with window','https://www.pacdora.com/dielines-detail/gable-box-with-window-dieline-112290','https://www.pacdora.com/tools/cake-box-template','112290'),
 'self-locking-tuck':ref('Self-locking flip top and front tuck box','https://www.pacdora.com/dielines-detail/self-locking-flip-top-and-front-tuck-box-dieline-120257','https://www.pacdora.com/dielines-detail/self-locking-flip-top-and-front-tuck-box-dieline-120257?id=72396863','120257'),
 'mailer':ref('FEFCO 0429 flip top mailer box mockup','https://www.pacdora.com/mockup-detail/mailer-boxes-flip-top-mockup-150020','https://www.pacdora.com/tools/custom-mailer-box','150020','mockup'),
 'mailer-lock':ref('Cardboard mailer box with lock mockup','https://www.pacdora.com/mockup-detail/cardboard-box-paper-box-mockup-206090','https://www.pacdora.com/tools/custom-mailer-box','206090','mockup'),
 'paper-bag-handles':ref('Gift paper bag mockup','https://www.pacdora.com/mockup-detail/gift-paper-bag-mockup-651124','https://www.pacdora.com/tools/custom-paper-bags','651124','mockup'),
 'paper-bag':ref('Foldable shopping paper bag mockup','https://www.pacdora.com/mockup-detail/foldable-shopping-paper-bag-mockup-651101','https://www.pacdora.com/tools/custom-paper-bags','651101','mockup'),
 'burger':ref('Burger box template','https://www.pacdora.com/dielines-detail/burger-box-dieline-151300','https://www.pacdora.com/tools/burger-box-template','151300'),
 'burger-wide':ref('Fast food burger box template','https://www.pacdora.com/dielines-detail/burger-box-dieline-158130','https://www.pacdora.com/tools/burger-box-template','158130'),
 'food-tray':ref('Food paper tray template','https://www.pacdora.com/dielines-detail/food-paper-tray-dieline-610700','https://www.pacdora.com/tools/burger-box-template','610700'),
 'folding-tray':ref('Custom tray template / four folds','https://www.pacdora.com/dielines-detail/custom-dimensions-tray-boxes-four-folds-dieline-120360','https://www.pacdora.com/tools/paper-tray-template','120360'),
 'snap-tray':ref('Square tray template / snap-lock tray','https://www.pacdora.com/dielines-detail/custom-dimensions-tray-boxes-snap-lock-tray-dieline-120080','https://www.pacdora.com/tools/paper-tray-template','120080'),
 'takeout-tray':ref('Custom take out box template / dome tray','https://www.pacdora.com/dielines-detail/custom-dimensions-tray-boxes-dome-dieline-120230','https://www.pacdora.com/tools/chinese-food-box-template','120230'),
 'coffee-cup':ref('Paper coffee cup mockup','https://www.pacdora.com/mockup-detail/paper-coffee-cup-mockup-511400','https://www.pacdora.com/resource/coffee-cup-mockup','511400','mockup'),
 'cup-lid':ref('Coffee cup with lid mockup','https://www.pacdora.com/mockup-detail/cup-with-lid-mockup-601790','https://www.pacdora.com/resource/coffee-cup-mockup','601790','mockup'),
 'cup-carrier':ref('Paper cup holder mockup','https://www.pacdora.com/3d-modeling?id=irkfgqfhh4','https://www.pacdora.com/tools/coffee-packaging-mockup','2767','scene-model'),
 'bowls-library':ref('Bowl mockup library','https://www.pacdora.com/mockups/bowl-mockups','https://www.pacdora.com/mockups/bowl-mockups',None,'category'),
 'food-containers-library':ref('Food container mockups','https://www.pacdora.com/mockups/food-container-mockups','https://www.pacdora.com/mockups/bowl-mockups',None,'category'),
}

NUM=r'(\d+(?:\.\d+)?)'
UNIT=r'(mm|millimeters?|millimetres?|cm|centimeters?|centimetres?|inches|inch|in\b|["”])'
TRIPLE=re.compile(NUM+r'\s*(?:["”])?\s*[x×*]\s*'+NUM+r'\s*(?:["”])?\s*[x×*]\s*'+NUM+r'\s*'+UNIT,re.I)
PAIR=re.compile(NUM+r'\s*(?:["”])?\s*(?:inches\s*)?[x×*]\s*'+NUM+r'\s*'+UNIT,re.I)

def factor(unit):return 1 if unit.lower().startswith(('mm','milli')) else 10 if unit.lower().startswith(('cm','centi')) else 25.4
def mm(value,unit):return round(float(value)*factor(unit),4)
def unique(items):
    seen=set();out=[]
    for item in items:
        key=json.dumps(item,sort_keys=True)
        if key not in seen:out.append(item);seen.add(key)
    return out

def measurement(source,text,kind,values,unit,axes=None):
    return dict(source=source,text=text.strip(),kind=kind,values=[float(x) for x in values],unit=unit,
                axes=axes,mm=[mm(x,unit) for x in values])

def family(p):
    s=(p['name']+' '+p['id']+' '+p['material']).lower();cat=p['category']
    if p['id']=='bamboo-fruit-fork-100-pcs-per-bundle':return 'fruit-fork','cutlery'
    if cat=='samples':return 'sample-pack','sample-pack'
    if cat=='bundles':return 'bundle','bundle'
    if cat=='stickers':return ('circle-sticker' if 'circle' in s else 'rectangular-sticker'),'sticker'
    if cat=='wraps':return ('straw','straw') if 'straw' in s else ('printed-sheet','sheet')
    if cat=='cutlery':
        return next((n for n in ['chopsticks','skewer','stirrer','spork','fork','spoon'] if n in s),'cutlery'),'cutlery'
    if cat=='bags':return ('paper-bag-handles' if any(w in s+' '+p['description'].lower() for w in ['rope','handle']) else 'paper-bag'),'paper-bag'
    if cat=='boxes':return 'corrugated-mailer','folding-box'
    if cat=='bowls':return 'paper-bowl-lid','bowl'
    if cat=='bagasse':
        if any(w in s for w in ['bento','lunch']):return 'bagasse-clamshell','moulded-clamshell'
        if 'sushi' in s:return 'bagasse-tray-lid','food-tray'
        return ('bagasse-square-bowl' if 'square' in s else 'bagasse-bowl-lid'),'bowl'
    if cat=='coffee':
        if 'carrier' in s:return ('bowl-carrier' if 'bowl' in s else 'cup-carrier'),'cup-carrier'
        return 'coffee-cup-lid','cup'
    if cat=='food':
        if 'aluminium' in s:return 'aluminium-tray','aluminium-tray'
        if 'cone' in s:return 'fries-cone','food-cone'
        if 'tray' in s:return 'paper-food-tray','food-tray'
        if 'handle' in s:return 'gable-food-box','folding-box'
        if 'takeout-container' in s:return 'fold-top-takeout','folding-box'
        return 'burger-clamshell','folding-box'
    if cat=='bakery':
        if 'cupcake-cups' in s:return 'paper-baking-cup','paper-baking-cup'
        if p['id']=='loaf-pan-with-clear-lid':return 'baking-tray-lid','food-tray'
        if 'slice' in s:return 'cake-slice','cake-slice-box'
        if 'tall-cake' in s:return 'tall-cake-carton','folding-box'
        if 'cupcake-box' in s:return 'cupcake-carton','folding-box'
        if p['id']=='brownie-box-10x6x3-inches':return 'self-locking-front-tuck','folding-box'
        if p['id'] in ['kraft-cake-box-8-5x8-5x4','cakebox8-5x8-5x4']:return 'window-cake-carton','folding-box'
        d=p['description'].lower()
        if 'without-window' not in s and ('window' in s or 'features a window' in d):return 'window-bakery-carton','folding-box'
        if 'loaf' in s:return 'loaf-carton','folding-box'
        return ('plain-cake-carton' if 'cake-box' in s else 'bakery-carton'),'folding-box'
    return 'product','folding-box'

FAMILY_DEFAULTS={
 'folding-box':dict(L=180,W=150,H=75), 'paper-bag':dict(L=230,W=120,H=300),
 'food-tray':dict(L=180,W=120,H=45),'bowl':dict(L=150,W=150,H=75,topDiameter=150,bottomDiameter=115),
 'cup':dict(L=85,W=85,H=95,topDiameter=85,bottomDiameter=58),
 'cup-carrier':dict(L=190,W=100,H=220,holeDiameter=80),
 'cutlery':dict(L=160,W=28,H=3,length=160),'straw':dict(L=200,W=8,H=8,length=200,diameter=8),
 'sheet':dict(L=254,W=228.6,H=.15),'sticker':dict(L=50.8,W=50.8,H=.2),
 'moulded-clamshell':dict(L=150,W=150,H=75),'aluminium-tray':dict(L=200,W=135,H=50),
 'bundle':dict(L=360,W=260,H=240),'sample-pack':dict(L=320,W=240,H=180),
 'paper-baking-cup':dict(L=65,W=65,H=45,topDiameter=65,bottomDiameter=50),
 'cake-slice-box':dict(L=165.1,W=101.6,H=101.6),'food-cone':dict(L=110,W=110,H=180,diameter=110)
}

CANDIDATES={
 'corrugated-mailer':('corr-roll-end-wing','mailer'),
 'window-cake-carton':('board-window-cake','cake-window'),
 'window-bakery-carton':('board-window-cake','bakery-window'),
 'plain-cake-carton':('board-roll-end','cake-carton'),
 'tall-cake-carton':('board-tuck-end','cake-carton'),
 'cupcake-carton':('board-self-locking-tuck','bakery-window'),
 'self-locking-front-tuck':('board-self-locking-tuck','self-locking-tuck'),
 'bakery-carton':('board-roll-end','self-locking-tuck'),
 'loaf-carton':('board-roll-end','loaf-window'),
 'cake-slice':(None,'cake-slice'),
 'paper-bag':('board-paper-bag','paper-bag'),
 'paper-bag-handles':('board-paper-bag','paper-bag-handles'),
 'burger-clamshell':(None,'burger'),
 'fold-top-takeout':(None,'takeout-tray'),
 'gable-food-box':(None,'gable-handle'),
 'paper-food-tray':('board-simple-tray','food-tray'),
 'baking-tray-lid':('board-simple-tray','folding-tray'),
 'bagasse-tray-lid':(None,'food-containers-library'),
 'bagasse-clamshell':(None,'food-containers-library'),
 'paper-bowl-lid':(None,'bowls-library'),
 'bagasse-bowl-lid':(None,'bowls-library'),
 'bagasse-square-bowl':(None,'bowls-library'),
 'coffee-cup-lid':(None,'coffee-cup'),
 'cup-carrier':(None,'cup-carrier'),
 'bowl-carrier':(None,'cup-carrier')
}

def measure_product(p,fam,geo):
    entries=[];notes=[];dims={};conflicts=[]
    # Only own-size declarations are parsed, never dimensions of recommended contents.
    lines=[('title',p['name'])]
    lines += [('description',l.strip()) for l in p['description'].splitlines() if re.search(r'\b(size|dimensions?|diameter|height|width|depth)\b',l,re.I)]
    triples=[]
    for source,line in lines:
        m=TRIPLE.search(line)
        if m:
            values=list(m.groups()[:3]);unit=m.group(4);record=measurement(source,line,'three-axis',values,unit,['L','W','H'] if geo not in ['paper-bag','cup-carrier'] else ['first','second','third'])
            entries.append(record);triples.append(record)
    if triples and geo not in ['bundle','sample-pack']:
        primary=next((m for m in triples if m['source']=='description'),triples[0])
        if geo=='paper-bag':
            # Preserve source numbers while recording any uncertain axis interpretation.
            labeled=next((line for _,line in lines if re.search(r'height|\(width\)',line,re.I)),None)
            if p['id']=='kraft-small-paper-bag':
                dims=dict(L=215.9,W=139.7,H=228.6)
                entries.append(measurement('description',labeled,'labeled-axes',[8.5,5.5,9],'in',['L','W','H']))
            elif p['id']=='kraft-apparel-bag-17-x-14-x-4-5-inches':
                dims=dict(L=431.8,W=114.3)
                entries.append(measurement('description',labeled,'labeled-axes',[17,4.5,14],'in',['L','W','H']))
                conflicts.append(dict(parameter='H',publishedValuesMm=[330.2,355.6],titleText=p['name'],descriptionText=labeled))
                notes.append('Title lists 13 inches, labeled description lists height 14 inches. The preview follows the labeled description; supplier confirmation is needed.')
            else:notes.append('Three measurements are published, but the bag axis order is not labeled. The display axis assignment is an estimate.')
        elif geo=='cup-carrier':
            notes.append('Carrier measurements are published without axis labels. Handle geometry, hole diameters and the display axis assignment are estimated.')
        else:
            dims=dict(zip(['L','W','H'],primary['mm']))
            for record in triples:
                if record['mm']!=primary['mm']:conflicts.append(dict(parameter='L/W/H',publishedValuesMm=record['mm'],sourceText=record['text']))
    if geo=='bowl':
        for _,line in lines:
            m=re.search(r'(?:top\s+)?diameter\s*:\s*'+NUM+r'\s*'+UNIT+r'.*?height\s*:\s*'+NUM+r'\s*'+UNIT,line,re.I)
            if m:
                vals=m.groups();dims.update(topDiameter=mm(vals[0],vals[1]),H=mm(vals[2],vals[3]));entries += [measurement('description',line,'diameter',[vals[0]],vals[1],['topDiameter']),measurement('description',line,'height',[vals[2]],vals[3],['H'])]
            m=re.search(NUM+r'\s*diameter\s*[x×]\s*height\s*'+NUM+r'\s*'+UNIT,line,re.I)
            if m:
                a,b,unit=m.groups();dims.update(topDiameter=mm(a,unit),H=mm(b,unit));entries += [measurement('description',line,'diameter-height',[a,b],unit,['topDiameter','H'])]
        if 'topDiameter' in dims:dims.update(L=dims['topDiameter'],W=dims['topDiameter'])
    if geo=='cutlery':
        for source,text in [('title',p['name'])]+[('description',l.strip()) for l in p['description'].splitlines() if l.strip()]:
            for m in re.finditer(NUM+r'\s*(mm|cm|centimeters?|centimetres?)\b',text,re.I):
                value,unit=m.groups();entries.append(measurement(source,text,'length',[value],unit,['length']))
                if 'length' not in dims:dims.update(length=mm(value,unit),L=mm(value,unit))
    if geo=='straw':
        m=re.search(NUM+r'\s*mm',p['name'],re.I)
        if m:dims.update(diameter=float(m.group(1)),W=float(m.group(1)),H=float(m.group(1)));entries.append(measurement('title',p['name'],'diameter',[m.group(1)],'mm',['diameter']))
    # Capacity is retained as capacity, never converted into physical dimensions.
    capacities=[]
    for source,text in [('title',p['name'])]+[('description',l.strip()) for l in p['description'].splitlines() if re.search(r'\bsize|\bcapacity',l,re.I)]:
        for match in re.finditer(NUM+r'\s*(ml|ounces?|oz)\b',text,re.I):capacities.append(dict(source=source,text=text,value=float(match.group(1)),unit=match.group(2).lower()))
    preview=dict(FAMILY_DEFAULTS[geo]);estimated=set(preview)-set(dims);preview.update(dims)
    if geo=='paper-bag' and triples:
        v=triples[0]['mm']
        if p['id']=='paper-bags-for-cake-boxes':preview.update(L=v[0],W=v[1],H=v[2])
        elif p['id']=='kraft-bakery-bag-10x6-5x6-inches-with-twisted-rope-handle':preview.update(L=v[0],W=v[1],H=v[2])
        elif p['id']=='kraft-apparel-bag-17-x-14-x-4-5-inches':preview.update(L=431.8,W=114.3,H=355.6)
        elif not dims:preview.update(L=v[1],W=v[2],H=v[0])
    if geo=='cup-carrier' and triples:
        v=triples[0]['mm'];preview.update(L=v[0],W=v[1],H=v[2])
    if geo=='bowl':
        if not dims and capacities:
            capacity=next((c['value'] for c in capacities if c['unit']=='ml'),700)
            diameter=145 if capacity<=700 else 170 if capacity<=1000 else 190
            height=65 if capacity<=700 else 75
            preview.update(L=diameter,W=diameter,H=height,topDiameter=diameter,bottomDiameter=diameter*.75)
        elif 'topDiameter' in dims:preview['bottomDiameter']=round(dims['topDiameter']*.76,3)
    if geo=='cutlery':
        if fam in ['chopsticks','skewer']:preview.update(W=5,H=5)
        elif fam=='stirrer':preview.update(W=6,H=1.5)
        if fam=='chopsticks' and not dims:preview.update(L=230,length=230)
        if fam=='fruit-fork' and not dims:preview.update(L=90,length=90,W=12,H=2)
    if geo in ['sheet','sticker']:
        # Nominal sheet/sticker size is variant-specific. Use the first published variant below.
        notes.append('Select a listed variant for its published two-dimensional size. Display thickness is estimated.')
    if geo in ['bundle','sample-pack']:
        dims={};notes.append('This is a display arrangement of component products, not a single folding die or a published outer-package size.')
    if conflicts:status='conflicting'
    elif geo in ['sheet','sticker']:status='unspecified'
    elif geo=='paper-bag':status='exact-published' if len(dims)==3 else 'partial' if entries else 'unspecified'
    elif geo in ['bowl','cutlery','straw','cup-carrier']:status='partial' if entries or capacities else 'unspecified'
    elif all(k in dims for k in ['L','W','H']):status='exact-published'
    elif dims or entries or capacities:status='partial'
    else:status='unspecified'
    return dims,preview,sorted(estimated),unique(entries),unique(capacities),status,conflicts,notes

def variant_data(p,geo,base,published):
    result={}
    for option in p['options']:
        label=option['label'];dims=dict(published) if geo not in ['sheet','sticker','sample-pack','bundle'] else {};entries=[];notes=[]
        if geo in ['sheet','sticker']:
            m=PAIR.search(label)
            if m:
                a,b,unit=m.groups();dims=dict(L=mm(a,unit),W=mm(b,unit));entries.append(measurement('variant',label,'two-axis',[a,b],unit,['L','W']))
            elif geo=='sticker' and 'circle' in label.lower():
                m=re.search(NUM+r'\s*'+UNIT,label,re.I)
                if m:
                    a,unit=m.groups();d=mm(a,unit);dims=dict(L=d,W=d,diameter=d);entries.append(measurement('variant',label,'diameter',[a],unit,['diameter']))
        elif geo=='cutlery':
            m=re.search(NUM+r'\s*(cm|mm)\b',label,re.I)
            if m:
                a,unit=m.groups();dims=dict(L=mm(a,unit),length=mm(a,unit));entries.append(measurement('variant',label,'length',[a],unit,['length']))
        elif geo=='sample-pack':
            m=TRIPLE.search(label)
            if m:
                a,b,c,unit=m.groups();entries.append(measurement('variant',label,'component-three-axis',[a,b,c],unit,None))
            # Unitless sample labels such as 10x6x3 are preserved, not silently assumed inches.
            elif re.search(r'\d\s*[x×*]\s*\d',label):notes.append('Component dimensions appear without an explicit unit; resolved product data is preferred.')
        preview=dict(base);preview.update(dims)
        estimated=sorted(set(preview)-set(dims))
        result[str(option['variantId'])]=dict(label=label,dimensionsMm=dims,previewDimensionsMm=preview,inheritsProductDimensions=geo not in ['sheet','sticker','sample-pack','bundle'],
                    estimatedParameters=estimated,measurements=entries,notes=notes)
    return result

BUNDLE_COMPONENTS={
 'bundle-product-39':[(50,'white-480-ml-kraft-bowl-with-lid','480ml Kraft Bowl with Lid','candidate'),(50,None,'250ml Kraft Bowl with Lid','unresolved')],
 'bundle-product-33':[(50,'bagasse-bento-cake-box-lunch-box','Bagasse Bento Box'),(100,'100mm-spoon','100mm Spoon')],
 'bundle-product-37':[(25,'kraft-bakery-cookie-pastry-box-6x6x3-inches','Kraft Bakery/Cookie Box 6 x 6 x 3'),(25,'brownie-box-10x6x3-inches','Brownie Box 10 x 6 x 3')],
 'bundle-product-31':[(25,'kraft-apparel-bag-17-x-14-x-4-5-inches','Kraft Apparel Bag'),(20,'apparel-box-corrugated-3-ply','Apparel Box')],
 'bundle-product-34':[(25,'kraft-paper-bags','Kraft Takeaway Bag 14 x 9 x 5'),(25,'kraft-box-for-burgers-and-sandwiches','Kraft Burger Box 7.5 x 4.5 x 3')],
 'bundle-product-38':[(20,'small-e-commerce-box-corrugated','Small E-Commerce Box'),(20,'medium-e-commerce-box-corrugated','Medium E-Commerce Box')],
 'bundle-product-35':[(25,'kraft-small-paper-bag','Kraft Small Takeaway Bag'),(25,'kraft-bento-burger-box','Kraft Bento Box')],
 'bundle-product-36':[(25,'loaf-cookie-box','Loaf/Cookie Box'),(25,'kraft-bakery-cookie-pastry-box-6x6x3-inches','Kraft Bakery/Cookie/Pastry Box 6 x 6 x 3')],
 'bundle-product-30':[(25,'kraft-cake-box-10-x-10-x-4-250-gsm','Cake Box 10 x 10 x 4 with window','candidate'),(25,'paper-bags-for-cake-boxes','Kraft Cake Bag')],
 'bundle-product-27':[(25,'kraft-bakery-bag-10x6-5x6-inches-with-twisted-rope-handle','Kraft Bakery Bag 10 x 6.5 x 6 with twisted rope handle'),(25,'cupcake-box-for-6-cup-cakes','Cupcake Box for 6 cupcakes')],
 'bundle-product-25':[(20,'small-e-commerce-box-corrugated','Small E-Commerce Box 6 x 4 x 3.75'),(20,'medium-e-commerce-box-corrugated','Medium E-Commerce Box 10 x 8 x 3.5')],
 'bakery-essentials-bundle-50-pcs-10-off':[(100,'kraft-trays','Kraft Trays x 100'),(50,'kraft-paper-bags','Kraft Takeaway Paper Bags 14 x 9 x 5 x 50'),(50,'kraft-box-for-burgers-and-sandwiches','Kraft Box for Burgers and Sandwiches x 50')],
 'bundle-product-23':[(50,None,'250ml Kraft round bowl with lid','unresolved'),(50,'kraft-paper-bag-with-twisted-rope-handle','Kraft paper bag with twisted rope handle 9 x 9 x 5')],
 'green-cafe-pack':[(50,'kraft-paper-bags','Kraft Takeaway Bags','candidate'),(50,'1000ml-bagassesugarcanepulp-bowl-with-lid','1000ml Bagasse Bowl with Lid')],
 'home-based-bakery-bundle':[(25,'kraft-bakery-bag-10x6-5x6-inches-with-twisted-rope-handle','Kraft Bakery Bag 10 x 6.5 x 6 with twisted rope handle'),(25,'brownie-box-10x6x3-inches','Brownie Box 10 x 6 x 3 for 6 brownies'),(25,'cupcake-box-for-6-cup-cakes','Cupcake Box for 6 cupcakes')]
}

# Display-only examples for groups whose contents are not published. These are
# deliberately separate from sourced components and never assert pack contents.
REPRESENTATIVE={
 'bundle-product-29':['10x10x10-inch-white-cake-box-for-tall-cakes','paper-bags-for-cake-boxes'],
 'bundle-product-28':['kraft-single-burger-box','kraft-small-paper-bag'],
 'bundle-product-26':['brownie-box-10x6x3-inches','kraft-bakery-bag-10x6-5x6-inches-with-twisted-rope-handle'],
 'bundle-product-24':['cupcake-box-for-6-cup-cakes','kraft-bakery-bag-10x6-5x6-inches-with-twisted-rope-handle'],
 'fast-food-essentials':['kraft-single-burger-box','kraft-trays','kraft-paper-bags'],
 'pan-asian-takeout-bundle':['1000ml-bagassesugarcanepulp-bowl-with-lid','bamboo-chopsticks-white','kraft-paper-bags'],
 'cutlery-sample-pack':['160mm-fork','160mm-spoon','160mm-birchwood-dinner-spork-for-rice-pasta-salads','100mm-spoon']
}

def component(product_id,quantity,text,known,status='name-and-size-match'):
    if product_id and product_id not in known:status='unresolved';product_id=None
    return dict(productId=product_id,quantity=quantity,sourceText=text,matchStatus=status)

def samples(p,known):
    variants={};components=[]
    for o in p['options']:
        label=o['label'];s=label.lower();target=None;status='name-and-size-match'
        if p['id']=='retail-box-samples':target=next((pid for term,pid in [('small','small-e-commerce-box-corrugated'),('medium','medium-e-commerce-box-corrugated'),('large','large-shipping-box-corrugated-plain')] if term in s),None)
        elif p['id']=='white-box-sample-pack':target=next((pid for term,pid in [('8.5x8.5x4','cakebox8-5x8-5x4'),('12x12x4','white-cake-box-12x12x4'),('doughnut','white-6-doughnut-box'),('10x10x4','white-cake-box-10x10x4-inches')] if term in s),None)
        elif p['id']=='kraft-bowl-with-lid-sample-pack':
            if '480ml' in s:target='white-480-ml-kraft-bowl-with-lid';status='candidate'
            elif '1000ml' in s:target='1000ml-kraft-salad-rice-bowl'
        elif p['id']=='bagasse-range-sample-pack':
            if '2 compartment' not in s and '1000' in s:target='1000ml-bagassesugarcanepulp-bowl-with-lid'
            elif '850' in s:target='850ml-bagasse-bowl-with-pet-lid-copy'
            elif 'medium sushi' in s:target='bagasse-sushi-tray-medium'
            elif 'small sushi' in s:target='bagasse-sushi-tray-small'
        elif p['id']=='kraft-sample-pack':
            keys=[('brownie box 10','brownie-box-10x6x3-inches'),('kraft tray','kraft-trays'),('7.5x4.5x3','kraft-box-for-burgers-and-sandwiches'),('paper bag','kraft-paper-bags'),('cake slice','cake-slice-boxes'),('cupcake','cupcake-box-for-6-cup-cakes'),('8.5x8.5x4','kraft-cake-box-8-5x8-5x4'),('single brownie','singlebrowniebox'),('single burger','kraft-single-burger-box'),('kraft dessert','small-dessert-box'),('loaf/cookie','loaf-cookie-box'),('with window','kraft-bakery-cookie-pastry-box-6x6x3-inches-with-window'),('5x5x2','small-dessert-bakery-box-5x5x2-inches'),('multipurpose','kraft-multipurpose-box-with-handle'),('takeaway box small','kraft-takeout-containers-small-5x4x3-inches')]
            target=next((pid for term,pid in keys if term in s),None)
            if 'paper bag' in s:status='candidate-size-conflict'
        quantity_match=re.match(r'(\d+)\s*pieces?',s);quantity=int(quantity_match.group(1)) if quantity_match else None
        item=component(target,quantity,label,known,status if target else 'unresolved');variants[str(o['variantId'])]=[item]
        if target and all(c['productId']!=target for c in components):components.append(item)
    return components,variants

def main():
    products=json.loads(SOURCE.read_text());known={p['id']:p for p in products};enriched={}
    # Resolve two historical handles by exact catalogue names, not guessed aliases.
    aliases={'bagasse-bento-cake-box-lunch-box':'Bagasse Bento cake box/ Lunch box','kraft-bakery-cookie-pastry-box-6x6x3-inches':'Kraft bakery/cookie/pastry box 6" x 6" x 3" inches'}
    for old,name in aliases.items():
        actual=next((p['id'] for p in products if p['name']==name),None)
        if actual:
            for key,items in BUNDLE_COMPONENTS.items():BUNDLE_COMPONENTS[key]=[tuple(actual if i==1 and value==old else value for i,value in enumerate(item)) for item in items]
    for p in products:
        fam,geo=family(p);dims,preview,estimated,entries,capacities,status,conflicts,notes=measure_product(p,fam,geo)
        variants=variant_data(p,geo,preview,dims)
        if geo in ['sheet','sticker']:
            exact=next((v for v in variants.values() if v['dimensionsMm']),None)
            if exact:dims=exact['dimensionsMm'];preview=exact['previewDimensionsMm'];estimated=exact['estimatedParameters'];entries+=exact['measurements'];status='exact-published';notes.append('Default display uses the first listed dimensional variant; all listed variant dimensions are preserved separately.')
        if geo=='cutlery' and any(v['dimensionsMm'] for v in variants.values()):
            first=next(v for v in variants.values() if v['dimensionsMm']);dims.update(first['dimensionsMm']);preview.update(first['dimensionsMm']);estimated=sorted(set(preview)-set(dims))
        features=dict(window=fam in ['window-cake-carton','window-bakery-carton'],handles=fam in ['paper-bag-handles','gable-food-box','cup-carrier','bowl-carrier'],lid=geo in ['bowl','cup','moulded-clamshell','aluminium-tray'] or fam.endswith('-lid') or fam=='paper-baking-cup' or geo in ['folding-box','cake-slice-box'],material=p['material'],cupcakeInsert=fam=='cupcake-carton')
        if fam=='cup-carrier':features['carrierSlots']=1 if 'single-cup' in p['id'] else 2;estimated.append('carrierSlots' if 'single-cup' not in p['id'] and '2-cups' not in p['id'] else 'holeDiameter')
        if fam=='bowl-carrier':features['carrierSlots']=1;estimated.append('holeDiameter')
        if fam=='paper-baking-cup':features['domeLid']=True
        if fam=='bagasse-square-bowl':features['square']=True
        if geo=='sticker':features['shape']='circle' if fam=='circle-sticker' else 'rectangle'
        if geo=='cutlery':features['cutleryType']=fam
        features['canFoldFlat']=geo in ['folding-box','paper-bag','food-tray','cup-carrier','cake-slice-box'] and fam!='bagasse-tray-lid'
        components=[]
        if geo=='bundle':
            for item in BUNDLE_COMPONENTS.get(p['id'],[]):components.append(component(item[1],item[0],item[2],known,item[3] if len(item)>3 else 'name-and-size-match'))
            if not components:notes.append('EcoPak does not publish this bundle’s component list in the saved description. Any grouped preview must be labeled representative.')
        if geo=='sample-pack':
            components,variant_components=samples(p,known)
            for variant_id,items in variant_components.items():variants[variant_id]['components']=items
            default_variant=str(p['options'][p['defaultOptionIndex']]['variantId'])
            components=variant_components.get(default_variant,[])
            notes.append('Listed sample variants reference individual products; unresolved or discontinued component SKUs remain flagged.')
        candidate=None
        if fam in CANDIDATES:
            local,key=CANDIDATES[fam];candidate=dict(localTemplateId=local,pacdoraReferenceKey=key,matchStatus='candidate',note='Candidate family only; exact EcoPak flap/cut topology has not been verified.')
        if p['id']=='bamboo-fruit-fork-100-pcs-per-bundle':notes.append('Imported category is bundles, but this is a single cutlery product sold in quantity options; do not show it as a mixed bundle.')
        if fam in ['window-cake-carton'] and 'window' not in (p['name']+' '+p['description']).lower():notes.append('Window geometry comes from the user-supplied cake-box reference; the saved EcoPak text does not explicitly specify its window.')
        if fam=='loaf-carton':notes.append('The linked windowed loaf structure is only a candidate; the EcoPak text does not explicitly confirm a window.')
        if fam=='fold-top-takeout':notes.append('Fold-top leak-resistant construction needs visual confirmation; the takeout tray candidate is not a verified closure match.')
        if p['id']=='bakery-essentials-bundle-50-pcs-10-off':notes.append('Description heading says 50 pcs each, but its individual list specifies Kraft Trays x 100. Component quantities preserve the individual list.')
        if estimated:notes.append('Only dimensionsMm and measurements are supplier-published. previewDimensionsMm contains estimated display parameters; it is not a manufacturing specification.')
        structural_estimates=['wallThickness','lidFit'] if geo in ['bowl','cup','moulded-clamshell','aluminium-tray','paper-baking-cup'] else ['flapProfiles','creaseAllowances','boardThickness'] if geo in ['folding-box','paper-bag','food-tray','cup-carrier','cake-slice-box'] else []
        representative=[dict(productId=pid,quantity=None,matchStatus='representative-only',note='Display example, not a confirmed bundle/sample component.') for pid in REPRESENTATIVE.get(p['id'],[]) if pid in known]
        enriched[p['id']]=dict(productId=p['id'],name=p['name'],category=p['category'],sourceUrl=p['sourceUrl'],family=fam,geometryType=geo,geometryStatus='published-size-preview' if status=='exact-published' else 'proportional-preview',structureStatus='candidate-unverified' if candidate else 'procedural-display-model',dimensionsStatus=status,dimensionsMm=dims,previewDimensionsMm=preview,estimatedParameters=sorted(set(estimated)),estimatedStructuralParameters=structural_estimates,estimateBasis='Generic display proportions, preserving all usable EcoPak-published axes. Estimates are not supplier or Pacdora dimensions.',measurements=unique(entries),capacities=capacities,conflicts=conflicts,features=features,variants=variants,components=components,representativeComponents=representative,templateCandidate=candidate,notes=notes)
    output=dict(schemaVersion=1,sourceSnapshotDate=max(p['importedAt'] for p in products),researchDate=DATE,sourceCatalogueSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
       axisConvention={'box':'L = length, W = width/depth, H = height; unlabelled box triples retain conventional listed L×W×H order.','paper-bag':'L = front width, W = gusset depth, H = body height excluding handles. Unlabeled supplier axis order stays partial.','bowl-cup':'L and W = outer top diameter footprint; H = body height; topDiameter/bottomDiameter drive vessel taper.','cutlery-straw':'length = longitudinal size, also stored as L; W and H describe transverse extents.','sheet-sticker':'L and W = two-dimensional design extent; H = estimated display thickness.'},
       statusDefinitions={'exact-published':'Published nominal size sufficient for the principal geometry axes, or an explicitly selected two-dimensional variant. Small structural details may still be estimated.','partial':'Some published measurements exist, but required axes or shape parameters are incomplete or unlabeled.','conflicting':'Published size declarations disagree; all conflicting measurements are preserved.','unspecified':'No usable published physical dimensions for this product or grouped arrangement.'},
       referencePolicy='References are public official Pacdora links followed from the cited page, not extracted engine files. All product matches remain candidates pending structural verification. No Pacdora match is invented for cutlery, straws, bundles or sample groups.',
       pacdoraReferences=PACDORA,coverage=dict(products=len(enriched),dimensionsStatus=dict(Counter(p['dimensionsStatus'] for p in enriched.values())),geometryTypes=dict(Counter(p['geometryType'] for p in enriched.values())),pacdoraCandidates=sum(bool(p['templateCandidate']) for p in enriched.values()),variants=sum(len(p['variants']) for p in enriched.values())),products=enriched)
    assert set(enriched)==set(known)
    assert all(all(isinstance(p['previewDimensionsMm'][k],(int,float)) and p['previewDimensionsMm'][k]>0 for k in ['L','W','H']) for p in enriched.values())
    for p in enriched.values():
        for c in p['components']:
            assert c['productId'] is None or c['productId'] in known
        if p['templateCandidate']:assert p['templateCandidate']['pacdoraReferenceKey'] in PACDORA
    (ROOT/'catalogue-mockups.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(output['coverage'],indent=2))

if __name__=='__main__':main()
