import http from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RPC } from './lib/rpc.js';
import { defaults, validateConfig } from './lib/activity.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT || 3210);
if (!Number.isInteger(port) || port<1024 || port>65535 || [8000,8188].includes(port)) throw Error('PORT 必须为 1024–65535，且不能使用 8000 / 8188');
const dataDir=process.env.RPC_DATA_DIR || path.join(root,'data');
let config=structuredClone(defaults), configWarning='';
try { config=validateConfig(JSON.parse(await readFile(path.join(dataDir,'config.json'),'utf8'))); } catch(e) { if (e.code!=='ENOENT') configWarning=`配置读取失败：${e.message}`; }
let status={enabled:false,connected:false,applied:false,error:configWarning,lastApplied:null,user:null};
let rpc, retry, activeConfig, queue=Promise.resolve();
const serial=fn=>{const next=queue.then(fn); queue=next.catch(()=>{}); return next;};
function scheduleRetry() { clearTimeout(retry); if(status.enabled) retry=setTimeout(()=>serial(connectAndApply).catch(()=>{}),5000); }
async function connectAndApply() {
  if(!status.enabled) return;
  try {
    if(!rpc?.ready) { rpc?.close(); rpc=new RPC(()=>{status.connected=false;status.applied=false;status.error='Discord 已断开，正在等待重连';scheduleRetry();}); await rpc.connect(activeConfig.clientId); }
    status.connected=true; status.user=rpc.user ? {username:rpc.user.username,global_name:rpc.user.global_name} : null;
    await rpc.setActivity(activeConfig.activity); status.applied=true;status.error='';status.lastApplied=new Date().toISOString();
  } catch(e) { status.connected=!!rpc?.ready;status.applied=false;status.error=e.message; if(!rpc?.ready) scheduleRetry(); }
}
async function save(input) { const next=validateConfig(input); await mkdir(dataDir,{recursive:true,mode:0o700}); await writeFile(path.join(dataDir,'config.json.tmp'),JSON.stringify(next,null,2),{mode:0o600}); await rename(path.join(dataDir,'config.json.tmp'),path.join(dataDir,'config.json')); config=next; }
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const hosts=[`127.0.0.1:${port}`,`localhost:${port}`];
  if(!hosts.includes(req.headers.host)) return reply(403,{error:'仅允许本机访问'});
  if(req.headers.origin && !hosts.map(h=>`http://${h}`).includes(req.headers.origin)) return reply(403,{error:'拒绝跨站请求'});
  if(req.headers['sec-fetch-site']==='cross-site') return reply(403,{error:'拒绝跨站请求'});
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: https: http:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const pathname=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
    if(req.method==='GET' && pathname==='/api/state') return reply(200,{config,status});
    if(req.method==='POST' && ['/api/save','/api/start','/api/apply','/api/stop','/api/validate'].includes(pathname)) {
      if(!req.headers['content-type']?.startsWith('application/json')) return reply(415,{error:'需要 application/json'});
      let body=''; for await(const c of req){body+=c;if(Buffer.byteLength(body)>65536) return reply(413,{error:'配置超过 64 KB'});}
      const input=JSON.parse(body || '{}');
      if(pathname==='/api/validate') return reply(200,{config:validateConfig(input)});
      await serial(async()=>{
        if(pathname==='/api/stop') { status.enabled=false;clearTimeout(retry);try{if(rpc?.ready) await rpc.setActivity(null);}finally{rpc?.close();status.connected=false;status.applied=false;status.error='';}return; }
        if(pathname==='/api/start' || pathname==='/api/apply') validateConfig(input,true);
        await save(input);
        if(pathname==='/api/start' || pathname==='/api/apply'){clearTimeout(retry);if(activeConfig?.clientId!==config.clientId){rpc?.close();status.connected=false;status.applied=false;}activeConfig=structuredClone(config);status.enabled=true;await connectAndApply();}
      });
      return reply(200,{config,status});
    }
    const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/glass.css':'glass.css','/i18n.js':'i18n.js','/edges.js':'edges.js','/optics.js':'optics.js','/locale-motion.js':'locale-motion.js','/refraction.js':'refraction.js','/theme.js':'theme.js'};
    if(req.method!=='GET' || !files[pathname]) return reply(404,{error:'Not found'});
    const file=files[pathname];res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-cache'});res.end(await readFile(path.join(root,'public',file)));
  } catch(e){reply(400,{error:e.message});}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已占用，请使用 PORT=3211 npm start`:e);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log(`Discord Custom RPC → http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{status.enabled=false;clearTimeout(retry);rpc?.close();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref();});
