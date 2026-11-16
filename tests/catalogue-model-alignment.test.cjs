/* Run with node tests/catalogue-model-alignment.test.cjs.
   CPU geometry/data checks; browser rendering is verified separately. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const source=read('shop-catalogue.json'),enrichment=read('catalogue-mockups.json');
const graphPath=path.join(root,'catalogue-models.json');
const graphData=fs.existsSync(graphPath)?read('catalogue-models.json'):null;
const ctx=vm.createContext({console});
for(const file of ['vendor/three.min.js','folding-engine.js','product-geometry.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const T=ctx.THREE,byId=new Map(source.map(p=>[p.id,p]));
assert.equal(source.length,105,'Unexpected supplier catalogue size; update expected coverage deliberately.');
assert.deepEqual(Object.keys(enrichment.products).sort(),source.map(p=>p.id).sort(),'Every supplier product needs one enrichment record.');
const summary={products:0,variants:0,foldGraphVariants:0,proceduralVariants:0,compositionVariants:0,componentPreviews:0,poses:0,graphData:graphData?'present':'not-yet-built'};

function finiteGeometry(artifact,label){
  artifact.group.updateMatrixWorld(true);let meshes=0,vertices=0;
  artifact.group.traverse(object=>{
    assert.ok(object.matrixWorld.elements.every(Number.isFinite),label+' has a non-finite transform.');
    const position=object.geometry?.attributes?.position;if(!position)return;
    meshes++;vertices+=position.count;
    assert.ok(Array.from(position.array).every(Number.isFinite),label+' has a non-finite vertex.');
    for(const name of ['uv','normal'])if(object.geometry.attributes[name])assert.ok(Array.from(object.geometry.attributes[name].array).every(Number.isFinite),label+' has non-finite '+name+'.');
  });
  assert.ok(meshes>0&&vertices>0,label+' must contain actual geometry.');
  const bounds=new T.Box3().setFromObject(artifact.group);
  assert.ok(!bounds.isEmpty(),label+' must have nonempty bounds.');
  assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),label+' bounds must be finite.');
  const size=bounds.getSize(new T.Vector3());assert.ok(size.x>0&&size.y>0&&size.z>0,label+' must have three-dimensional extent.');
}
function selectedSpec(p,option){
  const base=enrichment.products[p.id],v=base.variants[String(option.variantId)];assert.ok(v,p.id+' missing variant '+option.variantId);
  const spec={...base,dimensionsMm:{...base.dimensionsMm,...v.dimensionsMm},previewDimensionsMm:{...base.previewDimensionsMm,...v.previewDimensionsMm},components:v.components||base.components};
  for(const key of ['L','W','H'])assert.ok(Number.isFinite(spec.previewDimensionsMm[key])&&spec.previewDimensionsMm[key]>0,p.id+' has invalid display '+key);
  for(const [key,value] of Object.entries(spec.dimensionsMm))assert.equal(spec.previewDimensionsMm[key],value,p.id+' changed a published dimension: '+key);
  return spec;
}
function make(spec,p,option){
  const entry=graphData?.products?.[p.id],key=entry?.variants?.[String(option.variantId)]||entry?.defaultModel;
  if(key){
    const model=graphData.models[key];assert.ok(model?.panels?.length,p.id+' references a missing fold graph: '+key);
    for(const axis of ['L','W','H'])assert.ok(Math.abs(model.dimensions[axis]-spec.previewDimensionsMm[axis])<.001,p.id+' graph uses the wrong '+axis);
    const artifact=ctx.FolioFolding.mount(T,model);return {...artifact,setOpen:artifact.setProgress,kind:'fold'};
  }
  const artifact=ctx.EcoPakGeometry.create(T,spec,{color:'#b58c60'});assert.ok(!artifact.group.userData.unsupportedGeometryType,p.id+' uses unsupported geometry: '+spec.geometryType);return {...artifact,kind:'procedural'};
}
function testArtifact(spec,p,option,label){
  const artifact=make(spec,p,option);const poses=artifact.setOpen?[0,.25,.5,.75,1]:[0];
  for(const amount of poses){artifact.setOpen?.(amount);finiteGeometry(artifact,label+' at '+amount);summary.poses++;}
  const kind=artifact.kind;artifact.dispose();return kind;
}

for(const p of source){
  const base=enrichment.products[p.id];summary.products++;
  assert.equal(Object.keys(base.variants).length,p.options.length,p.id+' variant coverage differs.');
  for(const option of p.options){
    const spec=selectedSpec(p,option);summary.variants++;
    if(['bundle','sample-pack'].includes(spec.geometryType)){
      summary.compositionVariants++;
      const supplied=spec.components||[],parts=!supplied.some(item=>item.productId)&&spec.representativeComponents?.length?spec.representativeComponents:supplied;
      assert.ok(parts.length>0,p.id+' / '+option.variantId+' has no source components or labeled representative arrangement.');
      for(const part of parts){
        if(!part.productId)continue;const component=byId.get(part.productId);assert.ok(component,p.id+' references a missing component '+part.productId);
        assert.ok(!['bundle','sample-pack'].includes(enrichment.products[component.id].geometryType),'Nested unbounded product groups are unsupported.');
        const componentOption=component.options[component.defaultOptionIndex||0],componentSpec=selectedSpec(component,componentOption);
        testArtifact(componentSpec,component,componentOption,p.id+' / '+component.id);summary.componentPreviews++;
      }
      // The group itself has no invented manufacturing dimensions. Its listed
      // or separately labeled representative components provide the geometry.
      continue;
    }
    const kind=testArtifact(spec,p,option,p.id+' / '+option.variantId);summary[kind==='fold'?'foldGraphVariants':'proceduralVariants']++;
  }
}
assert.equal(summary.variants,411,'Expected all 411 EcoPak variants.');
assert.equal(enrichment.products['kraft-apparel-bag-17-x-14-x-4-5-inches'].dimensionsStatus,'conflicting','Do not silently resolve the apparel bag height conflict.');
assert.ok(enrichment.products['s'].variants[source.find(p=>p.id==='s').options[0].variantId].dimensionsMm.L===25.4,'Sticker variant dimensions must be retained.');
console.log(JSON.stringify(summary,null,2));
if(!graphData)console.log('NOTE: Folding graph file is not built yet. Rerun this check after catalogue-models.json is generated.');
