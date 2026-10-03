import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
test('HTTP validation, persistence, origin protection, and port exclusions',async()=>{
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const dir=await mkdtemp(path.join(os.tmpdir(),'presence-http-'));let child;
 const start=async()=>{child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),RPC_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),5000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',()=>{clearTimeout(timer);reject(Error('server exited'));});});};
 const stop=async()=>{child.kill();await new Promise(r=>child.once('exit',r));};
 const post=(route,body,headers={})=>fetch(`http://127.0.0.1:${port}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{await start();assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);assert.equal((await post('save',{activity:{}},{Origin:'https://evil.example'})).status,403);assert.equal((await post('start',{clientId:'',activity:{}})).status,400);assert.equal((await post('validate',{activity:{buttons:[{label:'missing URL'}]}})).status,400);const cfg={clientId:'',previewName:'Persisted',activity:{type:2,details:'Track'}};assert.equal((await post('save',cfg)).status,200);await stop();await start();const state=await(await fetch(`http://127.0.0.1:${port}/api/state`)).json();assert.deepEqual(state.config,cfg);assert.equal(state.status.enabled,false);await stop();for(const blocked of [8000,8188]){const proc=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(blocked)},stdio:'ignore'});const code=await new Promise(r=>proc.on('exit',r));assert.notEqual(code,0);}}
 finally{if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}await rm(dir,{recursive:true,force:true});}
});
