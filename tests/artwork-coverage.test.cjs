/* Run with node tests/artwork-coverage.test.cjs.
   Every individual catalogue variant must provide a real printable 3D surface.
   Bundle composition and browser interaction are verified separately. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const catalogue=read('shop-catalogue.json'),enrichment=read('catalogue-mockups.json');
const context=vm.createContext({console});
for(const file of ['vendor/three.min.js','product-geometry.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const texture=new context.THREE.Texture(),summary={products:0,variants:0,printableMeshes:0,compositionVariants:0,geometryTypes:[]},types=new Set();
let textureDisposals=0;texture.dispose=()=>{textureDisposals++;};

for(const product of catalogue){
 const base=enrichment.products[product.id];assert.ok(base,product.id+' needs geometry metadata.');
 if(['bundle','sample-pack'].includes(base.geometryType)){summary.compositionVariants+=product.options.length;continue;}
 summary.products++;types.add(base.geometryType);
 for(const option of product.options){
  const label=product.id+' / '+option.variantId,variant=base.variants[String(option.variantId)];assert.ok(variant,label+' needs variant metadata.');
  const spec={...base,dimensionsMm:{...base.dimensionsMm,...variant.dimensionsMm},previewDimensionsMm:{...base.previewDimensionsMm,...variant.previewDimensionsMm}};
  const artifact=context.EcoPakGeometry.create(context.THREE,spec,{color:'#c8ad86',artworkTexture:texture});
  try{
   assert.ok(!artifact.group.userData.unsupportedGeometryType,label+' must use an implemented product family.');
   assert.ok(artifact.artworkMeshes.length>0,label+' has a view-only model without a printable surface.');
   assert.ok(Number.isFinite(artifact.artworkAspectRatio)&&artifact.artworkAspectRatio>0,label+' needs a usable print-area aspect ratio.');
   for(const mesh of artifact.artworkMeshes){
    assert.ok(mesh.isMesh,label+' print targets must be actual meshes.');
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    assert.ok(materials.some(material=>material?.map===texture),label+' print target is disconnected from the supplied artwork.');
    const position=mesh.geometry?.attributes?.position,uv=mesh.geometry?.attributes?.uv;
    assert.ok(position?.count>0&&uv?.count===position.count,label+' needs vertices and matching print UVs.');
    assert.ok(Array.from(position.array).every(Number.isFinite),label+' has invalid printable geometry.');
    assert.ok(Array.from(uv.array).every(value=>Number.isFinite(value)&&value>=-0.0001&&value<=1.0001),label+' print UVs must cover a normalized texture.');
    assert.ok(Number.isFinite(mesh.userData.artworkAspectRatio)&&mesh.userData.artworkAspectRatio>0,label+' print target needs its own physical aspect ratio.');
    summary.printableMeshes++;
   }
   summary.variants++;
  }finally{artifact.dispose();}
 }
}
assert.equal(textureDisposals,0,'Disposing a model must not dispose the caller-owned artwork texture.');
assert.equal(summary.variants+summary.compositionVariants,411,'Audit every catalogue variant; update the expected catalogue count deliberately.');
assert.equal(summary.variants,355,'All individual-product variants must remain designable.');
summary.geometryTypes=[...types].sort();
console.log(JSON.stringify(summary,null,2));
