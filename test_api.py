import unittest,json,math,urllib.request,urllib.error,threading,tempfile
from pathlib import Path
from unittest.mock import patch
from server import Handler,ThreadingHTTPServer,config,recommend,estimate,same_origin,server_address,public_image
class ServerTestCase(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.http=ThreadingHTTPServer(('127.0.0.1',0),Handler);cls.url='http://127.0.0.1:'+str(cls.http.server_port);threading.Thread(target=cls.http.serve_forever,daemon=True).start()
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close()
 def post(self,path,body,kind='application/json',headers=None):
  request=urllib.request.Request(self.url+'/api/v1/'+path,data=json.dumps(body).encode(),headers={'Content-Type':kind,**(headers or {})})
  try:
   with urllib.request.urlopen(request) as r:return r.status,r.read()
  except urllib.error.HTTPError as e:return e.code,e.read()

class PackagingTests(ServerTestCase):
 def test_conversion(self):
  d=config({'unit':'in','dimensions':{'L':10,'W':5,'H':2}})['dimensions_mm'];self.assertEqual(d,{'L':254.,'W':127.,'H':50.8})
 def test_clearance_is_total_not_per_side(self):
  r=recommend({'product':{'L':210,'W':140,'H':50},'clearance_mm':4});self.assertEqual(r['target_internal_mm'],{'L':214,'W':144,'H':54})
 def test_large_product_not_clamped(self):self.assertFalse(recommend({'product':{'L':1200,'W':140,'H':50}})['within_editor_range'])
 def test_validation_errors(self):
  for dims in [{'L':19,'W':150,'H':60},{'L':True,'W':150,'H':60},{'L':float('nan'),'W':150,'H':60},{}]:
   self.assertEqual(self.post('configurations/validate',{'dimensions':dims})[0],422)
 def test_estimate_endpoint(self):
  status,raw=self.post('estimates',{'dimensions':{'L':220,'W':150,'H':60}});r=json.loads(raw)
  self.assertEqual(status,200);self.assertEqual(r['currency'],'PKR');self.assertTrue(r['quote_required'])
  self.assertIsNone(r['unit_price']);self.assertIsNone(r['total']);self.assertNotIn('formula_version',r)
 def test_svg_review_label(self):
  status,raw=self.post('dielines',{'dimensions':{'L':220,'W':150,'H':60}});self.assertEqual(status,200);self.assertIn(b'Not production ready',raw);self.assertIn(b'<svg',raw)
 def test_model_and_pose_api(self):
  request={'template_id':'mailer','dimensions':{'L':220,'W':150,'H':60}}
  status,raw=self.post('models',request);self.assertEqual(status,200);self.assertGreater(len(json.loads(raw)['panels']),6)
  status,raw=self.post('models/pose',dict(request,progress=1));self.assertEqual(status,200);self.assertTrue(all(p['angle']==0 for p in json.loads(raw)['panels']))
  self.assertEqual(self.post('models/pose',dict(request,progress=2))[0],422)
 def test_recommendation_api(self):
  status,raw=self.post('recommendations',{'description':'A fragile glass candle for shipping'});self.assertEqual(status,200);self.assertEqual(json.loads(raw)['template_id'],'deep-gift')
  self.assertEqual(self.post('recommendations',{'description':'hi'})[0],422)
 def test_wrong_content_type(self):self.assertEqual(self.post('estimates',{},'text/plain')[0],415)
 def test_same_origin_browser_requests(self):
  body={'dimensions':{'L':220,'W':150,'H':60}}
  self.assertEqual(self.post('estimates',body,headers={'Origin':self.url})[0],200)
  self.assertEqual(self.post('estimates',body,headers={'Origin':'https://folio.example','Host':'folio.example'})[0],200)
  for origin in ['https://unrelated.example','null',self.url+'.evil.example']:
   with self.subTest(origin=origin):self.assertEqual(self.post('estimates',body,headers={'Origin':origin})[0],403)
 def test_origin_matching_and_configured_address(self):
  self.assertTrue(same_origin('https://folio.example','folio.example'))
  self.assertTrue(same_origin('http://localhost:8080','localhost:8080'))
  for origin in ['https://folio.example:444','https://user@folio.example','https://folio.example/path','https://folio.example?x=1','https://folio.example#x','ftp://folio.example','https://folio.example:bad']:
   with self.subTest(origin=origin):self.assertFalse(same_origin(origin,'folio.example'))
  with patch.dict('os.environ',{},clear=True):self.assertEqual(server_address(),('127.0.0.1',4173))
  with patch.dict('os.environ',{'HOST':'0.0.0.0','PORT':'8080'},clear=True):self.assertEqual(server_address(),('0.0.0.0',8080))
  for port in ['nope','0','65536']:
   with patch.dict('os.environ',{'PORT':port},clear=True),self.assertRaises(ValueError):server_address()
 def test_private_source_not_served(self):
  with self.assertRaises(urllib.error.HTTPError) as ctx:urllib.request.urlopen(self.url+'/server.py')
  self.assertEqual(ctx.exception.code,404)

class CatalogueTests(ServerTestCase):
 catalogue=[
  {'id':'stickers','name':'Logo stickers','options':[{'label':'Pack of 50','unitPrice':7,'unitsPerPack':50,'minQty':1,'step':1,'basis':'Guide benchmark','source':{'url':'https://example.com/stickers','name':'Reference','date':'2026-11-09'}}]},
  {'id':'cake','name':'Cake box','options':[{'label':'8 × 8 × 5 in','unitPrice':60,'unitsPerPack':1,'minQty':3,'step':1,'basis':'Guide benchmark'}]},
  {'id':'custom','name':'Custom mailer','options':[{'label':'Custom dimensions','unitPrice':None,'unitsPerPack':1,'minQty':1,'step':1,'basis':'Quote required'}]},
  {'id':'source-pack','name':'EcoPak pack','options':[{'label':'Pack of 50','unitPrice':350,'unitsPerPack':1,'minQty':1,'step':1,'basis':'EcoPak listed pack price','available':True,'variantId':12345,'priceUnit':'pack of 50','quantityLabel':'Packs','compareAtPrice':400}]},
  {'id':'unavailable','name':'Unavailable bowl','options':[{'label':'500 ml','unitPrice':25,'unitsPerPack':1,'minQty':1,'step':1,'available':False}]},
  {'id':'increments','name':'Bulk run','options':[{'label':'Batch','unitPrice':1.25,'unitsPerPack':1,'minQty':100,'step':50,'basis':'Test fixture'}]}
 ]
 def setUp(self):
  self.catalogue_patch=patch('server.load_catalogue',return_value=self.catalogue)
  self.catalogue_patch.start();self.addCleanup(self.catalogue_patch.stop)
 def test_product_catalogue_endpoint(self):
  with urllib.request.urlopen(self.url+'/api/v1/products') as response:
   body=json.load(response);self.assertEqual(response.status,200)
  self.assertEqual(body['currency'],'PKR');self.assertEqual(body['products'],self.catalogue)
 def test_pack_totals_are_server_calculated(self):
  status,raw=self.post('catalogue/estimate',{'items':[{'productId':'stickers','optionIndex':0,'quantity':2,'unitPrice':0.01,'guideTotal':0},{'productId':'cake','quantity':3}]})
  body=json.loads(raw);self.assertEqual(status,200)
  self.assertEqual(body['subtotal'],880);self.assertFalse(body['quoteRequired'])
  self.assertEqual(body['lines'][0]['totalUnits'],100);self.assertEqual(body['lines'][0]['guideTotal'],700)
  self.assertEqual(body['lines'][0]['unitPrice'],7);self.assertTrue(body['guideOnly'])
 def test_imported_variant_price_is_per_sellable_pack(self):
  status,raw=self.post('catalogue/estimate',{'items':[{'productId':'source-pack','quantity':2,'unitPrice':0.01,'available':False,'variantId':999}]})
  body=json.loads(raw);self.assertEqual(status,200);self.assertEqual(body['subtotal'],700)
  line=body['lines'][0];self.assertEqual(line['totalUnits'],2)
  self.assertEqual(line['variantId'],12345);self.assertEqual(line['priceUnit'],'pack of 50')
  self.assertEqual(line['quantityLabel'],'Packs');self.assertEqual(line['compareAtPrice'],400)
  self.assertTrue(line['available']);self.assertTrue(body['snapshotOnly'])
 def test_unavailable_variant_cannot_be_added_even_with_custom_print(self):
  for custom in [False,True]:
   status,raw=self.post('catalogue/estimate',{'items':[{'productId':'unavailable','quantity':1,'customPrint':custom,'available':True}]})
   self.assertEqual(status,422);self.assertIn('unavailable',json.loads(raw)['message'])
 def test_custom_work_has_no_fabricated_total(self):
  status,raw=self.post('catalogue/estimate',{'items':[{'productId':'cake','quantity':3},{'productId':'stickers','quantity':1,'customPrint':True},{'productId':'custom','quantity':250}]})
  body=json.loads(raw);self.assertEqual(status,200);self.assertEqual(body['subtotal'],180)
  self.assertTrue(body['hasUnpriced']);self.assertTrue(body['quoteRequired'])
  for line in body['lines'][1:]:self.assertIsNone(line['guideTotal']);self.assertTrue(line['quoteRequired'])
 def test_catalogue_rejects_bad_identifiers(self):
  for item in [{'productId':'missing','quantity':1},{'productId':['cake'],'quantity':3},{'productId':'cake','quantity':3,'optionIndex':True},{'productId':'cake','quantity':3,'optionIndex':-1},{'productId':'cake','quantity':3,'optionIndex':9},{'productId':'cake','quantity':3,'optionIndex':0.5}]:
   with self.subTest(item=item):self.assertEqual(self.post('catalogue/estimate',{'items':[item]})[0],422)
 def test_catalogue_rejects_bad_quantities(self):
  for quantity in [None,True,3.0,'3',0,2,-3,100001,float('nan'),float('inf')]:
   with self.subTest(quantity=quantity):self.assertEqual(self.post('catalogue/estimate',{'items':[{'productId':'cake','quantity':quantity}]})[0],422)
  self.assertEqual(self.post('catalogue/estimate',{'items':[{'productId':'increments','quantity':125}]})[0],422)
  self.assertEqual(self.post('catalogue/estimate',{'items':[{'productId':'increments','quantity':150}]})[0],200)
 def test_catalogue_rejects_bad_basket_and_custom_print(self):
  for items in [None,{},[],[None],[{'productId':'cake','quantity':3,'customPrint':'false'}],[{'productId':'cake','quantity':3}]*101]:
   with self.subTest(items=items):self.assertEqual(self.post('catalogue/estimate',{'items':items})[0],422)

class ImportedImageTests(ServerTestCase):
 def setUp(self):
  self.directory=tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup)
  self.root=Path(self.directory.name);self.root_patch=patch('server.ROOT',self.root)
  self.root_patch.start();self.addCleanup(self.root_patch.stop)
  (self.root/'assets/ecopak').mkdir(parents=True)
  (self.root/'assets/ecopak-brand').mkdir(parents=True)
  (self.root/'assets/ecopak/product.webp').write_bytes(b'RIFFtestWEBP')
  (self.root/'assets/ecopak-brand/logo.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
  (self.root/'server.py').write_text('private source')
  (self.root/'assets/ecopak/private.py').write_text('private source')
 def test_imported_photo_and_logo_are_served_with_image_mime(self):
  for path,mime in [('/assets/ecopak/product.webp','image/webp'),('/assets/ecopak-brand/logo.svg','image/svg+xml')]:
   with self.subTest(path=path),urllib.request.urlopen(self.url+path) as response:
    self.assertEqual(response.status,200);self.assertEqual(response.headers['Content-Type'],mime)
    self.assertEqual(response.headers['X-Content-Type-Options'],'nosniff');self.assertTrue(response.read())
 def test_unapproved_files_and_decoded_traversal_are_not_served(self):
  for path in ['/assets/ecopak/private.py','/assets/ecopak/missing.jpg','/assets/ecopak/../../server.py','/assets/ecopak/%2e%2e/%2e%2e/server.py','/assets/other/product.webp','/assets/ecopak/%00.jpg']:
   with self.subTest(path=path),self.assertRaises(urllib.error.HTTPError) as ctx:urllib.request.urlopen(self.url+path)
   self.assertEqual(ctx.exception.code,404)
 def test_symlink_cannot_escape_the_import_directory(self):
  (self.root/'private.webp').write_bytes(b'private')
  (self.root/'assets/ecopak/escape.webp').symlink_to(self.root/'private.webp')
  self.assertIsNone(public_image('/assets/ecopak/escape.webp'))
  with self.assertRaises(urllib.error.HTTPError) as ctx:urllib.request.urlopen(self.url+'/assets/ecopak/escape.webp')
  self.assertEqual(ctx.exception.code,404)

class FoldingTests(unittest.TestCase):
 def test_fold_endpoints_and_parent_order(self):
  from packaging import manifest,pose
  for kind in ['mailer','deep-gift','slim-flat','tuck-carton']:
   model=manifest(kind,{'L':220,'W':150,'H':60});seen=set()
   for p in model['panels']:
    self.assertTrue(p['parent'] is None or p['parent'] in seen);seen.add(p['id']);self.assertGreater(p['width'],0);self.assertGreater(p['height'],0)
   self.assertTrue(all(p['angle']==0 for p in pose(model,1)['panels']))
   self.assertEqual([p['angle'] for p in pose(model,0)['panels']],[p['closed_angle'] for p in model['panels']])
 def test_fold_staging(self):
  from packaging import manifest,pose
  model=manifest('mailer',{'L':220,'W':150,'H':60});r={p['id']:p['angle'] for p in pose(model,.4)['panels']}
  self.assertEqual(r['tuck'],0);self.assertNotEqual(r['front'],0);self.assertLess(abs(r['lid']),.2)
 def test_recommendations_are_honest(self):
  from packaging import recommend_product
  r=recommend_product('I am shipping a fragile glass candle');self.assertEqual(r['template_id'],'deep-gift');self.assertFalse(r['ai_generated']);self.assertIsNone(r['target_internal_mm'])
  self.assertEqual(recommend_product('A skincare serum for retail')['template_id'],'tuck-carton')


class ReferenceDielineTests(unittest.TestCase):
 def test_square_cake_dimensions_and_all_flaps(self):
  from packaging import manifest
  m=manifest('board-window-cake',{'L':215.9,'W':215.9,'H':101.6});ids={p['id'] for p in m['panels']}
  self.assertEqual(len(ids),15)
  self.assertTrue({'base','front','back','left','right','left-liner','right-liner','left-front-lock','right-front-lock','left-back-lock','right-back-lock','lid','lid-wing-left','lid-wing-right','tuck'}<=ids)
  self.assertAlmostEqual(m['thickness_mm'],.50038)
  self.assertTrue(m['detail_dimensions_estimated']);self.assertFalse(m['production_ready'])
 def test_window_and_slot_lines_are_actual_cuts(self):
  from packaging import manifest
  m=manifest('board-window-cake',{'L':215.9,'W':215.9,'H':101.6});lid=next(p for p in m['panels'] if p['id']=='lid');tuck=next(p for p in m['panels'] if p['id']=='tuck')
  self.assertTrue(lid['window_film']);self.assertEqual(len(lid['holes']),1)
  hole=lid['holes'][0]
  for a,b in zip(hole,hole[1:]+hole[:1]):self.assertIn([a,b],lid['cuts'])
  for slit in tuck['slits']:self.assertIn(slit,tuck['cuts'])
 def test_cake_front_artwork_follows_the_visible_closure_flap(self):
  from packaging import manifest
  m=manifest('board-window-cake',{'L':215.9,'W':215.9,'H':101.6})
  front=[p for p in m['panels'] if p.get('face')=='front']
  self.assertEqual([p['id'] for p in front],['tuck'])
  self.assertEqual(front[0]['uv_rotation'],180)
 def test_reference_side_walls_rise_before_front_and_back(self):
  from packaging import manifest,pose
  for kind in ['board-window-cake','board-self-locking-tuck']:
   m=manifest(kind,{'L':215.9,'W':215.9,'H':101.6})
   early={p['id']:p['angle'] for p in pose(m,.75)['panels']}
   self.assertGreater(abs(early['left']),1.4);self.assertGreater(abs(early['right']),1.4)
   self.assertEqual(early['front'],0);self.assertEqual(early['back'],0)
   self.assertGreater(abs(early['left-front-lock']),1)
 def test_cake_liners_return_after_corners_and_before_lid(self):
  from packaging import manifest,pose
  m=manifest('board-window-cake',{'L':215.9,'W':215.9,'H':101.6})
  middle={p['id']:p['angle'] for p in pose(m,.47)['panels']}
  self.assertEqual(middle['left-liner'],0);self.assertEqual(middle['lid'],0)
  later={p['id']:p['angle'] for p in pose(m,.29)['panels']}
  self.assertAlmostEqual(abs(later['left-liner']),math.pi);self.assertEqual(later['lid'],0)
 def test_brownie_has_its_own_locking_structure(self):
  from packaging import manifest
  m=manifest('board-self-locking-tuck',{'L':254,'W':152.4,'H':76.2});byid={p['id']:p for p in m['panels']}
  self.assertEqual(len(byid),13);self.assertNotIn('left-liner',byid)
  self.assertTrue(byid['left']['holes']);self.assertTrue(byid['right']['holes']);self.assertNotIn('holes',byid['lid'])
  self.assertAlmostEqual(m['thickness_mm'],.3302)
  self.assertLess(byid['tuck']['height'],76.2/2)
 def test_reference_folds_are_connected_and_reversible(self):
  from packaging import manifest,pose
  for kind,d in [('board-window-cake',{'L':215.9,'W':215.9,'H':101.6}),('board-self-locking-tuck',{'L':254,'W':152.4,'H':76.2})]:
   m=manifest(kind,d);seen=set()
   for panel in m['panels']:
    if panel['parent'] is not None:self.assertIn(panel['parent'],seen)
    seen.add(panel['id']);self.assertGreater(len(panel['outline']),3)
   self.assertTrue(all(p['angle']==0 for p in pose(m,1)['panels']))
   self.assertEqual([p['angle'] for p in pose(m,0)['panels']],[p['closed_angle'] for p in m['panels']])
 def test_reference_svg_contains_window_cutout_and_all_panels(self):
  from server import config,dieline
  import xml.etree.ElementTree as ET
  c=config({'template_id':'board-window-cake','unit':'in','dimensions':{'L':8.5,'W':8.5,'H':4}})
  self.assertEqual(c['dimensions_mm'],{'L':215.9,'W':215.9,'H':101.6})
  svg=ET.fromstring(dieline(c));paths=list(svg.findall('{http://www.w3.org/2000/svg}path'))
  self.assertEqual(paths[0].get('stroke'),'#2523bc');self.assertEqual(paths[1].get('stroke'),'#ef4144')
  self.assertGreater(paths[0].get('d').count('M'),120)

if __name__=='__main__':unittest.main()
