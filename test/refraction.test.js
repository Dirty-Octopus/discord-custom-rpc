import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,refract,traceOffset,surfaceSample,buildMaps,IOR} from '../public/refraction.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`);
test('Snell law: normal incidence unchanged, angled incidence matches analytic sine',()=>{
 assert.deepEqual(refract([0,0,-1],[0,0,1],1/1.5),[0,0,-1]);
 const angle=Math.PI/6,t=refract([Math.sin(angle),0,-Math.cos(angle)],[0,0,1],1/1.5);
 near(t[0],Math.sin(angle)/1.5);near(Math.hypot(...t),1);
 assert.equal(refract([Math.sin(Math.PI/3),0,-.5],[0,0,1],1.5),null);
});
test('no refractive contrast gives no displacement through either interface',()=>{
 const shift=traceOffset(normalize([.12,.08,-1]),normalize([.15,.08,1]),10,1);
 shift.forEach(x=>near(x,0));
});
test('flat normal-incidence center is neutral and opposite edges have mirrored normals',()=>{
 const center=surfaceSample(100,50,200,100,20,9);assert.deepEqual(center.normal,[-0,-0,1]);
 assert.deepEqual(traceOffset([0,0,-1],center.normal,center.depth,IOR[1]),[0,0]);
 const left=surfaceSample(5,50,200,100,20,9),right=surfaceSample(195,50,200,100,20,9);near(left.normal[0],-right.normal[0]);
});
test('view and geometry change maps; RGB channels have physical dispersion',()=>{
 const params={width:200,height:100,mapWidth:64,mapHeight:32};
 const a=buildMaps(params),b=buildMaps({...params,viewX:.8}),c=buildMaps({...params,width:400});
 assert.notDeepEqual(a[1],b[1]);assert.notDeepEqual(a[1],c[1]);assert.notDeepEqual(a[0],a[2]);
 for(const buffer of a){assert.equal(buffer.length,64*32*4);for(let i=3;i<buffer.length;i+=4)assert.equal(buffer[i],255);}
});
