import unittest,json,urllib.request,urllib.error,threading
from server import Handler,ThreadingHTTPServer,config,recommend,estimate
class PackagingTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.http=ThreadingHTTPServer(('127.0.0.1',0),Handler);cls.url='http://127.0.0.1:'+str(cls.http.server_port);threading.Thread(target=cls.http.serve_forever,daemon=True).start()
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close()
 def post(self,path,body,kind='application/json'):
  request=urllib.request.Request(self.url+'/api/v1/'+path,data=json.dumps(body).encode(),headers={'Content-Type':kind})
  try:
   with urllib.request.urlopen(request) as r:return r.status,r.read()
  except urllib.error.HTTPError as e:return e.code,e.read()
 def test_conversion(self):
  d=config({'unit':'in','dimensions':{'L':10,'W':5,'H':2}})['dimensions_mm'];self.assertEqual(d,{'L':254.,'W':127.,'H':50.8})
 def test_clearance_is_total_not_per_side(self):
  r=recommend({'product':{'L':210,'W':140,'H':50},'clearance_mm':4});self.assertEqual(r['target_internal_mm'],{'L':214,'W':144,'H':54})
 def test_large_product_not_clamped(self):self.assertFalse(recommend({'product':{'L':900,'W':140,'H':50}})['within_editor_range'])
 def test_validation_errors(self):
  for dims in [{'L':99,'W':150,'H':60},{'L':True,'W':150,'H':60},{'L':float('nan'),'W':150,'H':60},{}]:
   self.assertEqual(self.post('configurations/validate',{'dimensions':dims})[0],422)
 def test_estimate_endpoint(self):
  status,raw=self.post('estimates',{'dimensions':{'L':220,'W':150,'H':60}});r=json.loads(raw);self.assertEqual(status,200);self.assertTrue(r['illustrative']);self.assertAlmostEqual(r['total'],1975.98,places=2)
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
 def test_private_source_not_served(self):
  with self.assertRaises(urllib.error.HTTPError) as ctx:urllib.request.urlopen(self.url+'/server.py')
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

if __name__=='__main__':unittest.main()
