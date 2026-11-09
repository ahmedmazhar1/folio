import unittest,json,urllib.request,urllib.error,threading
from unittest.mock import patch
from server import Handler,ThreadingHTTPServer,config,recommend,estimate,same_origin,server_address
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
 def test_large_product_not_clamped(self):self.assertFalse(recommend({'product':{'L':900,'W':140,'H':50}})['within_editor_range'])
 def test_validation_errors(self):
  for dims in [{'L':99,'W':150,'H':60},{'L':True,'W':150,'H':60},{'L':float('nan'),'W':150,'H':60},{}]:
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

if __name__=='__main__':unittest.main()
