import {t,translateUI} from './i18n.js';
const preference=matchMedia('(prefers-color-scheme: dark)');
let mode=localStorage.getItem('presence-theme')||'system';
if(!['system','light','dark'].includes(mode))mode='system';
function apply(){document.documentElement.dataset.theme=mode==='system'?(preference.matches?'dark':'light'):mode;document.documentElement.dataset.themeMode=mode;}
apply();
export function initTheme(){
 const button=document.getElementById('themeToggle');
 const labels={system:'主题 · 自动',light:'主题 · 浅色',dark:'主题 · 深色'};
 function label(){button.textContent=t(labels[mode]);button.setAttribute('aria-label',t('切换浅色、深色或跟随系统'));translateUI();}
 button.onclick=()=>{mode={system:'light',light:'dark',dark:'system'}[mode];localStorage.setItem('presence-theme',mode);apply();label();};
 preference.addEventListener('change',()=>{if(mode==='system')apply();});label();
}
