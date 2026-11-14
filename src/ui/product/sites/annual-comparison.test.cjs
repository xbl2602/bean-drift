const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const adapter = import(pathToFileURL(path.join(__dirname, 'annual-comparison.ts')).href);
const fixture = () => ({ position:{latDeg:0,lonDeg:0}, timeUtc:'2026-11-15T00:00:00Z', assumptions:{minEarthElevationDeg:null}, provenance:{yearStats:{status:'ok',source:'test'}}, yearStats:{periodStartUtc:'2032-01-01T00:00:00Z',periodEndUtc:'2033-01-01T00:00:00Z',bothVisibleFraction:0.25,sun:{visibleFraction:0.5,longestOutageH:300,visibleWindows:[]},earth:{visibleFraction:0.75,longestOutageH:100,visibleWindows:[]}} });
test('annual comparison uses actual API coverage including leap years, not map date', async()=>{const {annualComparison}=await adapter;const input=fixture();const result=annualComparison(input);assert.equal(result.durationH,8784);assert.equal(result.startUtc,input.yearStats.periodStartUtc);assert.equal(result.both.visibleFraction,0.25);assert.equal(result.sun.longestOutageH,300);assert.equal(result.both.longestOutageH,undefined);});
test('unavailable annual values are never shown as zero', async()=>{const {annualComparison}=await adapter;for(const change of [d=>d.yearStats.sun.visibleFraction=null,d=>d.yearStats.earth.longestOutageH=null,d=>d.yearStats.sun.visibleWindows=null,d=>d.yearStats.bothVisibleFraction=null,d=>d.provenance.yearStats.status='unavailable']){const d=fixture();change(d);assert.throws(()=>annualComparison(d));}});
test('invalid annual dates are rejected',async()=>{const {annualComparison}=await adapter;const d=fixture();d.yearStats.periodEndUtc='bad date';assert.throws(()=>annualComparison(d));});
