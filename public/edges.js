export function initEdgeEffects(){
  const toggle=document.getElementById('effectsToggle');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let enabled=localStorage.getItem('presence-edges')!=='off', pending=false;
  // Leaf groups only: no nested transforms, duplicate DOM, or copied form state.
  for(const label of document.querySelectorAll('.grid>label'))for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){const span=document.createElement('span');node.replaceWith(span);span.append(node);}
  const targets=[...document.querySelectorAll('.brand,.connection>span,.connection>button,.intro h1,.intro p,.intro>button,.section-bar h2,.section-bar>span,.block-title,.grid>label>span,.grid>label>input,.grid>label>select,.grid>label>small,.block>.hint,.block>summary,.block>.row>button,.actions>span,.actions>button,.preview-heading,.profile h3,.profile .handle,.profile .activity-type,.activity-copy>*,.preview-note,.runtime h3,.runtime dt,.runtime dd,.runtime>button,.help summary,.help li,.help p,.help>a,footer>span')];
  targets.forEach(el=>el.classList.add('edge-target'));
  function update(){pending=false;const h=window.innerHeight,band=h*.05;
    const measurements=targets.map(el=>{const r=el.getBoundingClientRect();return {el,center:(r.top+r.bottom)/2,visible:r.bottom>0&&r.top<h};});
    for(const {el,center,visible}of measurements){
      const strength=enabled&&!reduced.matches&&visible?Math.max(0,Math.min(1,1-Math.min(center,h-center)/band)):0;
      const eased=strength*strength*(3-2*strength);
      el.style.setProperty('--edge-scale',String(1+eased*.65));el.style.setProperty('--edge-opacity',String(1-eased*.85));
    }
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}
  function state(){document.body.classList.toggle('edges-off',!enabled);toggle.setAttribute('aria-pressed',String(enabled));schedule();}
  toggle.addEventListener('click',()=>{enabled=!enabled;localStorage.setItem('presence-edges',enabled?'on':'off');state();});
  document.addEventListener('focusin',e=>{document.body.classList.toggle('editing',e.target.matches('input,textarea,select'));schedule();});
  document.addEventListener('focusout',()=>{document.body.classList.remove('editing');schedule();});
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('toggle',schedule,true);reduced.addEventListener('change',schedule);
  new ResizeObserver(schedule).observe(document.body);state();
}
