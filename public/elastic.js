// Independent scale property composes with the viewport-edge transform.
export function initElastic(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const active=new Map();
 function spring(el,target){if(reduced.matches)return;
  let state=active.get(el);if(!state){state={x:1,v:0,target,raf:0,last:performance.now()};active.set(el,state);}state.target=target;
  if(state.raf)return;
  const step=time=>{const dt=Math.min(.025,(time-state.last)/1000);state.last=time;
   state.v+=(420*(state.target-state.x)-25*state.v)*dt;state.x+=state.v*dt;
   el.style.scale=String(state.x);
   if(Math.abs(state.target-state.x)<.0002&&Math.abs(state.v)<.002){el.style.scale=state.target===1?'':String(state.target);state.raf=0;if(state.target===1)active.delete(el);return;}
   state.raf=requestAnimationFrame(step);
  };state.last=performance.now();state.raf=requestAnimationFrame(step);
 }
 const target=e=>e.target.closest('button:not(:disabled),summary,.file-button');
 let pressed=null;
 document.addEventListener('pointerdown',e=>{if(e.button!==0)return;pressed=target(e);if(pressed)spring(pressed,.965);});
 const release=()=>{if(pressed)spring(pressed,1);pressed=null;};
 document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);window.addEventListener('blur',release);
 document.addEventListener('keydown',e=>{if(!e.repeat&&['Enter',' '].includes(e.key)){const el=target(e);if(el)spring(el,.965);}});
 document.addEventListener('keyup',e=>{if(['Enter',' '].includes(e.key)){const el=target(e);if(el)spring(el,1);}});
 reduced.addEventListener('change',()=>{if(reduced.matches){for(const [el,s]of active){cancelAnimationFrame(s.raf);el.style.scale='';}active.clear();}});
}
