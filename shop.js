/* EcoPak catalogue snapshot, product galleries and a locally saved quote list. */
(function () {
  'use strict';
  const products=window.FOLIO_SHOP_PRODUCTS,categories=window.FOLIO_SHOP_CATEGORIES;
  const byId=new Map(products.map(p=>[p.id,p]));
  const importedAt=products[0]?.importedAt||'2026-11-13', importedDate=new Date(importedAt+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  const $s=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>'Rs '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:2});
  const labelOf=id=>categories.find(c=>c.id===id)?.name||'All packaging';
  const sourceUrl=p=>p.sourceUrl||p.sourceURL||p.options[0]?.source?.url||'https://www.ecopakonline.com/collections/all';
  const photoList=p=>(p.images||[]).map(im=>typeof im==='string'?{src:im,alt:p.name}:im).filter(im=>im.src);
  function photo(p,cls='',lazy=true,src){const im=photoList(p)[0];return im?`<img class="${cls}" src="${esc(src||im.src)}" alt="${esc(im.alt||p.name)}" ${lazy?'loading="lazy"':'fetchpriority="high"'} decoding="async">`:FolioShopArt(p.kind)}
  const isAvailable=p=>p.options.some(o=>o.available!==false);
  const firstOption=p=>Number.isInteger(p.defaultOptionIndex)?p.defaultOptionIndex:Math.max(0,p.options.findIndex(o=>o.available!==false));
  const priceUnit=o=>o.priceUnit||(o.unitsPerPack>1?o.unitsPerPack+' pieces':'listed option');
  const quantityLabel=o=>o.quantityLabel||'Units of this option';
  const BAG_KEY='ecopak.quote.v1';
  const filters={category:'all',use:'all',query:'',priced:false,studio:false,sort:'featured',limit:12};
  let activeProduct=null,returnFocus=null;
  function validLine(line){const p=byId.get(line?.productId),o=p?.options[line?.optionIndex];return !!(o&&o.available!==false&&Number.isInteger(line.quantity)&&line.quantity>=o.minQty&&line.quantity<=100000&&(line.quantity-o.minQty)%o.step===0&&typeof line.customPrint==='boolean')}
  let bag=[];try{const saved=JSON.parse(localStorage.getItem(BAG_KEY)||'[]');if(Array.isArray(saved))bag=saved.filter(validLine).slice(0,100)}catch{}
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function announce(message){if(typeof toast==='function')toast(message)}
  function saveBag(){try{localStorage.setItem(BAG_KEY,JSON.stringify(bag))}catch{announce('Your browser could not save this list. Download a brief to keep it.')}updateCount()}
  function updateCount(){$s('shopBagCount').textContent=bag.length;$s('shopBagButton').setAttribute('aria-label',`Open quote list, ${bag.length} product ${bag.length===1?'configuration':'configurations'}`)}
  function showDialog(id){returnFocus=document.activeElement;$s(id).showModal()}
  function closeDialog(id){$s(id).close()}
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));
  ['shopProductDialog','shopBagDialog','shopInfoDialog'].forEach(id=>{
    const dialog=$s(id);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
    dialog.addEventListener('close',()=>{if(id==='shopProductDialog'){activeProduct=null;if(location.hash.startsWith('#shop/'))history.replaceState(null,'','#shop')}if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true})});
  });
  const heroChoices=['brownie','kraft bowl','paper bag'].map(term=>products.find(p=>p.name.toLowerCase().includes(term)&&photoList(p).length)).filter(Boolean);
  const heroProducts=[...new Map([...heroChoices,...products.filter(p=>photoList(p).length)] .map(p=>[p.id,p])).values()].slice(0,3);
  $s('shopHeroArt').insertAdjacentHTML('afterbegin',`<div class="ecopak-photo-collage">${heroProducts.map((p,i)=>`<button class="ecopak-hero-product hero-product-${i}" data-hero-product="${esc(p.id)}" aria-label="Explore ${esc(p.name)}">${photo(p,'',false)}<span>${esc(p.name)} <b>↗</b></span></button>`).join('')}</div>`);
  $s('shopHeroArt').querySelectorAll('[data-hero-product]').forEach(b=>b.onclick=()=>openProduct(b.dataset.heroProduct));
  $s('shopStudioArt').innerHTML=FolioShopArt('mailer')+FolioShopArt('bag');
  $s('shopYear').textContent=new Date().getFullYear();
  categories.forEach(c=>{
    const count=products.filter(p=>p.category===c.id).length,representative=products.find(p=>p.category===c.id&&photoList(p).length);
    const b=document.createElement('button');b.className='shop-collection-card';b.innerHTML=`<span class="collection-art">${representative?photo(representative):FolioShopArt(c.kind)}</span><strong>${esc(c.name)}</strong><small>${count} ${count===1?'product':'products'} ↗</small>`;b.onclick=()=>chooseCategory(c.id,true);$s('shopCollections').append(b);
  });
  function makeCategoryFilters(){const container=$s('shopCategoryFilters');container.innerHTML='';[{id:'all',name:'All packaging'},...categories].forEach(c=>{const b=document.createElement('button');b.className='shop-category-filter';b.setAttribute('aria-pressed',String(c.id===filters.category));b.innerHTML=`${esc(c.name)}<span>${c.id==='all'?products.length:products.filter(p=>p.category===c.id).length}</span>`;b.onclick=()=>chooseCategory(c.id);container.append(b)})}
  function chooseCategory(category,scroll=false){filters.category=category;filters.use='all';filters.limit=12;location.hash='shop?category='+encodeURIComponent(category);syncFilterControls();renderProducts();if(scroll)scrollToCatalogue()}
  function scrollToCatalogue(){requestAnimationFrame(()=>$s('shopCatalogue').scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'}))}
  function syncFilterControls(){makeCategoryFilters();document.querySelectorAll('[data-use]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.use===filters.use)));$s('shopPriced').checked=filters.priced;$s('shopStudioOnly').checked=filters.studio;$s('shopSearch').value=filters.query;$s('shopSort').value=filters.sort}
  function reset(){Object.assign(filters,{category:'all',use:'all',query:'',priced:false,studio:false,sort:'featured',limit:12});history.replaceState(null,'','#shop');syncFilterControls();renderProducts()}
  function lowestPrice(p){const prices=p.options.filter(o=>o.unitPrice!==null&&o.available!==false).map(o=>o.unitPrice*o.unitsPerPack);return prices.length?Math.min(...prices):Infinity}
  function cardPrice(p){let opts=p.options.filter(o=>o.unitPrice!==null&&o.available!==false);if(!opts.length)opts=p.options.filter(o=>o.unitPrice!==null);const o=opts.sort((a,b)=>a.unitPrice*a.unitsPerPack-b.unitPrice*b.unitsPerPack)[0];return o?`${p.options.length>1?'From ':''}${money(o.unitPrice*o.unitsPerPack)} <small>/ ${esc(priceUnit(o))}</small>`:'Price on request'}
  function renderProducts(){
    const q=filters.query.toLowerCase().trim();let list=products.filter(p=>(filters.category==='all'||p.category===filters.category)&&(filters.use==='all'||p.uses.includes(filters.use))&&(!filters.priced||isAvailable(p))&&(!filters.studio||p.studio||p.mockupAvailable)&&(!q||[p.name,p.description,p.size,p.material,labelOf(p.category),...p.options.map(o=>o.label)].join(' ').toLowerCase().includes(q)));
    if(filters.sort==='featured')list.sort((a,b)=>(a.featuredRank??9999)-(b.featuredRank??9999));
    if(filters.sort==='price-low')list.sort((a,b)=>lowestPrice(a)-lowestPrice(b));
    if(filters.sort==='price-high')list.sort((a,b)=>{const x=lowestPrice(a),y=lowestPrice(b);return x===Infinity?1:y===Infinity?-1:y-x});
    if(filters.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
    $s('catalogueTitle').textContent=filters.category==='all'?'Find your perfect packaging.':labelOf(filters.category)+'.';
    $s('shopResults').textContent=`${list.length} ${list.length===1?'product':'products'}${filters.query?' matching “'+filters.query+'”':''}`;
    $s('shopProducts').innerHTML='';$s('shopEmpty').hidden=!!list.length;$s('shopLoadMore').hidden=list.length<=filters.limit;
    list.slice(0,filters.limit).forEach(p=>{
      const article=document.createElement('article');article.className='shop-product-card';article.dataset.productId=p.id;
      const tag=!isAvailable(p)?'Sold out':(p.studio||p.mockupAvailable)?'Try in 3D':'EcoPak collection';
      article.innerHTML=`<button class="shop-product-image" aria-label="View ${esc(p.name)}"><span class="shop-card-tag ${!isAvailable(p)?'is-sold-out':''}">${tag}</span>${photo(p)}<span class="shop-image-arrow" aria-hidden="true">↗</span></button><span class="shop-card-category">${esc(labelOf(p.category))}</span><button class="shop-card-title">${esc(p.name)}</button><span class="shop-card-size">${esc(p.size.replace(/^Size\s*:\s*/i,''))}</span><div class="shop-card-bottom"><span class="shop-card-price">${cardPrice(p)}</span><button class="shop-card-config">View options ↗</button></div>`;
      article.querySelectorAll('button').forEach(b=>b.onclick=()=>openProduct(p.id));
      const studioButton=document.createElement('button');studioButton.type='button';studioButton.className='shop-card-studio';studioButton.dataset.productId=p.id;studioButton.setAttribute('aria-label','Open 3D mockup: '+p.name);studioButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 0v10m9-5-9 5-9-5m9 5v10"/></svg><span>Design in 3D</span><span aria-hidden="true">↗</span>';studioButton.onclick=()=>openStudio(p,firstOption(p));article.append(studioButton);$s('shopProducts').append(article);
    });
  }
  $s('shopSearch').oninput=e=>{filters.query=e.target.value;filters.limit=12;renderProducts()};
  $s('shopPriced').onchange=e=>{filters.priced=e.target.checked;filters.limit=12;renderProducts()};
  $s('shopStudioOnly').onchange=e=>{filters.studio=e.target.checked;filters.limit=12;renderProducts()};
  $s('shopSort').onchange=e=>{filters.sort=e.target.value;renderProducts()};
  $s('shopReset').onclick=reset;$s('shopClearSearch').onclick=reset;$s('shopLoadMore').onclick=()=>{filters.limit+=12;renderProducts()};
  document.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{filters.use=b.dataset.use;filters.category='all';filters.limit=12;history.replaceState(null,'','#shop');syncFilterControls();renderProducts()});
  function openProduct(id,route=true){
    const p=byId.get(id);if(!p)return;activeProduct=p;
    const images=photoList(p),overview=p.description.split(/\n/).filter(line=>!/^(material|size|dimension|capacity)\s*:/i.test(line)).join('\n').trim()||p.description;
    $s('shopProductContent').innerHTML=`<div class="shop-product-layout"><div class="shop-detail-visual"><div class="ecopak-gallery-main">${photo(p,'ecopak-gallery-image',false)}</div><div class="ecopak-gallery-thumbs" aria-label="Product photographs">${images.map((im,i)=>`<button type="button" data-photo="${i}" aria-label="View photo ${i+1} of ${images.length}" aria-pressed="${i===0}"><img src="${esc(im.src)}" alt="${esc(im.alt||p.name+' photograph '+(i+1))}" loading="lazy"></button>`).join('')}</div><span class="ecopak-photo-credit">EcoPak Online product photography</span></div><div class="shop-detail-content"><span class="shop-kicker">${esc(labelOf(p.category))}</span><h2 id="shopProductTitle">${esc(p.name)}</h2><p class="shop-detail-description">${esc(overview)}</p><dl class="shop-detail-specs"><div><dt>Material</dt><dd>${esc(p.material.replace(/^Material\s*:\s*/i,''))}</dd></div><div><dt>Size / capacity</dt><dd>${esc(p.size.replace(/^Size\s*:\s*/i,''))}</dd></div></dl><form id="shopProductForm"><div class="shop-detail-controls"><label>Choose an option<select id="shopOption">${p.options.map((o,i)=>`<option value="${i}">${esc(o.label)}${o.available===false?' — Sold out':''}</option>`).join('')}</select></label><label id="shopQtyLabel">Quantity<input id="shopQuantity" type="number" inputmode="numeric" required max="100000" value="${p.quantityDefault||1}"></label></div><p class="shop-detail-notice" id="shopMinNote"></p><div class="shop-detail-price" id="shopDetailPrice" aria-live="polite"></div><label class="shop-custom-toggle"><input type="checkbox" id="shopCustomPrint"> Request custom printing / a different finish</label><label>Anything we should know? <span>(optional)</span><textarea id="shopProductNotes" maxlength="500" rows="2" placeholder="Your logo, print colours, timing…"></textarea></label><div class="shop-detail-actions"><button type="submit" class="shop-button yellow" id="shopAddQuote">Add to quote list <span>+</span></button>${(p.studio||p.mockupAvailable)?'<button type="button" class="shop-button" id="shopOpenStudio">View this product in 3D ↗</button>':''}<a class="shop-official-link" id="shopOfficialProduct" target="_blank" rel="noopener noreferrer" href="${esc(sourceUrl(p))}">View on EcoPak’s live shop ↗</a></div></form><div class="shop-detail-source" id="shopDetailSource"></div>${(p.studio||p.mockupAvailable)?`<p class="shop-detail-notice">${esc(p.studioNote||'The 3D model is an illustrative structure, not a production-verified dieline for this exact product. Artwork and physical fit need approval.')}</p>`:''}</div></div>`;
    function selectPhoto(i){const im=images[i];if(!im)return;const main=$s('shopProductContent').querySelector('.ecopak-gallery-image');if(main){main.src=im.src;main.alt=im.alt||p.name}document.querySelectorAll('[data-photo]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.photo===i)))}
    document.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>selectPhoto(+b.dataset.photo));
    $s('shopOption').value=firstOption(p);
    function updatePrice(resetQty=false){
      const o=p.options[+$s('shopOption').value],q=$s('shopQuantity');q.min=o.minQty;q.step=o.step;if(resetQty||+q.value<o.minQty)q.value=Math.max(o.minQty,p.quantityDefault||1);$s('shopQtyLabel').firstChild.textContent=quantityLabel(o);
      const totalUnits=(+q.value||0)*o.unitsPerPack,custom=$s('shopCustomPrint').checked,hasPrice=o.unitPrice!==null&&!custom;
      $s('shopMinNote').textContent=o.available===false?'This option was sold out at the last catalogue import. Check the live shop for current stock.':`${o.piecesPerOption>1?o.piecesPerOption+' pieces in each pack. '+((+q.value||0)*o.piecesPerOption)+' pieces selected.':'Selected option: '+o.label+'.'} ${o.minQty>1?'Minimum '+o.minQty+'. ':''}`;
      $s('shopAddQuote').disabled=o.available===false;
      $s('shopDetailPrice').innerHTML=hasPrice?`<div><strong>${money(o.unitPrice*totalUnits)}</strong><small>Product total · ${+q.value||0} × ${esc(o.label)}</small></div><span>${o.compareAtPrice>o.unitPrice?'<del>'+money(o.compareAtPrice)+'</del><br>':''}${money(o.unitPrice*o.unitsPerPack)} / ${esc(priceUnit(o))}</span>`:'<div><strong>Let’s quote it.</strong><small>Custom work is priced after artwork review.</small></div>';
      $s('shopDetailSource').innerHTML=`<strong>EcoPak Online.</strong> Price for the selected option.<br>Imported ${esc(o.source?.date||'2026-11-13')}. Prices and stock may change; checkout on the live shop confirms the final amount. Delivery, tax and custom print are confirmed separately.`;
      $s('shopOfficialProduct').href=sourceUrl(p)+(sourceUrl(p).includes('?')?'&':'?')+(o.variantId?'variant='+encodeURIComponent(o.variantId):'');
      const variantSrc=o.image?.src||o.image;const index=images.findIndex(im=>im.src===variantSrc||o.imageId&&String(im.id)===String(o.imageId));if(index>=0)selectPhoto(index);
    }
    $s('shopOption').onchange=()=>updatePrice(true);$s('shopQuantity').oninput=()=>updatePrice();$s('shopCustomPrint').onchange=()=>updatePrice();updatePrice();
    $s('shopProductForm').onsubmit=e=>{e.preventDefault();const line={productId:p.id,optionIndex:+$s('shopOption').value,quantity:+$s('shopQuantity').value,customPrint:$s('shopCustomPrint').checked,notes:$s('shopProductNotes').value.trim()};if(!validLine(line)){announce('Choose an available option and a valid quantity.');return}if(bag.length>=100){announce('Your list has room for 100 configurations. Download it before starting another.');return}bag.push(line);saveBag();closeDialog('shopProductDialog');announce(`${p.name} added to your quote list.`)};
    if(p.studio||p.mockupAvailable){const studioButton=$s('shopOpenStudio');studioButton.onclick=()=>openStudio(p,+$s('shopOption').value);$s('shopProductTitle').after(studioButton);}
    if(!$s('shopProductDialog').open)showDialog('shopProductDialog');
    if(route)history.replaceState(null,'','#shop/'+encodeURIComponent(id));
  }
  function openStudio(p,index=firstOption(p)){
    if(!window.EcoPakMockups){announce('The 3D studio could not load. Please refresh the page.');return;}
    if($s('shopProductDialog').open)closeDialog('shopProductDialog');window.EcoPakMockups.open(p,index);return;
  }

  function lineGuide(line){const o=byId.get(line.productId).options[line.optionIndex];return line.customPrint||o.unitPrice===null?null:o.unitPrice*o.unitsPerPack*line.quantity}
  function renderBag(){
    const root=$s('shopBagLines');root.innerHTML='';$s('shopBriefForm').hidden=!bag.length;$s('shopBriefStatus').textContent='';
    if(!bag.length){root.innerHTML='<div class="shop-bag-empty"><span class="shop-kicker">YOUR PACKAGING, TOGETHER</span><h3>What are you packing?</h3><p>Choose your products and options,<br>then build a brief for EcoPak.</p><button class="shop-button yellow" id="shopStartList">Explore the collection ↗</button></div>';$s('shopStartList').onclick=()=>{closeDialog('shopBagDialog');view('shop')};$s('shopBagSummary').innerHTML='';return}
    bag.forEach((line,i)=>{
      const p=byId.get(line.productId),o=p.options[line.optionIndex],total=lineGuide(line),article=document.createElement('article');article.className='shop-bag-line';
      article.innerHTML=`${photo(p)}<div><h3>${esc(p.name)}</h3><p>${esc(o.label)}${line.customPrint?' · Custom print / finish':''}${line.notes?'<br>'+esc(line.notes):''}</p><div class="shop-line-controls"><button data-line-minus aria-label="Reduce ${esc(p.name)} quantity" ${line.quantity<=o.minQty?'disabled':''}>−</button><span>${line.quantity} ${esc(quantityLabel(o).toLowerCase())}</span><button data-line-plus aria-label="Increase ${esc(p.name)} quantity" ${line.quantity+o.step>100000?'disabled':''}>+</button><button class="shop-remove" data-line-remove>Remove</button></div></div><strong>${total===null?'To quote':money(total)}<small>${total===null?'Custom price':'Product total'}</small></strong>`;
      function changeQuantity(delta,selector){line.quantity=Math.max(o.minQty,Math.min(100000,line.quantity+delta));saveBag();renderBag();const row=root.children[i],control=row?.querySelector(selector);(control&&!control.disabled?control:row?.querySelector('[data-line-remove]'))?.focus()}
      article.querySelector('[data-line-minus]').onclick=()=>changeQuantity(-o.step,'[data-line-minus]');article.querySelector('[data-line-plus]').onclick=()=>changeQuantity(o.step,'[data-line-plus]');article.querySelector('[data-line-remove]').onclick=()=>{bag.splice(i,1);saveBag();renderBag();(root.children[Math.min(i,bag.length-1)]?.querySelector('[data-line-remove]')||$s('shopStartList'))?.focus()};root.append(article);
    });
    const known=bag.map(lineGuide).filter(v=>v!==null),unpriced=bag.length-known.length,subtotal=known.reduce((a,b)=>a+b,0);
    $s('shopBagSummary').innerHTML=`<div class="shop-bag-totals"><span>${known.length?'Catalogue subtotal':'Your list is ready for a quote'}</span><strong>${known.length?money(subtotal):'To quote'}</strong></div><p class="shop-bag-summary-note">${unpriced?`${unpriced} ${unpriced===1?'configuration needs':'configurations need'} a custom price. `:''}Based on imported EcoPak option prices. Custom printing, delivery and tax are confirmed separately. No order has been placed.</p>`;
  }
  $s('shopBagButton').onclick=()=>{renderBag();showDialog('shopBagDialog')};
  let enquiryRequestId=crypto.randomUUID();
  $s('shopBriefForm').onsubmit=async e=>{
    e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;$s('shopBriefStatus').textContent='Sending your enquiry…';
    try{
      const f=Object.fromEntries(new FormData(e.target));
      const response=await fetch('/api/v1/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,requestId:enquiryRequestId,items:bag.map(line=>({...line}))})});
      const result=await response.json();if(!response.ok)throw Error(result.message||'We could not send your enquiry. Please try again.');
      $s('shopBriefStatus').textContent='Enquiry received. Your reference is '+result.enquiryId+'. Keep this number when following up.';
      enquiryRequestId=crypto.randomUUID();e.target.reset();announce('Your enquiry has been received. Reference '+result.enquiryId+'.');
    }catch(err){$s('shopBriefStatus').textContent=err.message||'Connection lost. Please try again; your quote list is still here.'}finally{button.disabled=false}
  };
  function info(kind){
    const content=kind==='privacy'?['Your ideas stay with you.','<p>Quote lists and 3D projects are saved in this browser. When you submit an enquiry, your contact details, selected products and notes are stored securely so the team can reply about your request.</p><p>Artwork stays in the local editor until you export it. Google Fonts loads typefaces. Product photographs come from EcoPak’s catalogue and its image hosting service. EcoPak’s live shop has its own <a href="https://www.ecopakonline.com/policies/privacy-policy" target="_blank" rel="noopener">privacy policy</a>.</p>']:kind==='ordering'?['Ready for your next step.','<p>Build a quote brief here, or follow a product link to EcoPak’s live shop to check stock and order. Submit an enquiry to confirm availability, artwork and the final quote. This site does not take payment or confirm an order.</p><p>Custom artwork and dielines need EcoPak’s approval. Shipping, production time and the final delivered price are confirmed before ordering.</p><p><a href="https://www.ecopakonline.com/policies/shipping-policy" target="_blank" rel="noopener">EcoPak shipping policy ↗</a> · <a href="https://www.ecopakonline.com/policies/refund-policy" target="_blank" rel="noopener">Refund policy ↗</a></p>']:['The price for the option you choose.','<p>These are EcoPak Online’s published PKR prices, imported on '+esc(importedDate)+'. Each price belongs to its exact size, colour and pack option. Stock and prices are a snapshot; EcoPak’s live checkout confirms the current amount.</p><ul><li>Choosing a 50-piece pack shows the full price of that pack. Increasing quantity adds more of the same pack.</li><li>Prices are not divided into invented per-piece rates. No additional bulk discount is applied.</li><li>Custom printing or a changed finish needs a separate quote.</li><li>Delivery, tax, setup and timing are confirmed separately.</li></ul>'];
    $s('shopInfoContent').innerHTML=`<span class="shop-kicker">GOOD TO KNOW</span><h2 id="shopInfoTitle">${content[0]}</h2>${content[1]}`;showDialog('shopInfoDialog');
  }
  $s('shopPricingInfo').onclick=()=>info('pricing');document.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>info(b.dataset.policy));
  function readRoute(initial=false){const hash=location.hash.slice(1);if(!hash.startsWith('shop')){if($s('shopProductDialog').open)$s('shopProductDialog').close();return}if(hash.startsWith('shop/')){let id;try{id=decodeURIComponent(hash.slice(5))}catch{history.replaceState(null,'','#shop');announce('That product link could not be opened. Browse the collection below.');return}if(byId.has(id)&&activeProduct?.id!==id)openProduct(id,false);return}if($s('shopProductDialog').open)$s('shopProductDialog').close();const query=new URLSearchParams(hash.split('?')[1]||'');const category=query.get('category');if(category&&(category==='all'||categories.some(c=>c.id===category))){filters.category=category;filters.use='all';filters.limit=12;syncFilterControls();renderProducts();if(!initial)scrollToCatalogue()}}
  window.EcoPakShop={openProduct,addToEnquiry(productId,optionIndex=0){const p=byId.get(productId),o=p?.options[optionIndex];if(!o)return;view('shop');openProduct(productId);$s('shopOption').value=optionIndex;$s('shopOption').dispatchEvent(new Event('change'));},showEnquiryList(){renderBag();showDialog('shopBagDialog')}};
  window.addEventListener('hashchange',()=>readRoute());updateCount();syncFilterControls();renderProducts();readRoute(true);
})();
