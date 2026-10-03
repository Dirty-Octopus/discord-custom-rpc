import {initTheme} from './theme.js';
import {initOptics} from './optics.js';
import {animateLocale} from './locale-motion.js';
import {t, message, language, translateUI, toggleLanguage} from './i18n.js';
import {initEdgeEffects} from './edges.js';
const $=id=>document.getElementById(id);
let config, currentStatus={}, dirty=false, busy=false, jsonDirty=false;
const fields=[];
function field(container,key,label,{type='text',placeholder='',help='',options,wide=false,max}={}){
  const wrap=document.createElement('label');if(wide)wrap.className='wide';wrap.append(document.createTextNode(label));
  const el=document.createElement(options?'select':'input');el.id=key;el.dataset.key=key;
  if(options)for(const [value,text]of options){const o=document.createElement('option');o.value=value;o.textContent=text;el.append(o);}
  else{el.type=type;if(type==='datetime-local')el.step='1';el.placeholder=placeholder;if(max)el.maxLength=max;if(type==='number'){el.step='1';el.min='0';}}
  wrap.append(el);if(help){const s=document.createElement('small');s.textContent=help;wrap.append(s);}$(container).append(wrap);fields.push({key,el,type,options});
}
field('basic','type','活动类型',{options:[[0,'Playing · 正在玩'],[2,'Listening · 正在听'],[3,'Watching · 正在看'],[5,'Competing · 正在竞赛'],[1,'Streaming · 直播（客户端可能忽略）']]});
field('basic','status_display_type','成员列表显示',{options:[[0,'应用名称'],[1,'State · 状态'],[2,'Details · 详情']]});
field('basic','details','Details · 第一行',{max:128,placeholder:'你正在做什么？'});
field('basic','details_url','详情点击链接',{type:'url',placeholder:'https://…'});
field('basic','state','State · 第二行',{max:128,placeholder:'当前状态或进度'});
field('basic','state_url','状态点击链接',{type:'url',placeholder:'https://…'});
field('basic','url','直播地址',{type:'url',wide:true,placeholder:'https://twitch.tv/… 或 https://youtube.com/…',help:'仅直播类型使用；普通网页链接请添加为按钮。'});
for(const [size,title]of [['large','大图'],['small','小图']]){
field('assets',`assets.${size}_image`,`${title} · 图片 URL / 素材 Key`,{placeholder:'https://… / asset_key',max:512});
field('assets',`assets.${size}_text`,`${title} · 悬停文字`,{placeholder:'鼠标悬停时显示',max:128});
field('assets',`assets.${size}_url`,`${title} · 点击链接`,{type:'url',wide:true,placeholder:'https://…'});
}
field('time','timestamps.start','开始时间',{type:'datetime-local'});field('time','timestamps.end','结束时间',{type:'datetime-local',help:'仅开始时间：已用时；结束时间：倒计时。'});
for(let i=0;i<2;i++){field('buttons',`buttons.${i}.label`,`按钮 ${i+1} · 文字`,{max:32,placeholder:'例如：我的主页'});field('buttons',`buttons.${i}.url`,`按钮 ${i+1} · 网址`,{type:'url',placeholder:'https://…'});}
field('advanced','party.id','Party ID',{max:128});field('advanced','party.privacy','队伍隐私',{options:[['','默认'],[0,'私密'],[1,'公开']]});
field('advanced','party.size.0','当前人数',{type:'number'});field('advanced','party.size.1','人数上限',{type:'number'});
for(const k of ['join','spectate','match'])field('advanced',`secrets.${k}`,`${k} Secret`,{max:128});
field('advanced','instance','独立游戏会话',{options:[['','默认'],['true','是'],['false','否']]});
field('advanced','name','名称覆盖（实验性）',{max:128,help:'可能被客户端忽略；建议通过 Developer Portal 修改应用名称。'});
field('advanced','assets.invite_cover_image','邀请封面',{max:512,placeholder:'图片 URL / 素材 Key',help:'用于邀请卡片，非个人资料背景。'});
const get=(obj,key)=>key.split('.').reduce((a,k)=>a?.[k],obj);
function set(obj,key,value){const parts=key.split('.');let cur=obj;parts.forEach((k,i)=>{if(i===parts.length-1)cur[k]=value;else{cur[k]??=/^\d+$/.test(parts[i+1])?[]:{};cur=cur[k];}});}
function localDate(ms){const d=new Date(ms);if(!Number.isFinite(d.getTime()))return '';return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19);}
function collect(){const activity={};for(const f of fields){let v=f.el.value;if(v==='')continue;if(f.type==='datetime-local')v=new Date(v).getTime();else if(f.type==='number'||['type','status_display_type','party.privacy'].includes(f.key))v=Number(v);else if(f.key==='instance')v=v==='true';set(activity,f.key,v);}if(activity.buttons)activity.buttons=activity.buttons.filter(Boolean);return{clientId:$('clientId').value.trim(),previewName:$('previewName').value,activity};}
function populate(c){config=c;$('clientId').value=c.clientId||'';$('previewName').value=c.previewName||'';for(const f of fields){const v=get(c.activity,f.key);f.el.value=v===undefined?'':f.type==='datetime-local'?localDate(v):String(v);}jsonDirty=false;dirty=false;render();}
const translateMessage=message;let lastNotice='',lastNoticeError=false;
function notice(message,error=false){lastNotice=message;lastNoticeError=error;$('notice').hidden=!message;$('notice').textContent=translateMessage(message);$('notice').className=error?'error':'';}
function safeUrl(v){try{const u=new URL(v);return['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function link(el,text,url){el.textContent=text||'';el.hidden=!text;el.removeAttribute('href');if(safeUrl(url)){el.href=safeUrl(url);el.target='_blank';el.rel='noreferrer';}}
function image(el,value,placeholder){const url=safeUrl(value);if(el.dataset.source===String(value||''))return;el.dataset.source=value||'';el.hidden=true;if(placeholder)placeholder.hidden=false;if(url){el.onload=()=>{el.hidden=false;if(placeholder)placeholder.hidden=true;};el.onerror=()=>{el.hidden=true;if(placeholder)placeholder.hidden=false;};el.src=url;}else el.removeAttribute('src');}
const typeNames={0:'正在玩游戏',1:'正在直播',2:'正在听',3:'正在看',5:'正在竞赛'};
function timerText(a){const now=Date.now(),t=a.timestamps||{};const end=t.end,point=end??t.start;if(point===undefined)return '';const seconds=Math.max(0,Math.floor((end?point-now:now-point)/1000));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;const time=[...(h?[String(h)]:[]),String(m).padStart(2,'0'),String(s).padStart(2,'0')].join(':');return language==='en'?(end?`${time} remaining`:`${time} elapsed`):(end?`剩余 ${time}`:`已用时 ${time}`);}
function updateTimer(a){$('pTime').textContent=timerText(a);const t=a.timestamps||{};const show=[2,3].includes(a.type)&&Number.isFinite(t.start)&&Number.isFinite(t.end)&&t.end>t.start;$('pProgress').hidden=!show;if(show)$('pProgress').value=Math.max(0,Math.min(1,(Date.now()-t.start)/(t.end-t.start)));}
function render(){const c=collect(),a=c.activity,name=a.name||c.previewName||'My Activity';$('dirty').textContent=dirty?'未保存的修改':'已保存';$('pName').textContent=name;$('previewType').textContent=t(typeNames[a.type]||'正在玩游戏');link($('pDetails'),a.details,a.details_url);link($('pState'),a.state,a.state_url);$('pParty').textContent=a.party?.size?`${language==='en'?'Party':'队伍'} ${a.party.size[0]??'—'} / ${a.party.size[1]??'—'}`:'';updateTimer(a);$('pMember').textContent=`${t(typeNames[a.type]||'')} ${a.status_display_type===1?a.state||name:a.status_display_type===2?a.details||name:name}`;
image($('largeImage'),a.assets?.large_image,$('artPlaceholder'));$('art').title=a.assets?.large_text||'';$('artPlaceholder').textContent=a.assets?.large_image?'▧':'P';$('smallArt').hidden=!a.assets?.small_image;image($('smallImage'),a.assets?.small_image,$('smallArt').querySelector('span'));$('smallArt').title=a.assets?.small_text||'';
$('pButtons').replaceChildren();for(const b of a.buttons||[]){const el=document.createElement('a');link(el,b.label||t('未命名按钮'),b.url);$('pButtons').append(el);}if(!jsonDirty)$('json').value=JSON.stringify(c,null,2);translateUI();}
function updateStatus(s){currentStatus=s;$('led').className=`led ${s.connected?'online':''}`;$('connection').textContent=s.connected?'Discord 已连接':s.enabled?'等待 Discord 连接':'本地服务已就绪';$('publishState').textContent=s.applied?'Discord 已确认更新':s.enabled?'等待发布':'未启用';$('lastApplied').textContent=s.lastApplied?new Date(s.lastApplied).toLocaleTimeString():'—';$('username').textContent=s.user?.global_name||s.user?.username||'Your profile';$('apply').textContent=s.enabled?'应用到 Discord ↗':'启用 Presence ↗';$('stop').disabled=busy||!s.enabled;translateUI();}
async function request(action,data){const r=await fetch(`/api/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});const result=await r.json();if(!r.ok)throw Error(result.error);return result;}
async function action(name){if(busy)return;if(name!=='stop'&&!$('form').reportValidity())return;busy=true;for(const id of ['save','apply','stop'])$(id).disabled=true;notice(name==='stop'?'正在清除状态…':'正在处理…');try{const snapshot=collect();const result=await request(name,snapshot);updateStatus(result.status);if(name!=='stop'){config=result.config;dirty=JSON.stringify(collect())!==JSON.stringify(snapshot);render();}notice(result.status.error|| (name==='save'?'草稿已保存在本机。':name==='stop'?'已停用并断开 RPC 连接。':'Discord 已确认更新。'),!!result.status.error);}catch(e){notice(e.message,true);}finally{busy=false;$('save').disabled=false;$('apply').disabled=false;$('stop').disabled=!currentStatus.enabled;}}
$('form').addEventListener('submit',e=>e.preventDefault());$('form').addEventListener('input',e=>{if(e.target.id==='json'){jsonDirty=true;return;}if(e.target.id==='import')return;dirty=true;render();});
$('save').onclick=()=>action('save');$('apply').onclick=()=>action(currentStatus.enabled?'apply':'start');$('stop').onclick=()=>action('stop');
$('now').onclick=()=>{$('timestamps.start').value=localDate(Date.now());dirty=true;render();};$('clearTime').onclick=()=>{$('timestamps.start').value='';$('timestamps.end').value='';dirty=true;render();};
$('refreshJson').onclick=()=>{jsonDirty=false;render();};
async function load(text){let c=JSON.parse(text);if(!c||typeof c.activity!=='object'||Array.isArray(c.activity)||!c.activity)throw Error('需要包含 activity 对象的配置');const allowed=new Set(fields.map(f=>f.key.split('.')[0]));for(const k of Object.keys(c.activity))if(!allowed.has(k))throw Error(`不支持的字段：${k}`);c=(await request('validate',c)).config;populate(c);dirty=true;render();notice('配置已载入草稿，点击应用后发布。');}
$('loadJson').onclick=async()=>{try{await load($('json').value);}catch(e){notice(e.message,true);}};
$('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>65536)throw Error('文件不能超过 64 KB');await load(await f.text());}catch(e){notice(e.message,true);}e.target.value='';};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(collect(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='discord-presence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('beforeunload',e=>{if(dirty||jsonDirty){e.preventDefault();e.returnValue='';}});
try{const r=await fetch('/api/state');if(!r.ok)throw Error('服务响应异常');const s=await r.json();populate(s.config);updateStatus(s.status);if(s.status.error)notice(s.status.error,true);}catch(e){notice(`本地服务连接失败：${e.message}`,true);}
setInterval(()=>{updateTimer(collect().activity);},1000);
let previousError='';setInterval(async()=>{if(busy)return;try{const r=await fetch('/api/state');if(!r.ok)throw Error('服务响应异常');const s=await r.json();updateStatus(s.status);if(s.status.error!==previousError){previousError=s.status.error;if(s.status.error)notice(s.status.error,true);else if(s.status.applied)notice('Discord 已确认更新。');}}catch{$('connection').textContent='本地服务已离线';$('led').className='led';translateUI();}},3000);

$('languageToggle').onclick=()=>animateLocale(()=>{toggleLanguage();render();updateStatus(currentStatus);notice(lastNotice,lastNoticeError);});
translateUI();initTheme();initOptics();initEdgeEffects();
