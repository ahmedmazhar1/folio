/* Customer enquiries and the light launch experience. */
(function(){
 'use strict';
 const get=id=>document.getElementById(id);
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dialog=document.createElement('dialog');dialog.id='generalEnquiryDialog';dialog.className='shop-dialog';dialog.setAttribute('aria-labelledby','generalEnquiryTitle');
 dialog.innerHTML='<div class="shop-dialog-heading"><div><span class="shop-kicker">LET’S MAKE IT HAPPEN</span><h2 id="generalEnquiryTitle">Tell us what you need.</h2></div><button class="shop-modal-close" type="button" aria-label="Close enquiry form">×</button></div><form id="generalEnquiryForm" style="padding:0 28px 28px"><p style="font-size:12px;line-height:1.7;color:#6b7564">Packaging, custom printing, or a little help choosing. Leave your details and the team will get back to you.</p><div class="shop-form-grid"><label>Your name<input name="name" required autocomplete="name" maxlength="100"></label><label>Email<input name="email" type="email" required autocomplete="email" maxlength="200"></label><label>Delivery city<input name="city" required autocomplete="address-level2" maxlength="100"></label><label>Phone <span>(optional)</span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label></div><label class="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label>What are you looking for?<textarea name="message" required minlength="10" maxlength="2000" rows="5" placeholder="The product, quantity, size and any custom printing you have in mind…"></textarea></label><p class="shop-brief-note">Your details are used to respond to this enquiry. A quote confirms availability, specifications and delivery; submitting this form does not place an order.</p><button type="submit" class="shop-button yellow">Send enquiry <span>↗</span></button><p id="generalEnquiryStatus" role="status" style="font-size:12px;line-height:1.7"></p></form>';
 document.body.append(dialog);dialog.querySelector('.shop-modal-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
 let lastTrigger=null;dialog.addEventListener('close',()=>lastTrigger?.isConnected&&lastTrigger.focus());
 function openEnquiry(message=''){lastTrigger=document.activeElement;get('generalEnquiryStatus').textContent='';get('generalEnquiryForm').elements.message.value=message;dialog.showModal();}
 window.EcoPakEnquiries={open:openEnquiry};
 const footer=document.querySelector('.shop-footer>div');if(footer){const button=document.createElement('button');button.type='button';button.className='general-enquiry-button';button.textContent='Contact us';button.onclick=()=>openEnquiry();footer.prepend(button);}
 let requestId=crypto.randomUUID();
 get('generalEnquiryForm').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]'),status=get('generalEnquiryStatus');button.disabled=true;status.textContent='Sending your enquiry…';
  try{
   const details=Object.fromEntries(new FormData(form));
   const response=await fetch('/api/v1/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...details,requestId})});
   const result=await response.json();if(!response.ok)throw Error(result.message||'We could not send your enquiry. Please try again.');
   status.className='enquiry-receipt';status.textContent='Thank you. Your enquiry has been received. Reference: '+result.enquiryId+'. Keep this number when following up.';form.reset();requestId=crypto.randomUUID();
  }catch(error){status.className='enquiry-error';status.textContent=error.message||'Connection lost. Please try again.'}finally{button.disabled=false}
 };
 // The legacy design studio shares the real enquiry endpoint.
 const quoteForm=get('quoteForm');if(quoteForm){
  quoteForm.querySelector('[type=submit]').textContent='Send design enquiry ↗';
  quoteForm.querySelectorAll('.notice').forEach(note=>note.textContent='Send the design specifications for a quote. Your artwork stays on this device; export it to share when the team replies.');
  const receipt=document.createElement('p');receipt.setAttribute('role','status');quoteForm.append(receipt);let quoteRequestId=crypto.randomUUID();
  quoteForm.onsubmit=async event=>{
   event.preventDefault();const button=quoteForm.querySelector('[type=submit]');button.disabled=true;receipt.textContent='Sending your design enquiry…';
   try{
    const f=Object.fromEntries(new FormData(quoteForm));const message=[get('quoteSpecs').textContent,f.notes||''].filter(Boolean).join('\n');
    const response=await fetch('/api/v1/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,message,requestId:quoteRequestId})});const result=await response.json();if(!response.ok)throw Error(result.message||'We could not send your enquiry.');
    receipt.textContent='Enquiry received. Reference: '+result.enquiryId;quoteRequestId=crypto.randomUUID();toast('Design enquiry received. Reference '+result.enquiryId);
   }catch(error){receipt.textContent=error.message}finally{button.disabled=false}
  };
 }
 // Keep exported previews on the same white background as the studio.
 if(get('sceneColor'))get('sceneColor').value='#f5f5f2';
 if(location.hash==='#home')view('shop');
 // Older shared URLs keep working after the story was retired.
 window.addEventListener('hashchange',()=>{if(location.hash==='#home')view('shop')});
 const faq=document.querySelector('.shop-faq');if(faq){const summary=Array.from(faq.querySelectorAll('summary')).find(n=>n.textContent.includes('every product'));if(summary)summary.parentElement.querySelector('p').textContent='Every catalogue product has a 3D preview. Published sizes are used where available; proportional previews identify missing measurements. Box folding, artwork and final print dimensions need approval before production.';}
 // The quote list is an enquiry basket, with no misleading checkout language.
 const listTitle=get('shopBagTitle');if(listTitle)listTitle.innerHTML='Your enquiry list<span>.</span>';
 document.querySelectorAll('.dimension-inputs input').forEach((input,i)=>{input.min=i===2?5:20;input.max=1000;});
 for(const [key,min] of [['L',20],['W',20],['H',5]]){if(get(key)){get(key).min=min;get(key).max=1000;}}
})();
