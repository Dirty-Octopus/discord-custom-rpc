import {buildMaps,DISPLACEMENT_SCALE} from './refraction.js';
// The map describes the lens geometry, not a snapshot of the background.
// The compositor refracts the live scrolling backdrop on every paint; only
// resizing changes the geometry. No mouse tracking or simulated light follows.
export function initOptics(){
 const NS='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(NS,'svg');svg.classList.add('optics-defs');svg.setAttribute('aria-hidden','true');
 const defs=document.createElementNS(NS,'defs');svg.append(defs);document.body.prepend(svg);
 const profile=document.querySelector('.profile'),shell=document.createElement('div');shell.className='preview-glass';profile.before(shell);shell.append(profile);
 const surfaces=[...document.querySelectorAll('header,.actions,.runtime,.help,.preview-glass,button')];
 const opaque=matchMedia('(prefers-reduced-transparency: reduce)');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 let scheduled=0,lastFrame=0,revision=0;
 const records=surfaces.map((el,index)=>{
  const id=`live-glass-${index}`,filter=document.createElementNS(NS,'filter');filter.id=id;
  filter.setAttribute('color-interpolation-filters','sRGB');filter.setAttribute('filterUnits','userSpaceOnUse');filter.setAttribute('primitiveUnits','userSpaceOnUse');
  filter.innerHTML='<feGaussianBlur in="SourceGraphic" stdDeviation="0.65" result="scattered"/>'+['r','g','b'].map((c,i)=>`<feImage result="map${c}" preserveAspectRatio="none"/><feDisplacementMap in="scattered" in2="map${c}" scale="${DISPLACEMENT_SCALE}" xChannelSelector="R" yChannelSelector="G" result="d${c}"/><feColorMatrix in="d${c}" type="matrix" values="${[0,1,2].map(row=>[0,1,2,3,4].map(col=>row===i&&col===i?1:0).join(' ')).join(' ')} 0 0 0 1 0" result="${c}"/>`).join('')+'<feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/><feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="rgb"/><feComposite in="rgb" in2="SourceGraphic" operator="in"/>';
  defs.append(filter);el.classList.add('live-glass');el.style.setProperty('--refraction-filter',`url(#${id})`);
  return {el,filter,images:[...filter.querySelectorAll('feImage')],dirty:true,visible:false,key:''};
 });
 function schedule(){if(!scheduled&&!document.hidden)scheduled=requestAnimationFrame(frame);}
 function invalidate(){for(const r of records)r.dirty=true;schedule();}
 function frame(time){scheduled=0;if(time-lastFrame<33){schedule();return;}lastFrame=time;
  if(opaque.matches)return;
  const start=performance.now();
  for(const r of records){if(!r.dirty||!r.visible)continue;
   const box=r.el.getBoundingClientRect();if(!box.width||!box.height){r.dirty=false;continue;}
   const width=r.el.offsetWidth,height=r.el.offsetHeight;
   const key=[width,height,devicePixelRatio].join('/');
   r.dirty=false;if(key===r.key)continue;r.key=key;
   const ratio=Math.min(1,480/Math.max(width,height),Math.sqrt(64000/(width*height)));
   const mw=Math.max(16,Math.round(width*ratio)),mh=Math.max(16,Math.round(height*ratio));
   const radius=parseFloat(getComputedStyle(r.el).borderTopLeftRadius)||24;
   const maps=buildMaps({width,height,radius,thickness:r.el.matches('.actions')?10:r.el.matches('button')?7:12,viewX:0,viewY:0,mapWidth:mw,mapHeight:mh});
   canvas.width=mw;canvas.height=mh;
   r.filter.setAttribute('x','0');r.filter.setAttribute('y','0');r.filter.setAttribute('width',String(width));r.filter.setAttribute('height',String(height));
   r.images.forEach((img,i)=>{ctx.putImageData(new ImageData(maps[i],mw,mh),0,0);img.setAttribute('href',canvas.toDataURL('image/png'));img.setAttribute('x','0');img.setAttribute('y','0');img.setAttribute('width',String(width));img.setAttribute('height',String(height));});
   r.el.dataset.opticsRevision=String(++revision);
   if(performance.now()-start>10)break;
  }
  if(records.some(r=>r.visible&&r.dirty))schedule();
 }
 const observer=new IntersectionObserver(entries=>{for(const e of entries){const r=records.find(r=>r.el===e.target);r.visible=e.isIntersecting;if(r.visible)r.dirty=true;}schedule();});
 const resize=new ResizeObserver(invalidate);records.forEach(r=>{observer.observe(r.el);resize.observe(r.el);});
 window.addEventListener('scroll',invalidate,{passive:true});window.addEventListener('resize',invalidate,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(scheduled);scheduled=0;}else invalidate();});
 opaque.addEventListener('change',invalidate);invalidate();
}
