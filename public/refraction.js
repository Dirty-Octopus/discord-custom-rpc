// Geometric optics in CSS-pixel space. Trace through a rounded, beveled front
// surface and a flat rear interface using Snell's law. RGB IORs model dispersion.
export const IOR = [1.514, 1.522, 1.534];
export const DISPLACEMENT_SCALE = 100;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function normalize(v){const m=Math.hypot(...v);return v.map(x=>x/m);}
export function refract(incident,normal,eta){
 const dot=incident.reduce((sum,v,i)=>sum+v*normal[i],0);
 const k=1-eta*eta*(1-dot*dot);
 if(k<0)return null; // Total internal reflection; use neutral sampling fallback.
 return incident.map((v,i)=>eta*v-(eta*dot+Math.sqrt(k))*normal[i]);
}
export function surfaceHeight(x,y,width,height,radius,thickness){
 const r=Math.min(radius,width/2,height/2);
 const qx=Math.abs(x-width/2)-(width/2-r),qy=Math.abs(y-height/2)-(height/2-r);
 const signed=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;
 const u=clamp(-signed/Math.min(18,Math.max(5,r*.65)),0,1);
 return 2+thickness*u*u*(3-2*u);
}
export function surfaceSample(x,y,w,h,radius,thickness){
 const z=surfaceHeight(x,y,w,h,radius,thickness),e=.5;
 const dx=(surfaceHeight(x+e,y,w,h,radius,thickness)-surfaceHeight(x-e,y,w,h,radius,thickness))/(2*e);
 const dy=(surfaceHeight(x,y+e,w,h,radius,thickness)-surfaceHeight(x,y-e,w,h,radius,thickness))/(2*e);
 return {depth:z,normal:normalize([-dx,-dy,1])};
}
export function traceOffset(incident,normal,depth,ior,gap=18){
 const inside=refract(incident,normal,1/ior);
 if(!inside||inside[2]>=-.05)return [0,0];
 const outside=refract(inside,[0,0,1],ior);
 if(!outside||outside[2]>=-.05)return [0,0];
 return [0,1].map(i=>inside[i]/-inside[2]*depth+outside[i]/-outside[2]*gap-incident[i]/-incident[2]*(depth+gap));
}
export function buildMaps({width,height,radius=24,thickness=9,viewX=0,viewY=0,mapWidth=96,mapHeight=64}){
 const buffers=IOR.map(()=>new Uint8ClampedArray(mapWidth*mapHeight*4));
 for(let j=0;j<mapHeight;j++)for(let i=0;i<mapWidth;i++){
  const x=(i+.5)*width/mapWidth,y=(j+.5)*height/mapHeight;
  const {depth,normal}=surfaceSample(x,y,width,height,radius,thickness);
  const incident=normalize([(x-width/2-viewX*160)/1000,(y-height/2-viewY*160)/1000,-1]);
  const index=(j*mapWidth+i)*4;
  for(let channel=0;channel<3;channel++){
   const shift=traceOffset(incident,normal,depth,IOR[channel]);const b=buffers[channel];
   b[index]=Math.round((clamp(shift[0]/DISPLACEMENT_SCALE,-.5,.5)+.5)*255);
   b[index+1]=Math.round((clamp(shift[1]/DISPLACEMENT_SCALE,-.5,.5)+.5)*255);b[index+2]=128;b[index+3]=255;
  }
 }
 return buffers;
}
