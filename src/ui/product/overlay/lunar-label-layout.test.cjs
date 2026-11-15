const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const layout = import(pathToFileURL(path.join(__dirname, 'lunar-label-layout.ts')).href);
const name = (label, diameterKm, lonDeg, featureType='Crater') => ({ name: label, diameterKm, lonDeg, latDeg: 0, featureType, key: label.toLowerCase() });
const view = { widthPx: 1280, heightPx: 720, pixelsPerDegree: 5 };
test('wide views show well-known names while smaller and satellite features wait for zoom', async () => {
  const { prepareLunarLabels, layoutLunarLabels } = await layout;
  const names = prepareLunarLabels([name('Tycho',85,0),name('Other basin',200,1),name('Small crater',30,2),name('Small A',5,3,'Satellite Feature')]);
  const project = p => ({ x: 240 + p.lonDeg * 220, y: 300 });
  assert.deepEqual(layoutLunarLabels(names,project,view).map(l=>l.feature.name),['Tycho']);
  const close = layoutLunarLabels(names,project,{...view,pixelsPerDegree:150});
  assert.equal(close.length,4);
  assert.ok(close.every(l=>l.fontSize>=10&&l.fontSize<=11));
  assert.deepEqual(close.map(l=>l.feature.lonDeg),[0,1,2,3]);
});
test('famous names win collisions and user pins reserve their screen space', async () => {
  const { prepareLunarLabels, layoutLunarLabels } = await layout;
  const names=prepareLunarLabels([name('Unfamiliar basin',300,1),name('Tycho',85,0)]);
  const project=()=>({x:350,y:280});
  assert.deepEqual(layoutLunarLabels(names,project,{...view,pixelsPerDegree:100}).map(l=>l.feature.name),['Tycho']);
  assert.equal(layoutLunarLabels(names,project,{...view,pixelsPerDegree:100},[{left:300,right:450,top:230,bottom:310}]).length,0);
});
test('labels stay inside the safe viewport, respect the density budget and never overlap', async () => {
  const { prepareLunarLabels, layoutLunarLabels, rectanglesOverlap } = await layout;
  const names=prepareLunarLabels(Array.from({length:1000},(_,i)=>name(`Basin ${i}`,300,i)));
  const project=p=>({x:180+(p.lonDeg%10)*110,y:135+Math.floor(p.lonDeg/10)*45});
  const labels=layoutLunarLabels(names,project,{...view,pixelsPerDegree:100});
  assert.ok(labels.length>10&&labels.length<=Math.floor(view.widthPx*view.heightPx/34000));
  for(let i=0;i<labels.length;i++){
    const box=labels[i].box;
    assert.ok(box.left>=92&&box.right<=view.widthPx-18&&box.top>=96&&box.bottom<=view.heightPx-96);
    assert.ok(labels.slice(i+1).every(l=>!rectanglesOverlap(box,l.box)));
  }
});
test('occluded and offscreen features are omitted rather than moved onto the visible Moon', async () => {
  const { prepareLunarLabels, layoutLunarLabels } = await layout;
  const names=prepareLunarLabels([name('Tycho',85,0),name('Copernicus',93,1),name('Plato',100,2)]);
  const labels=layoutLunarLabels(names,p=>p.lonDeg===0?null:p.lonDeg===1?{x:-50,y:300}:{x:350,y:280},view);
  assert.deepEqual(labels.map(l=>l.feature.name),['Plato']);
  assert.equal(labels[0].feature.lonDeg,2);
});
