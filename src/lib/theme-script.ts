import { APPEARANCE_STORAGE_KEY } from "./appearance";

/**
 * Runs synchronously in <head> before first paint so the correct mode
 * is on <html> before any content is painted (no wrong-theme flash).
 * Migrates legacy records containing palette keys to canonical mode-only JSON.
 * Keep behaviour identical to parseAppearance/resolveMode/applyAppearance.
 */
export const THEME_INIT_SCRIPT = `(function(){var el=document.documentElement;var s={};try{s=JSON.parse(localStorage.getItem(${JSON.stringify(
  APPEARANCE_STORAGE_KEY,
)})||'{}')||{}}catch(x){}var m=(s.mode==='light'||s.mode==='dark'||s.mode==='system')?s.mode:'dark';var dark=false;try{dark=m==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark'}catch(x){dark=m==='dark'}var r=dark?'dark':'light';el.dataset.mode=r;el.dataset.modePref=m;el.style.colorScheme=r;delete el.dataset.palette;if(s&&('palette' in s||s.mode!==m||Object.keys(s).length!==1)){try{localStorage.setItem(${JSON.stringify(
  APPEARANCE_STORAGE_KEY,
)},JSON.stringify({mode:m}))}catch(x){}}})();`;
