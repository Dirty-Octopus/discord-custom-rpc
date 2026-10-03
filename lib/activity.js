export const defaults = { clientId: '', previewName: 'My Activity', activity: { type: 0, status_display_type: 0, details: 'Building something good', state: 'In the creative zone' } };
const object = x => x && typeof x === 'object' && !Array.isArray(x);
export function validateConfig(input, requireId = false) {
  if (!object(input) || !object(input.activity)) throw Error('配置必须包含 activity 对象');
  const clientId = String(input.clientId ?? '').trim();
  if ((requireId || clientId) && !/^\d{17,20}$/.test(clientId)) throw Error('Application ID 必须是 17–20 位数字');
  const a = input.activity, out = {};
  function str(source, target, key, max = 128, url = false) {
    if (source[key] === undefined || source[key] === '') return;
    if (typeof source[key] !== 'string' || [...source[key]].length > max) throw Error(`${key} 必须是最多 ${max} 字的文本`);
    if (url) { let u; try { u = new URL(source[key]); } catch { throw Error(`${key} 需要完整网址`); } if (!['http:', 'https:'].includes(u.protocol)) throw Error(`${key} 仅支持 HTTP / HTTPS`); }
    target[key] = source[key];
  }
  function integer(v, label, min, max) { if (!Number.isSafeInteger(v) || v < min || v > max) throw Error(`${label} 需要 ${min}–${max} 范围内的整数`); return v; }
  const allowed = ['type','name','url','status_display_type','details','details_url','state','state_url','timestamps','assets','party','secrets','instance','buttons'];
  for (const k of Object.keys(a)) if (!allowed.includes(k)) throw Error(`不支持的 RPC 写入字段：${k}`);
  out.type = integer(a.type ?? 0, 'type', 0, 5);
  if (out.type === 4) throw Error('Custom Status（type 4）不是可通过此 RPC 设置的 Rich Presence');
  if (a.status_display_type !== undefined) out.status_display_type = integer(a.status_display_type, 'status_display_type', 0, 2);
  for (const k of ['name','details','state']) str(a, out, k);
  for (const k of ['url','details_url','state_url']) str(a, out, k, 512, true);
  if (out.type === 1 && (!out.url || !['twitch.tv','www.twitch.tv','youtube.com','www.youtube.com'].includes(new URL(out.url).hostname) || new URL(out.url).protocol !== 'https:')) throw Error('直播类型需要 HTTPS Twitch 或 YouTube 网址');
  const shapes = { assets: ['large_image','large_text','large_url','small_image','small_text','small_url','invite_cover_image'], secrets: ['join','spectate','match'] };
  for (const [key, fields] of Object.entries(shapes)) if (a[key] !== undefined) {
    if (!object(a[key])) throw Error(`${key} 必须是对象`);
    out[key] = {};
    for (const k of Object.keys(a[key])) if (!fields.includes(k)) throw Error(`未知字段 ${key}.${k}`);
    for (const k of fields) str(a[key], out[key], k, k.endsWith('_text') || key === 'secrets' ? 128 : 512, k.endsWith('_url'));
    if (!Object.keys(out[key]).length) delete out[key];
  }
  if (a.timestamps !== undefined) {
    if (!object(a.timestamps) || Object.keys(a.timestamps).some(k => !['start','end'].includes(k))) throw Error('timestamps 仅包含 start / end');
    out.timestamps = {};
    for (const k of ['start','end']) if (a.timestamps[k] !== undefined) out.timestamps[k] = integer(a.timestamps[k], k, 0, 8640000000000000);
    if (out.timestamps.start !== undefined && out.timestamps.end !== undefined && out.timestamps.end <= out.timestamps.start) throw Error('结束时间必须晚于开始时间');
    if (!Object.keys(out.timestamps).length) delete out.timestamps;
  }
  if (a.party !== undefined) {
    if (!object(a.party) || Object.keys(a.party).some(k => !['id','size','privacy'].includes(k))) throw Error('party 仅支持 id / size / privacy');
    out.party = {}; str(a.party, out.party, 'id');
    if (a.party.size !== undefined) {
      const s = a.party.size;
      if (!Array.isArray(s) || s.length !== 2) throw Error('队伍人数必须包含当前人数和上限');
      out.party.size = [integer(s[0], '当前人数', 1, 100000), integer(s[1], '人数上限', 1, 100000)];
      if (s[0] > s[1]) throw Error('当前人数不能大于人数上限');
    }
    if (a.party.privacy !== undefined) out.party.privacy = integer(a.party.privacy, 'party.privacy', 0, 1);
    if (!Object.keys(out.party).length) delete out.party;
  }
  if (a.instance !== undefined) { if (typeof a.instance !== 'boolean') throw Error('instance 必须为布尔值'); out.instance = a.instance; }
  if (a.buttons !== undefined) {
    if (!Array.isArray(a.buttons) || a.buttons.length > 2) throw Error('最多支持两个按钮');
    out.buttons = a.buttons.map(b => { if (!object(b)) throw Error('按钮必须是对象'); const v = {}; str(b,v,'label',32); str(b,v,'url',512,true); if (!v.label || !v.url) throw Error('按钮文字和网址必须同时填写'); return v; });
    if (!out.buttons.length) delete out.buttons;
  }
  return { clientId, previewName: String(input.previewName || 'My Activity').slice(0,128), activity: out };
}
