(() => {
 const scene=document.querySelector('#lex-scene'),title=document.querySelector('#lex-title'),orb=document.querySelector('.lex-orb-frame');if(!scene||!orb)return;
 title.removeAttribute('data-reveal');title.innerHTML='<span class="lex-letter">L</span><span class="lex-letter">e</span><span class="lex-letter">x</span><span class="lex-letter lex-period">.</span>';
 orb.insertAdjacentHTML('beforeend','<span class="voice-ring voice-ring--one" aria-hidden="true"></span><span class="voice-ring voice-ring--two" aria-hidden="true"></span><span class="voice-halo" aria-hidden="true"></span>');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let last=scrollY,energy=0,frame=0;
 function render(){frame=0;const rect=scene.getBoundingClientRect();const reveal=reduced.matches?1:Math.min(1,Math.max(0,(innerHeight-rect.top)/(innerHeight*.65)));scene.style.setProperty('--lex-reveal',reveal);energy*=.88;scene.style.setProperty('--voice-energy',reduced.matches?0:energy);if(energy>.005)frame=requestAnimationFrame(render);}
 function update(){energy=Math.min(1,energy+Math.abs(scrollY-last)/160);last=scrollY;if(!frame)frame=requestAnimationFrame(render);}
 addEventListener('scroll',update,{passive:true});addEventListener('resize',update);reduced.addEventListener('change',update);render();
 const nav=document.querySelector('.feature-navigation');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('is-in-view')}),{threshold:.15});if(nav)observer.observe(nav);
})();
