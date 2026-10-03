import {isLocalizedText} from './i18n.js';
// Glyph positions come from DOM Ranges, so proportional fonts, CJK and wrapped
// lines share the same baseline. Temporary paint layers never become form state.
const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
let cleanup=()=>{};
export function animateLocale(change){
 cleanup();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){change();return;}
 const wrappers=new Set();
 function snapshot(){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];let node;
  while((node=walker.nextNode())){if((!isLocalizedText(node.textContent)&&node.parentElement.id!=='languageToggle')||node.parentElement.closest('script,style,svg,option,textarea,#pName,#pDetails,#pState,#pButtons,#pMember,#pParty,#pTime,#username,.locale-film'))continue;
   const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();if(r.width&&r.height&&r.bottom>0&&r.top<innerHeight)nodes.push(node);
  }
  const result=[];
  for(const n of nodes){let wrap=n.parentElement;if(!wrap.classList.contains('locale-ink')){wrap=document.createElement('span');wrap.className='locale-ink';n.replaceWith(wrap);wrap.append(n);}wrappers.add(wrap);
   const style=getComputedStyle(wrap);let index=0;
   for(const part of segmenter.segment(n.textContent)){const end=index+part.segment.length;if(part.segment.trim()){const r=document.createRange();r.setStart(n,index);r.setEnd(n,end);const box=r.getBoundingClientRect();if(box.bottom>0&&box.top<innerHeight)result.push({text:part.segment,x:box.x,y:box.y,width:box.width,height:box.height,font:style.font,color:style.color,spacing:style.letterSpacing,index:result.length});}index=end;}
  }
  return result;
 }
 const before=snapshot();change();const after=snapshot();
 const layer=document.createElement('div');layer.className='locale-film';layer.setAttribute('aria-hidden','true');document.body.append(layer);
 for(const w of wrappers)w.classList.add('locale-hidden');
 let complete=false;const animations=[];
 const finish=()=>{if(complete)return;complete=true;for(const a of animations)a.cancel();layer.remove();for(const w of wrappers){if(w.isConnected)w.replaceWith(...w.childNodes);}window.removeEventListener('scroll',finish);window.removeEventListener('resize',finish);};
 cleanup=finish;
 for(const [list,incoming]of [[before,false],[after,true]])for(const glyph of list){
  const clip=document.createElement('span');clip.className='locale-slot';Object.assign(clip.style,{left:`${glyph.x-2}px`,top:`${glyph.y-3}px`,width:`${glyph.width+4}px`,height:`${glyph.height+6}px`});
  const ink=document.createElement('span');ink.textContent=glyph.text;Object.assign(ink.style,{font:glyph.font,color:glyph.color,letterSpacing:glyph.spacing,lineHeight:`${glyph.height}px`});clip.append(ink);layer.append(clip);
  const frames=incoming?[{transform:'translateY(85%) scaleY(1.24)',filter:'blur(7px)',opacity:0},{transform:'translateY(-3%) scaleY(.98)',filter:'blur(.3px)',opacity:.9,offset:.8},{transform:'translateY(0) scaleY(1)',filter:'blur(0)',opacity:1}]:[{transform:'translateY(0)',filter:'blur(0)',opacity:1},{transform:'translateY(-90%) scaleY(1.2)',filter:'blur(6px)',opacity:0}];
  animations.push(ink.animate(frames,{duration:incoming?560:370,delay:Math.min(glyph.index%45*4,140),easing:incoming?'cubic-bezier(.16,1,.3,1)':'cubic-bezier(.5,0,.85,.45)',fill:'both'}));
 }
 window.addEventListener('scroll',finish,{once:true,passive:true});window.addEventListener('resize',finish,{once:true});
 Promise.allSettled(animations.map(a=>a.finished)).then(finish);
}
