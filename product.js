// Product experience: a small set of clear, working actions.
document.querySelector('.brand-sub').textContent='COLLECTION & STUDIO';document.querySelector('nav [data-view=editor]').textContent='Packaging studio';document.querySelector('.local-tag').textContent='Saved on this device';
document.querySelector('.studio-heading h2').textContent='Your design goes here';document.querySelector('.studio-heading p').textContent='Pick a side, upload your artwork, and move it into place.';
document.querySelector('.studio-steps').hidden=true;document.querySelector('.projectbar .eyebrow').textContent='MAKE SOMETHING WORTH OPENING';$('topQuote').textContent='Export mockup';$('topQuote').onclick=()=>$('exportMockup').click();
const modelPane=document.querySelector('.pane[data-p="models"]');modelPane.querySelector('h2').textContent='Start with a box';modelPane.querySelector('p').textContent='Choose a shape. You can change its size and finish later.';
const helper=document.createElement('button');helper.className='recommend-button';helper.innerHTML='<span>Not sure which box?</span><small>Tell us what’s going inside ↗</small>';modelPane.prepend(helper);
const helpDialog=document.createElement('dialog');helpDialog.id='recommendDialog';helpDialog.innerHTML='<form id="recommendForm"><div class="dialoghead"><span class="eyebrow">LET’S FIND A STARTING POINT</span><button class="close" type="button" aria-label="Close box finder">×</button></div><h1>What are you packing?</h1><p>A little detail helps. Tell us about the product, how many there are, and whether you’ll be shipping it.</p><label for="productDescription">Your product</label><textarea id="productDescription" minlength="10" maxlength="2000" required rows="4" placeholder="A glass candle in a jar, sent as a gift. It needs room for a protective insert."></textarea><button class="btn pri" type="submit">Find a box</button><div id="recommendResult" role="status"></div><p class="engine-note">This version uses product rules, not AI. Always confirm dimensions and protection with a physical sample.</p></form>';
document.body.append(helpDialog);helper.onclick=()=>helpDialog.showModal();helpDialog.querySelector('.close').onclick=()=>helpDialog.close();
$('recommendForm').onsubmit=async ev=>{ev.preventDefault();$('recommendResult').textContent='Finding a starting point…';try{const r=await folioApi('recommendations',{description:$('productDescription').value});$('recommendResult').innerHTML='';const p=PRESETS.find(p=>p.id===r.template_id);const title=document.createElement('h2');title.textContent=p?.n||'Mailer box';const reason=document.createElement('p');reason.textContent=r.reason;const question=document.createElement('p');question.textContent=r.questions.join(' ');const button=document.createElement('button');button.type='button';button.className='btn pri';button.textContent='Try this box';button.onclick=()=>{if(p){S.template=p.id;[S.L,S.W,S.H]=p.d;refresh();commit()}helpDialog.close();view('editor')};$('recommendResult').append(title,reason,question,button)}catch(e){$('recommendResult').textContent=e.message}};
// Keep the useful editing controls together; advanced cover modes stay under Artwork.
const finishRow=document.createElement('div');finishRow.className='quick-finishes';finishRow.innerHTML='<span class="eyebrow">PAPER COLOR</span>';const colorGroup=document.createElement('div');colorGroup.className='sw';[['White','#FFFFFF'],['Black','#111612'],['Yellow','#E7FF73'],['Green','#9CDBB0'],['Kraft','#B98B5E']].forEach(([name,color])=>{const b=document.createElement('button');b.style.background=color;b.setAttribute('aria-label',name+' box');b.title=name;b.onclick=()=>{S.color=color;S.mat=color==='#B98B5E'?'kraft':'sbs';refresh();commit()};colorGroup.append(b)});finishRow.append(colorGroup);modelPane.append(finishRow);
const camera=document.createElement('div');camera.className='view-presets';[['Front',0,0],['Three-quarter',.35,-.55],['Top',1.2,0]].forEach(([label,x,y])=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{tx=x;group.rotation.set(x,y,0);zoom=1;auto=false};camera.append(b)});document.querySelector('.stage').append(camera);
const play=document.createElement('button');play.className='btn';play.id='playFold';play.textContent='▷ Preview fold';document.querySelector('.scene-tools').prepend(play);let playing=false,playFrame;
play.onclick=()=>{playing=!playing;play.textContent=playing?'Ⅱ Pause':'▷ Preview fold';if(!playing){cancelAnimationFrame(playFrame);return}const start=performance.now();const phase=Math.acos(1-2*Number($('openingAmount').value)/100);function frame(now){if(!playing)return;const value=(1-Math.cos(phase+(now-start)/2200*Math.PI))/2;setOpening(Math.round(value*100));playFrame=requestAnimationFrame(frame)}playFrame=requestAnimationFrame(frame)};
$('openingAmount').addEventListener('pointerdown',()=>{playing=false;cancelAnimationFrame(playFrame);play.textContent='▷ Preview fold'});
// Clear controls that are no longer relevant when switching views.
const productView=view;view=function(name){productView(name);document.body.dataset.view=name;if(name!=='editor'){playing=false;cancelAnimationFrame(playFrame)}};
const foldNote=document.createElement('p');foldNote.className='fold-note';foldNote.textContent='Closed → lid open → walls unfolded → flat';document.querySelector('.stage').append(foldNote);
// Set a restrained studio composition and keep flat layouts within view.
const baseSetOpening=setOpening;setOpening=function(value){baseSetOpening(value);zoom=1};
$('fullyOpen').onclick=()=>setOpening(0);$('fullyClosed').onclick=()=>setOpening(100);$('openingAmount').oninput=e=>setOpening(+e.target.value);
function modelCards(){document.querySelectorAll('#models .card').forEach((b,i)=>{const p=PRESETS[i];const icon=document.createElement('span');icon.className='mini-package '+(p.id==='tuck-carton'?'tall':'');icon.innerHTML='<i></i>';b.prepend(icon)})}modelCards();

// Keep the drawing, the 3D assembly and the downloaded file on one structure.
const dieSelector=$('dieStructure');
for(const board of [...new Set(PRESETS.map(p=>p.board))]){
  const options=document.createElement('optgroup');
  options.label=board;
  dieSelector.append(options);
  PRESETS.filter(p=>p.board===board).forEach(p=>options.append(new Option(p.n,p.id)));
}
function syncDieline(){
  dieSelector.value=S.template;
  $('dieDims').textContent=[S.L,S.W,S.H].join(' × ')+' mm';
}
dieSelector.onchange=()=>{
  const preset=PRESETS.find(p=>p.id===dieSelector.value);
  S.template=preset.id;
  [S.L,S.W,S.H]=preset.d;
  setOpening(0);
  refresh();
  commit();
  syncDieline();
};
const choosePane=showP;
showP=function(name){
  choosePane(name);
  const enabled=name==='export';
  if(enabled!==dielineMode){
    dielineMode=enabled;
    document.querySelector('.stage').classList.toggle('drawing',enabled);
    stageLabel.textContent=enabled?'DIELINE  /  ASSEMBLY':'3D MOCKUP · Drag to rotate / scroll to zoom';
    if(enabled){
      playing=false;
      cancelAnimationFrame(playFrame);
      play.textContent='▷ Preview fold';
      setOpening(0);
    } else {
      group.rotation.set(.38,-.62,0);
      tx=.38;
    }
    build();
  }
  if(enabled) syncDieline();
};
const stageLabel=document.querySelector('.stage .hintf');
const updateOpening=setOpening;
setOpening=function(value){
  updateOpening(value);
  if(dielineMode){
    const label=value===0?'Flat dieline':value===100?'Assembled':value+'% folded';
    $('openingValue').textContent=label;
    $('openingAmount').setAttribute('aria-valuetext',label);
  }
  stageLabel.textContent=dielineMode?'DIELINE  /  ASSEMBLY':'3D MOCKUP · Drag to rotate / scroll to zoom';
};
$('fullyClosed').textContent='Folded';
foldNote.textContent='Flat sheet → fold the walls → assembled pack';
if(!previews.length) makePreviews();
document.querySelectorAll('#models .card').forEach((button,i)=>{
  const p=PRESETS[i];
  if(i===0 || p.board!==PRESETS[i-1].board){
    const title=document.createElement('h3'); title.className='stock-title'; title.textContent=p.board;button.before(title);
  }
  const icon=button.querySelector('.mini-package');
  const img=document.createElement('img');img.className='net-icon';img.src=previews[i];img.alt='';icon.replaceWith(img);
});
const requested=new URLSearchParams(location.search);
if(requested.get('tool')==='dieline'){
  showP('export');
  if(PRESETS.some(p=>p.id===requested.get('model'))){
    dieSelector.value=requested.get('model');
    dieSelector.onchange();
  }
}

// Category artwork is an original illustration. Dieline thumbnails come from the model itself.
const productArt={
  mailer:'<path fill="#d5b9b2" d="M18 82l76 18 49-30-71-14z"/><path fill="#162e50" d="M18 82l76 18v22l-76-19z"/><path fill="#415778" d="M94 100l49-30v21l-49 31z"/><path fill="#efb8cb" d="M72 56l-9-44 70 9 10 49z"/><path fill="#ffdee8" d="M63 12l4-6 67 9-1 6z"/><path fill="none" stroke="#bd8c9f" d="M74 56l65 12"/><text x="79" y="38" fill="#673d51" font-size="12" transform="rotate(8 79 38)">folio.</text>',
  gift:'<path fill="#c18f9e" d="M32 60l66 16v48l-66-17z"/><path fill="#d7a6b8" d="M98 76l40-23v47l-40 24z"/><path fill="#ecc0d0" d="M28 56l69 17v12L28 68z"/><path fill="#e2b0c1" d="M97 73l45-25v12L97 85z"/><path fill="#f9dce7" d="M28 56l42-22 72 14-45 25z"/><path fill="#213856" d="M58 40l12-6 72 14-12 7z"/><path fill="#243b59" d="M130 55l12-7v12l-12 7z"/><text x="44" y="88" fill="#6a364e" transform="rotate(14 44 88)" font-size="14">folio.</text>',
  bag:'<path d="M60 59V33q0-34 23-26 11 4 12 23v23M77 54V29q1-28 19-21 11 4 12 22v21" fill="none" stroke="#aa805b" stroke-width="4"/><path d="M38 44l69 9-2 73-71-13z" fill="#dbb99a"/><path d="M107 53l21-10 5 71-28 12z" fill="#ba9377"/><path d="M38 44l24-9 66 8-21 10z" fill="#96745f"/><path d="M116 48l2 57 15 9" fill="none" stroke="#a67e62"/><text x="47" y="87" font-size="23" fill="#493e3c" transform="rotate(9 47 87)">folio.</text>',
  hoodie:'<path d="M59 39q0-28 18-34 21-8 33 14l5 19 18 10 20 63-19 8-16-37 1 42q-37 9-70-2l2-42-18 39-18-7 24-65z" fill="#233855"/><path d="M59 39q4-28 19-31 14-4 27 12l9 18q-21 11-32 9z" fill="#344b69"/><path d="M66 34q18-23 34 0l-15 12z" fill="#14243b"/><path d="M62 104l8-12 28 1 9 13-2 9-43-1z" fill="#304663"/><path d="M17 107l17 6-3 9-17-6zm117 6l17-7 3 9-17 6z" fill="#172c45"/><path d="M77 44l-4 20m15-20 2 22" stroke="#65728a" fill="none"/><text x="64" y="78" font-size="16" fill="#f6d0df">folio.</text>'
};
// Keep category illustrations in the same palette as the studio.
const galleryColors = {
  '#d5b9b2':'#7ba78c', '#162e50':'#27382a', '#415778':'#4b6d50',
  '#efb8cb':'#d9ee71', '#ffdee8':'#f0f6ba', '#bd8c9f':'#86aa63',
  '#673d51':'#243a29', '#c18f9e':'#639775', '#d7a6b8':'#83ad8f',
  '#ecc0d0':'#cce978', '#e2b0c1':'#96bb68', '#f9dce7':'#e8f7ab',
  '#213856':'#19271c', '#243b59':'#253c2b', '#6a364e':'#263b2b',
  '#aa805b':'#8e9d70', '#dbb99a':'#b8ce8d', '#ba9377':'#8ca96e',
  '#96745f':'#627449', '#a67e62':'#718955', '#493e3c':'#243c2b',
  '#233855':'#2d4534', '#344b69':'#46654b', '#14243b':'#17291d',
  '#304663':'#38573f', '#172c45':'#223a29', '#65728a':'#90a47e',
  '#f6d0df':'#e7ff73'
};
for (const name of Object.keys(productArt)) {
  productArt[name] = productArt[name].replace(/#[a-f0-9]{6}/gi, color => galleryColors[color.toLowerCase()] || color);
}
productArt['tshirt-short']='<path d="M56 24L70 17Q80 26 92 17L106 24L137 43L121 68L107 61L109 122Q81 130 53 122L55 61L40 68L24 43Z" fill="#b9d59f"/><path d="M70 17Q80 44 92 17L98 21Q82 52 64 21Z" fill="#698d63"/><path d="M56 25L54 58M106 25L108 58M54 116Q81 123 108 116M29 45L43 65M132 45L119 65" fill="none" stroke="#80a675"/><text x="65" y="74" fill="#253e2b" font-size="15">folio.</text>';
productArt['tshirt-long']='<path d="M57 25L70 17Q80 26 92 17L105 25L121 40L141 109L125 116L107 68L109 122Q81 130 53 122L55 68L37 116L21 109L41 40Z" fill="#63896b"/><path d="M70 17Q80 44 92 17L98 21Q82 52 64 21Z" fill="#355c3e"/><path d="M21 109L37 116L34 123L19 116ZM125 116L141 109L144 116L128 123Z" fill="#355c3e"/><path d="M54 117Q81 123 108 117" fill="none" stroke="#355c3e"/><text x="65" y="74" fill="#e7ff73" font-size="15">folio.</text>';

let requestedGarment = null;
const apparelFrame = $('hoodieEditor');
function sendGarmentChoice() {
  if (requestedGarment && apparelFrame.contentWindow) {
    apparelFrame.contentWindow.postMessage({type:'folio:garment',garment:requestedGarment},location.origin);
  }
}
apparelFrame.addEventListener('load', sendGarmentChoice);
function openApparel(kind) {
  requestedGarment = kind;
  if (!apparelFrame.hasAttribute('src')) apparelFrame.src='/hoodie?garment='+kind;
  else sendGarmentChoice();
  view('hoodie');
}
function homeCard(container,name,caption,art,open){
  const button=document.createElement('button');
  button.className='home-card';
  button.innerHTML='<strong></strong><small></small><span class="home-art" aria-hidden="true"></span><span class="home-arrow" aria-hidden="true">→</span>';
  button.querySelector('strong').textContent=name;
  button.querySelector('small').textContent=caption;
  button.querySelector('.home-art').innerHTML=art;
  button.onclick=open;
  container.append(button);
}
function startModel(id,drawing){
  const preset=PRESETS.find(p=>p.id===id);
  view('editor');showP(drawing?'export':'models');
  S.template=id;[S.L,S.W,S.H]=preset.d;
  setOpening(drawing?0:100);refresh();commit();
  if(drawing)syncDieline();
}
for(const [title,caption,art,id] of [
  ['Mailer boxes','Hinged lid','mailer','mailer'],['Gift boxes','Deep gift box','gift','deep-gift'],
  ['Paper bags','Gusseted sides','bag','board-paper-bag'],['Hoodies','Pullover hoodie','hoodie',null],
  ['Half Sleeved Shirts','Classic crew neck','tshirt-short',null],['Full Sleeved Shirts','Classic crew neck','tshirt-long',null]]){
  homeCard($('mockupCards'),title,caption,'<svg viewBox="0 0 160 138">'+productArt[art]+'</svg>',()=>id?startModel(id,false):openApparel(art));
}
for(const [title,id] of [['Tuck end','board-tuck-end'],['Auto bottom','board-auto-bottom'],['Roll end','corr-roll-end'],['Paper bag','board-paper-bag'],['Simple tray','board-simple-tray'],['Frame tray','board-frame-tray'],['Flap box','corr-flap-box'],['Wing closure','corr-roll-end-wing']]){
  const index=PRESETS.findIndex(p=>p.id===id);
  homeCard($('netCards'),title,PRESETS[index].board,'<img alt="" src="'+previews[index]+'">',()=>startModel(id,true));
}
$('allStructures').onclick=()=>view('templates');
