// Top-right bar for every scene page: back to the home page, and a menu to jump straight to another place (list = sites.js).
import { SITES, currentSite } from './sites.js';

if (!new URLSearchParams(location.search).has('shot')) {
  const cur = currentSite();
  const bar = document.createElement('div');
  bar.id = 'navbar';
  bar.innerHTML = `
<style>
#navbar{position:fixed;right:14px;top:12px;z-index:7;display:flex;gap:8px;align-items:center;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#cfd8e6}
#navbar a,#navbar select{font:inherit;color:#cfd8e6;background:rgba(5,8,14,.72);border:1px solid #2a364f;border-radius:6px;padding:5px 11px;text-decoration:none;cursor:pointer;max-width:min(60vw,330px)}
#navbar a:hover,#navbar select:hover,#navbar a:focus-visible,#navbar select:focus-visible{border-color:#5b8cff;outline:none}
#navbar select option{background:#0b101a}
</style>
<a href="${new URL('./index.html', import.meta.url).href}" id="nav-home" title="Back to the home page">&#8962; Home</a>`;
  if (cur) {
    const sel = document.createElement('select');
    sel.title = 'Go to another place';
    sel.setAttribute('aria-label', 'Choose a place');
    for (const s of SITES) { const o = document.createElement('option'); o.value = s.href; o.textContent = s.name; o.selected = s === cur; sel.appendChild(o); }
    sel.onchange = () => { location.href = sel.value; };
    bar.appendChild(sel);
  }
  ['pointerdown', 'wheel', 'keydown'].forEach((ev) => bar.addEventListener(ev, (e) => e.stopPropagation()));
  document.body.appendChild(bar);
}
