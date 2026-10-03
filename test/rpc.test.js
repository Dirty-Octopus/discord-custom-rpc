import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {RPC,encode} from '../lib/rpc.js';
test('IPC handshake, fragmented frames, ping, ack, errors, clear and disconnect',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'rpc-test-')),location=path.join(dir,'sock');let peer,pong=false,cleared=false;
 const server=net.createServer(socket=>{peer=socket;let buffer=Buffer.alloc(0);socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=8){const op=buffer.readUInt32LE(),length=buffer.readUInt32LE(4);if(buffer.length<length+8)break;const data=JSON.parse(buffer.subarray(8,8+length));buffer=buffer.subarray(8+length);
 if(op===0){assert.equal(data.client_id,'123456789012345678');const ready=encode(1,{evt:'READY',data:{user:{username:'test'}}});socket.write(ready.subarray(0,5));setImmediate(()=>socket.write(Buffer.concat([ready.subarray(5),encode(3,{ping:true})])));}
 if(op===4)pong=true;
 if(data.cmd==='SET_ACTIVITY'){cleared ||= data.args.activity===null;socket.write(encode(1,{nonce:data.nonce,evt:data.args.activity?.state==='reject'?'ERROR':null,data:data.args.activity?.state==='reject'?{message:'rejected'}:data.args.activity}));}
 }});});
 await new Promise(r=>server.listen(location,r));let disconnected=false;const rpc=new RPC(()=>{disconnected=true;});
 try{await rpc.connect('123456789012345678',[location]);assert.equal(rpc.user.username,'test');assert.deepEqual(await rpc.setActivity({state:'hello'}),{state:'hello'});assert.equal(pong,true);await assert.rejects(rpc.setActivity({state:'reject'}),/rejected/);await rpc.setActivity(null);assert.equal(cleared,true);peer.destroy();await new Promise(r=>setTimeout(r,30));assert.equal(disconnected,true);assert.equal(rpc.ready,false);}finally{rpc.close();peer?.destroy();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
