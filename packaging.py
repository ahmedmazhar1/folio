"""Original Folio visual box structures and deterministic product recommendations."""
import math,re

def _outline(panel):
    """Ordered perimeter in the panel's hinge-local XY plane."""
    w,h=panel['width'],panel['height']
    cx,cy,_=panel['center']
    shape=panel['shape']
    # Unit outlines use (across, distance from hinge). Shape only free edges.
    if shape=='dust':
        points=[(-.5,0),(.5,0),(.38,.18),(.25,1),(-.38,.92)]
    elif shape=='lock':
        points=[(-.5,0),(.5,0),(.5,.68),(.23,.68),(.17,1),(-.23,1),(-.25,.78)]
    elif shape=='tuck':
        points=[(-.5,0),(.5,0),(.5,.66),(.485,.84),(.455,.96),(.42,1),(-.42,1),(-.455,.96),(-.485,.84),(-.5,.66)]
    elif shape=='tab':
        points=[(-.5,0),(.5,0),(.43,.82),(.32,1),(-.32,1),(-.43,.82)]
    else:
        return [[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]]
    if panel['axis']=='x':
        return [[cx+a*w,math.copysign(h,cy)*b] for a,b in points]
    return [[math.copysign(w,cx)*b,cy+a*h] for a,b in points]


def _linework(panels):
    """Split perimeters at shared hinges, including hinges shorter than an edge."""
    creases={p['id']:[] for p in panels}
    for p in panels:
        if p['parent'] is None:
            continue
        cx,cy,_=p['center']
        if p['axis']=='x':
            a,b=[cx-p['width']/2,0],[cx+p['width']/2,0]
        else:
            a,b=[0,cy-p['height']/2],[0,cy+p['height']/2]
        p['crease']=[a,b]
        creases[p['id']].append([a,b])
        dx,dy,_=p['hinge']
        creases[p['parent']].append([[x+dx,y+dy] for x,y in (a,b)])
    for p in panels:
        polygon=p['outline']=_outline(p)
        cuts=p['cuts']=[]
        for a,b in zip(polygon,polygon[1:]+polygon[:1]):
            dx,dy=b[0]-a[0],b[1]-a[1]
            length=dx*dx+dy*dy
            spans=[]
            for c,e in creases[p['id']]:
                if any(abs(dx*(q[1]-a[1])-dy*(q[0]-a[0]))>1e-6 for q in (c,e)):
                    continue
                vals=sorted(((q[0]-a[0])*dx+(q[1]-a[1])*dy)/length for q in (c,e))
                spans.append((max(0,vals[0]),min(1,vals[1])))
            cursor=0
            def point(t): return [a[0]+t*dx,a[1]+t*dy]
            for start,end in sorted(spans):
                if end<=cursor or start>=1: continue
                if start>cursor: cuts.append([point(cursor),point(start)])
                cursor=max(cursor,end)
            if cursor<1: cuts.append([point(cursor),b])


def manifest(kind,d):
    l,w,h=(d[k] for k in ('L','W','H'))
    panels=[]
    def panel(id,parent,width,height,hinge,center,axis,angle,phase,face=None,shape='rect'):
        panels.append(dict(id=id,parent=parent,width=width,height=height,hinge=[*hinge,0],center=[*center,0],axis=axis,closed_angle=angle,phase=phase,face=face,shape=shape))
    turn=math.pi/2
    family=kind.removeprefix('board-').removeprefix('corr-')
    tube=family in ('tuck-carton','tuck-end','auto-bottom','flap-box','paper-bag')
    if tube:
        # The four walls wrap around a tube. Each wall hinge is at its left edge.
        panel('front',None,l,h,(0,0),(0,0),'y',0,[0,1],'front')
        panel('right','front',w,h,(l/2,0),(w/2,0),'y',-turn,[.56,1],'right')
        panel('back','right',l,h,(w,0),(l/2,0),'y',-turn,[.56,1],'back')
        panel('left','back',w,h,(l,0),(w/2,0),'y',-turn,[.56,1],'left')
        glue=min(18,w*.2)
        panel('glue','front',glue,h,(-l/2,0),(-glue/2,0),'y',turn,[.54,.94],shape='tab')
        widths={'front':(l,0),'right':(w,w/2),'back':(l,l/2),'left':(w,w/2)}
        if family=='flap-box':
            for name,(width,x) in widths.items():
                for sign,end in [(1,'top'),(-1,'bottom')]:
                    depth=w/2
                    panel(end+'-'+name,name,width,depth,(x,sign*h/2),(0,sign*depth/2),'x',sign*turn,[.1,.48] if name in ('left','right') else [0,.30],
                          'lid' if end=='top' and name=='front' else 'inside' if end=='bottom' and name=='front' else None)
        else:
            if family!='paper-bag':
                panel('lid','front',l,w,(0,h/2),(0,w/2),'x',turn,[.05,.32],'lid')
                tuck=min(w*.28,h*.2)
                panel('tuck','lid',l*.96,tuck,(0,w),(0,tuck/2),'x',turn,[0,.16],shape='tuck')
                for side in ['left','right']:
                    panel('dust-'+side,side,w,l*.42,(w/2,h/2),(0,l*.21),'x',turn,[.30,.52],shape='dust')
            if family in ('tuck-end','tuck-carton'):
                panel('base-flap','back',l,w,(l/2,-h/2),(0,-w/2),'x',-turn,[.16,.42],'inside')
                panel('base-tuck','base-flap',l*.96,tuck,(0,-w),(0,-tuck/2),'x',-turn,[.04,.20],shape='tuck')
                for side in ['left','right']:
                    panel('foot-'+side,side,w,l*.42,(w/2,-h/2),(0,-l*.21),'x',-turn,[.38,.55],shape='dust')
            else:
                for name,(width,x) in widths.items():
                    depth=(w*.56 if name in ('front','back') else l*.43)
                    panel('bottom-'+name,name,width,depth,(x,-h/2),(0,-depth/2),'x',-turn,[.17,.42] if name in ('front','back') else [.38,.55],
                          'inside' if name=='front' else None,'tab' if family=='paper-bag' else 'lock')
                if family=='paper-bag':
                    for side in ('left','right'):
                        item=next(p for p in panels if p['id']==side)
                        item['scores']=[[[w/2,-h/2],[w/2,h/2]],[[0,-h/2],[w/2,-h/2+min(h/3,w/2)]],[[w,-h/2],[w/2,-h/2+min(h/3,w/2)]]]
    else:
        panel('base',None,l,w,(0,0),(0,0),'x',0,[0,1],'inside')
        panel('front','base',l,h,(0,-w/2),(0,-h/2),'x',-turn,[.55,.9],'front')
        panel('back','base',l,h,(0,w/2),(0,h/2),'x',turn,[.65,1],'back')
        panel('left','base',h,w,(-l/2,0),(-h/2,0),'y',turn,[.45,.85],'left')
        panel('right','base',h,w,(l/2,0),(h/2,0),'y',-turn,[.45,.85],'right')
        if family not in ('simple-tray','frame-tray'):
            panel('lid','back',l,w,(0,h),(0,w/2),'x',turn,[.05,.45],'lid')
            tab=min(h*.65,w*.22)
            panel('tuck','lid',l*.94,tab,(0,w),(0,tab/2),'x',turn,[0,.18],shape='tuck')
            for side,sign in [('left',-1),('right',1)]:
                panel('ear-'+side,'lid',tab,w*.78,(sign*l/2,w*.5),(sign*tab/2,0),'y',-sign*turn,[0,.25],shape='tab')
        if family in ('roll-end','roll-end-wing','frame-tray','simple-tray'):
            for side,sign in [('left',-1),('right',1)]:
                for end,edge in [('front',-1),('back',1)]:
                    depth=min(h*.75,w*.36)
                    panel(side+'-'+end,side,h,depth,(sign*h/2,edge*w/2),(0,edge*depth/2),'x',edge*turn,[.54,.84],shape='tab')
                if family!='simple-tray':
                    rim=min(8,h*.18) if family!='frame-tray' else min(18,l*.09)
                    panel(side+'-rim',side,rim,w,(sign*h,0),(sign*rim/2,0),'y',-sign*turn,[.35,.65])
                    panel(side+'-liner',side+'-rim',h,w,(sign*rim,0),(sign*h/2,0),'y',-sign*turn,[.22,.55])
            if family=='roll-end-wing':
                for side,sign in [('left',-1),('right',1)]:
                    panel('wing-'+side,'tuck',tab*.65,tab,(sign*l*.47,tab/2),(sign*tab*.325,0),'y',-sign*turn,[.01,.18],shape='tab')
            if family=='frame-tray':
                rim=min(18,w*.09)
                for name,sign in [('front',-1),('back',1)]:
                    panel(name+'-rim',name,l,rim,(0,sign*h),(0,sign*rim/2),'x',sign*turn,[.35,.65])
                    panel(name+'-liner',name+'-rim',l,h,(0,sign*rim),(0,sign*h/2),'x',sign*turn,[.22,.55])
    _linework(panels)
    return dict(schema_version='1.1',template_id=kind,units='mm',dimensions=d,panels=panels,upright=tube,thickness_mm=.5 if kind.startswith('board-') or kind=='tuck-carton' else 1.4,production_ready=False,notice='Visual assembly study. A packaging engineer must verify locking details and manufacturing allowances.')

def pose(model,progress):
    def smooth(t):return t*t*(3-2*t)
    poses=[]
    for p in model['panels']:
        a,b=p['phase'];t=max(0,min(1,(progress-a)/(b-a)))
        poses.append(dict(id=p['id'],axis=p['axis'],angle=p['closed_angle']*(1-smooth(t))))
    return dict(progress=progress,panels=poses)

def recommend_product(text,dimensions=None):
    words=set(re.findall(r'[a-z]+',text.lower()))
    fragile=bool(words & {'glass','ceramic','fragile','bottle','bottles','mug','candle','candles'})
    cosmetic=bool(words & {'cosmetic','cosmetics','serum','cream','perfume','soap','skincare'})
    apparel=bool(words & {'shirt','shirts','clothing','apparel','hoodie','scarf','socks','jewelry'})
    food=bool(words & {'food','cake','cookies','chocolate','tea','coffee','bakery'})
    kind='tuck-carton' if cosmetic else 'deep-gift' if fragile else 'slim-flat' if apparel else 'mailer'
    reason=('A folding carton suits a small retail product. Use an outer shipping box for delivery.' if cosmetic else 'A deeper box leaves room for a protective insert. Fragile products need cushioning and transit testing.' if fragile else 'A shallow mailer suits lightweight, folded products without excess empty space.' if apparel else 'A hinged mailer is a useful starting point for packing and opening a small shipped product.')
    questions=['What are the packed product dimensions, including any insert?','What is the packed weight and will this be shipped or sold in store?']
    cautions=['This is a starting recommendation, not a fit or protection guarantee.']
    if food:cautions.append('Confirm food-contact suitability and any liner or barrier with the packaging supplier.')
    if fragile:cautions.append('Specify a protective insert before choosing final internal dimensions.')
    target=None
    if dimensions:target={k:round(v+4,2) for k,v in dimensions.items()};questions=questions[1:]
    return dict(template_id=kind,reason=reason,target_internal_mm=target,questions=questions,cautions=cautions,engine='local-rules-v1',ai_generated=False,description=text)
