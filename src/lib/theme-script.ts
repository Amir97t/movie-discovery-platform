import { APPEARANCE_STORAGE_KEY } from "./appearance";

/**
 * Runs synchronously in <head> before first paint so the correct mode
 * is on <html> before any content is painted (no wrong-theme flash).
 * Migrates legacy records containing palette keys to canonical mode-only JSON.
 * Keep behaviour identical to parseAppearance/resolveMode/applyAppearance.
 */
export const THEME_INIT_SCRIPT = `(function(){var el=document.documentElement;var raw=null;var s=null;try{raw=localStorage.getItem(${JSON.stringify(
  APPEARANCE_STORAGE_KEY,
)});if(raw!==null){s=JSON.parse(raw);}}catch(x){}var isObj=s!==null&&typeof s==='object'&&!Array.isArray(s);var m=(isObj&&(s.mode==='light'||s.mode==='dark'||s.mode==='system'))?s.mode:'dark';var dark=false;try{dark=m==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark';}catch(x){dark=m==='dark';}var r=dark?'dark':'light';el.dataset.mode=r;el.dataset.modePref=m;el.style.colorScheme=r;delete el.dataset.palette;var tc=r==='dark'?'#111318':'#F3EFEB';try{var metas=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<metas.length;i++){var med=metas[i].getAttribute('media');if(!med||m!=='system'){metas[i].setAttribute('content',tc);}else{if(med.indexOf('dark')!==-1)metas[i].setAttribute('content','#111318');if(med.indexOf('light')!==-1)metas[i].setAttribute('content','#F3EFEB');}}}catch(x){}if(raw!==null&&(!isObj||('palette' in s)||s.mode!==m||Object.keys(s).length!==1)){try{localStorage.setItem(${JSON.stringify(
  APPEARANCE_STORAGE_KEY,
)},JSON.stringify({mode:m}));}catch(x){}}})();`;
