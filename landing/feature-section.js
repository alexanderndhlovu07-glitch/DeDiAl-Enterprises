/* The existing full-screen story, expanded into six connected capabilities. */
(() => {
 const section=document.querySelector('#possibilities');if(!section||!window.DEDIAL_PREVIEWS)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const items=[
  {key:'commerce',title:'Made for\nyour market.',label:'Commerce',tag:'Discover / sell / grow',story:['Considered products. Independent businesses.','A storefront, an order, a customer connection.','Local ambition. A wider market.'],cta:'Explore the marketplace vision',image:'assets/commerce-still-life.png',alt:'Sage table lamp and handcrafted objects in a design store',route:'signup'},
  {key:'accommodation',title:'Somewhere\nto slow down.',label:'Accommodation',tag:'A place / a moment / a stay',story:['Find a destination that feels like you.','Compare a room. Choose your dates.','Make space for a different pace.'],cta:'Explore stays with DeDiAl',image:'assets/river-house-concept.png',alt:'A fictional Zambian riverside lodge and open suite',route:'signup'},
  {key:'services',title:'Make time\nfor you.',label:'Services & appointments',tag:'Around the corner',story:['A familiar neighbourhood. A new discovery.','Find a service and a time that works.','Your everyday, a little easier.'],cta:'Explore local services',image:'assets/local-moments.webp',alt:'A woman exploring services from her home',route:'signup'},
  {key:'procurement',title:'Source far.\nGrow here.',label:'China → Zambia',tag:'From a specification to a possibility',story:['Start with what your business needs.','Connect the supplier, quotation and freight.','Bring global possibilities home.'],cta:'Start a sourcing request',image:'assets/logistics-harbour.webp',alt:'An international freight harbour at sunset',route:'signup'},
  {key:'logistics',title:'Every mile.\nIn view.',label:'Logistics intelligence',tag:'From movement to understanding',story:['A shipment is more than a moving dot.','Follow the stages. Understand the estimate.','Know what should happen next.'],cta:'Explore your connected workspace',image:'assets/global-sourcing.webp',alt:'Warehouse colleagues reviewing a parcel',route:'signup'} ];
 const navigation=section.querySelector('.feature-navigation');
 navigation.innerHTML=items.map((item,i)=>`<button type="button" data-feature-target="${i}"><span>${item.label}</span><span aria-hidden="true">↗</span></button>`).join('');
 const journey=document.createElement('div');journey.className='feature-journey';journey.style.setProperty('--chapter-count',items.length);
 journey.innerHTML=`<div class="feature-stage feature-stage--editorial"><div class="feature-scene-photo" aria-hidden="true"></div><div class="feature-editorial-title"><p class="feature-editorial-eyebrow"></p><h3 tabindex="-1"></h3><p class="feature-stage-module"></p></div><div class="feature-stage-copy"><div class="feature-interactive-preview"></div><div class="feature-card-details"><div class="feature-story"></div><a class="feature-editorial-link"><span></span><span aria-hidden="true">↗</span></a></div></div></div>`;
 navigation.after(journey);section.classList.add('has-feature-journey');
 const stage=journey.firstElementChild,copy=stage.querySelector('.feature-stage-copy'),link=copy.querySelector('a'),heading=stage.querySelector('h3'),preview=copy.querySelector('.feature-interactive-preview');let selected=-1,frame=0,disposePreview=()=>{},focusTimer;
 const clamp=value=>Math.max(0,Math.min(1,value));
 const select=index=>{
  if(index===selected)return;selected=index;const item=items[index];disposePreview();
  heading.replaceChildren(...item.title.split('\n').map(line=>{const span=document.createElement('span');span.textContent=line;span.style.setProperty('--line-index',heading.childElementCount);return span;}));
  stage.querySelector('.feature-editorial-eyebrow').textContent=item.label;stage.querySelector('.feature-stage-module').textContent=item.tag;
  copy.querySelector('.feature-story').replaceChildren(...item.story.map(text=>{const line=document.createElement('p');line.className='feature-story-line';line.textContent=text;return line;}));
  stage.querySelector('.feature-scene-photo').style.backgroundImage=`linear-gradient(90deg,rgba(12,44,39,.87),rgba(12,44,39,.5)),url('${item.image}')`;
  const interactive=['accommodation','services'].includes(item.key);stage.classList.toggle('is-story-only',!interactive);stage.classList.remove('is-interacting');preview.hidden=!interactive;preview.innerHTML=interactive?window.DEDIAL_PREVIEWS.render(item.key):'';disposePreview=interactive?window.DEDIAL_PREVIEWS.mount(preview,item.key):()=>{};
  link.querySelector('span').textContent=item.cta;const base=window.DEDIAL_CONFIG?.platformUrl||'http://127.0.0.1:4173/';link.href=item.href||`${base.replace(/\/$/,'')}/#${item.route}`;
  stage.dataset.chapter=String(index);stage.dataset.feature=item.key;
 };
 const render=()=>{
  frame=0;const rect=journey.getBoundingClientRect(),travel=journey.offsetHeight-innerHeight,progress=clamp(-rect.top/Math.max(1,travel)),index=Math.min(items.length-1,Math.floor(progress*items.length)),phase=progress===1?1:progress*items.length-index;
  select(index);stage.style.setProperty('--chapter-phase',reduced.matches?.5:phase);const exit=index===items.length-1?1:clamp((1-phase)/.08),reveal=reduced.matches?1:clamp((phase-.07)/.18)*exit;
  stage.style.setProperty('--feature-card-reveal',reveal);stage.style.setProperty('--feature-photo-reveal',reduced.matches?.76:reveal*.76);stage.style.setProperty('--feature-title-opacity',reduced.matches?1:exit);stage.style.setProperty('--feature-title-entry',reduced.matches?1:clamp(phase/.18));copy.inert=reveal<.15;
  copy.querySelectorAll('.feature-story-line').forEach((line,i)=>line.style.setProperty('--story-line-reveal',reduced.matches?1:clamp((phase-.23-i*.09)/.12)));
  const button=reduced.matches?1:clamp((phase-.49)/.12);link.style.setProperty('--story-button-reveal',button);link.inert=button<.2;
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(render);};
 const go=(index,focus=false)=>{const top=scrollY+journey.getBoundingClientRect().top;scrollTo({top:top+(journey.offsetHeight-innerHeight)*(index+(focus?.68:0))/items.length,behavior:reduced.matches?'instant':'smooth'});if(focus){clearTimeout(focusTimer);focusTimer=setTimeout(()=>heading.focus({preventScroll:true}),reduced.matches?20:600);}};
 preview.addEventListener('focusin',()=>stage.classList.add('is-interacting'));preview.addEventListener('focusout',()=>setTimeout(()=>{if(!preview.contains(document.activeElement))stage.classList.remove('is-interacting');},0));
 navigation.querySelectorAll('button').forEach((button,i)=>button.addEventListener('click',()=>go(i,true)));
 const followAnchor=()=>{const aliases={'#global-feature':3,'#local-feature':2,'#commerce-feature':0,'#accommodation-feature':1,'#logistics-feature':4};if(Object.hasOwn(aliases,location.hash))requestAnimationFrame(()=>go(aliases[location.hash]));};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});addEventListener('hashchange',followAnchor);reduced.addEventListener('change',schedule);select(0);schedule();followAnchor();
})();
