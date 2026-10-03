import net from 'node:net';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export function encode(op, data) { const body = Buffer.from(JSON.stringify(data)); const header = Buffer.alloc(8); header.writeUInt32LE(op); header.writeUInt32LE(body.length,4); return Buffer.concat([header,body]); }
export function socketPaths() {
  if (process.platform === 'win32') return Array.from({length:10},(_,i)=>`\\\\?\\pipe\\discord-ipc-${i}`);
  const roots = [...new Set([process.env.XDG_RUNTIME_DIR,process.env.TMPDIR,process.env.TMP,process.env.TEMP,'/tmp'].filter(Boolean))];
  return roots.flatMap(root => Array.from({length:10},(_,i)=>path.join(root,`discord-ipc-${i}`)));
}
export class RPC {
  constructor(onDisconnect = ()=>{}) { this.pending = new Map(); this.onDisconnect = onDisconnect; this.ready = false; }
  async connect(clientId, paths = socketPaths()) {
    for (const location of paths) {
      try { await this.open(location, clientId); return; } catch (e) { this.close(); if (e.message !== 'socket unavailable') throw e; }
    }
    throw Error('未找到 Discord 桌面客户端。请打开并登录 Discord，服务会自动重试。');
  }
  open(location, clientId) {
    return new Promise((resolve,reject)=> {
      const socket = net.createConnection(location); this.socket = socket; let buffer = Buffer.alloc(0), settled = false, connected = false;
      const fail = e => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } socket.destroy(); };
      const timer = setTimeout(()=>fail(Error(connected ? 'Discord 握手超时，请检查 Application ID' : 'socket unavailable')),4000);
      socket.on('connect',()=> { connected = true; socket.write(encode(0,{v:1,client_id:clientId})); });
      socket.on('error',e=>fail(Error(connected ? e.message : 'socket unavailable')));
      socket.on('close',()=> { clearTimeout(timer); if (!settled) { settled=true; reject(Error(connected ? 'Discord 关闭连接' : 'socket unavailable')); } if (this.socket===socket) { const wasReady=this.ready; this.ready=false; for (const p of this.pending.values()) p.reject(Error('Discord 连接已断开')); this.pending.clear(); if (wasReady) this.onDisconnect(); } });
      socket.on('data',chunk=> { buffer=Buffer.concat([buffer,chunk]); try {
        while (buffer.length>=8) {
          const op=buffer.readUInt32LE(0), length=buffer.readUInt32LE(4);
          if (length>1024*1024) throw Error('Discord 返回的数据包过大');
          if (buffer.length<8+length) break;
          const data=JSON.parse(buffer.subarray(8,8+length).toString()); buffer=buffer.subarray(8+length);
          if (op===3) { socket.write(encode(4,data)); continue; }
          if (op===2) throw Error(data.message || 'Discord 关闭了 RPC');
          if (data.evt==='READY' && !settled) { settled=true; clearTimeout(timer); this.ready=true; this.user=data.data?.user; resolve(); }
          else if (data.nonce && this.pending.has(data.nonce)) { const p=this.pending.get(data.nonce); this.pending.delete(data.nonce); data.evt==='ERROR' ? p.reject(Error(data.data?.message || 'Discord 拒绝了更新')) : p.resolve(data.data); }
          else if (data.evt==='ERROR' && !settled) fail(Error(data.data?.message || 'Discord 握手失败'));
        }
      } catch(e) { fail(e); } });
    });
  }
  setActivity(activity) {
    if (!this.ready) return Promise.reject(Error('Discord 尚未连接'));
    const nonce=randomUUID();
    return new Promise((resolve,reject)=> {
      const timer=setTimeout(()=>{ this.pending.delete(nonce); reject(Error('Discord 更新超时')); },8000);
      this.pending.set(nonce,{resolve:x=>{clearTimeout(timer);resolve(x);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.socket.write(encode(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity},nonce}));
    });
  }
  close() { this.ready=false; this.socket?.destroy(); for (const p of this.pending.values()) p.reject(Error('连接已关闭')); this.pending.clear(); }
}
