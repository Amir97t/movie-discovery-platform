import { APPEARANCE_STORAGE_KEY } from "./appearance";

/**
 * Runs synchronously in <head> before first paint so the correct palette/mode
 * is on <html> before any content is painted (no wrong-theme flash).
 * Migrates legacy "gold" to canonical "blue" in localStorage and on <html>.
 * Keep behaviour identical to parseAppearance/resolveMode/applyAppearance.
 */
export const THEME_INIT_SCRIPT = `(function(){var el=document.documentElement;var s={};try{s=JSON.parse(localStorage.getItem(${JSON.stringify(
  APPEARANCE_STORAGE_KEY,
)})||'{}')||{}}catch(x){}var mig=s&&s.palette==='gold';var p=s.palette==='crimson'?'crimson':'blue';var m=(s.mode==='light'||s.mode==='dark'||s.mode==='system')?s.mode:'dark';var dark=false;try{dark=m==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark'}catch(x){dark=m==='dark'}var r=dark?'dark':'light';el.dataset.palette=p;el.dataset.mode=r;el.dataset.modePref=m;el.style.colorScheme=r;if(mig){try{localStorage.setItem(${JSON.stringify(
  APPEARANCE_STORAGE_KEY,
)},JSON.stringify({palette:'blue',mode:m}))}catch(x){}}})();`;
