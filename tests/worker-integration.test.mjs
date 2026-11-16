import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const source=readFileSync(new URL('../dist/server/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_enquiries.sql',import.meta.url),'utf8'));
const DB={prepare(query){return{bind(...values){return{async first(){return sql.prepare(query).get(...values)||null;},async run(){const result=sql.prepare(query).run(...values);return{success:true,meta:{changes:Number(result.changes)}};}};}};}};
const env={DB,ENQUIRY_EMAIL_PROVIDER:''};
const request=(path,body,extra={})=>worker.fetch(new Request('https://pannipack.example'+path,body===undefined?extra:{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://pannipack.example','CF-Connecting-IP':'192.0.2.25',...extra.headers},body:JSON.stringify(body)}),env,{});
const home=await request('/');assert.equal(home.status,200);const html=await home.text();assert.match(html,/<title>PanniPack/);assert.doesNotMatch(html,/data-view="home"/);
for(const route of [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg)(?:\?[^"#]*)?)"/g)].map(m=>m[1]).filter(p=>!p.startsWith('http'))){const response=await request('/'+route.replace(/^\//,''));assert.equal(response.status,200,'Missing asset '+route);}
assert.equal((await request('/server.py')).status,404);
const catalogue=await (await request('/api/v1/products')).json();assert.equal(catalogue.products.length,105);
const graph=await (await request('/catalogue-models.json')).json();assert.ok(Object.keys(graph.models).length>=25);
const specs=await (await request('/catalogue-mockups.json')).json();
for(const product of catalogue.products){assert.ok(specs.products[product.id],'Missing 3D data: '+product.id);if(['folding-box','burger-clamshell','gable-food-box','fold-top-takeout','tray'].includes(specs.products[product.id].geometryType))assert.ok(graph.products[product.id],'Missing fold graph: '+product.id);}
const p=catalogue.products.find(p=>p.options.some(o=>o.available!==false));const i=p.options.findIndex(o=>o.available!==false),option=p.options[i];
const form={name:'Preview Test',email:'test@example.invalid',city:'Test city',notes:'Local integration verification only.',items:[{productId:p.id,optionIndex:i,quantity:option.minQty,customPrint:false,notes:'Test item note'}],requestId:crypto.randomUUID()};
const first=await request('/api/v1/enquiries',form);assert.equal(first.status,202);const receipt=await first.json();assert.equal(receipt.stored,true);assert.equal(receipt.emailStatus,'not_configured');assert.match(receipt.enquiryId,/^EP-/);
const duplicate=await (await request('/api/v1/enquiries',form)).json();assert.equal(duplicate.enquiryId,receipt.enquiryId);assert.equal(sql.prepare('SELECT count(*) AS count FROM enquiries').get().count,1);
const saved=sql.prepare('SELECT * FROM enquiries WHERE id=?').get(receipt.enquiryId);assert.equal(JSON.parse(saved.contact_json).email,form.email);assert.equal(JSON.parse(saved.items_json)[0].notes,'Test item note');
const bad=await request('/api/v1/enquiries',{...form,email:'not-an-email',requestId:crypto.randomUUID()});assert.equal(bad.status,422);
const wrongOrigin=await request('/api/v1/enquiries',form,{headers:{Origin:'https://unrelated.example'}});assert.equal(wrongOrigin.status,403);
const honeypot=await request('/api/v1/enquiries',{website:'spam.example'});assert.equal(honeypot.status,202);assert.equal((await honeypot.json()).stored,false);
const metadata=await (await request('/api/v1/enquiries/config')).json();assert.equal(metadata.emailActivated,false);assert.equal('recipient' in metadata,false);
for(const size of [{L:88.9,W:88.9,H:76.2},{L:254,W:254,H:254},{L:304.8,W:304.8,H:101.6}])assert.equal((await request('/api/v1/models',{template_id:'board-window-cake',dimensions:size})).status,200);
console.log('PASS: PanniPack HTML/assets, 105 products, folding graphs, validated durable enquiries, idempotency, privacy, same-origin protection and real catalogue sizes. No email was sent.');
