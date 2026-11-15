"use client";
import { useEffect, useState } from "react";
import type { SolarEnergyEstimate } from "@/core/data/solar-energy";
import type { BodyVisibility } from "@/core/types";
import type { LatLon } from "../moon-frames";
import { usePointApi } from "../point-api/use-point-api";
const utc=(value:string)=>value.slice(0,16).replace("T"," ")+" UTC";
function untilSet(body:BodyVisibility, now:number, label:string) {
 if(body.diskVisibleFraction===null)return "Unavailable";
 if(body.diskVisibleFraction<=0)return body.nextRiseUtc?`Currently below horizon · rises ${utc(body.nextRiseUtc)}`:"Currently below horizon";
 if(!body.nextSetUtc)return "No set found within the 60-day search window";
 const minutes=Math.max(0,Math.ceil((Date.parse(body.nextSetUtc)-now)/60000));
 if(!minutes)return "Updating next set…";
 return `${Math.floor(minutes/1440)?`${Math.floor(minutes/1440)}d `:""}${Math.floor(minutes%1440/60)}h ${minutes%60}m until ${label} · ${utc(body.nextSetUtc)}`;
}
export function SiteConditions({point,timeMs}:{point:LatLon;timeMs:number}) {
 const conditions=usePointApi(point,timeMs),[durationH,setDurationH]=useState(24);
 const [energy,setEnergy]=useState<{key:string;value:SolarEnergyEstimate|"error"}|null>(null);
 const minute=Math.floor(timeMs/60000)*60000;
 const key=`${point.latDeg},${point.lonDeg}@${minute}:${durationH}`;
 useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>{const query=new URLSearchParams({latDeg:String(point.latDeg),lonDeg:String(point.lonDeg),time:new Date(minute).toISOString(),durationH:String(durationH)});fetch(`/api/energy?${query}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error("Unavailable");const value:SolarEnergyEstimate=await response.json();if(!value.energyWhPerM2||!Number.isFinite(value.energyWhPerM2.horizontal))throw Error("Invalid energy");if(!controller.signal.aborted)setEnergy({key,value});}).catch(()=>{if(!controller.signal.aborted)setEnergy({key,value:"error"});});},450);return()=>{clearTimeout(timer);controller.abort();};},[key,point.latDeg,point.lonDeg,minute,durationH]);
 const data=conditions.data, result=energy?.key===key?energy.value:null;
 return <section aria-label="Sun, Earth and solar energy" className="mt-4 space-y-3 border-t border-white/10 pt-3"><h3 className="text-xs font-semibold text-slate-100">Sun, Earth & solar energy</h3>
 {data?<><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Solar elevation</dt><dd className="mt-1 text-lg tabular-nums">{data.sun.elevationDeg.toFixed(2)}°</dd></div><div><dt className="text-slate-400">Earth elevation</dt><dd className="mt-1 text-lg tabular-nums">{data.earth.elevationDeg.toFixed(2)}°</dd></div></dl><div className="rounded-xl bg-white/5 p-3 text-xs leading-relaxed"><p className="font-medium text-[#dfc89d]">Time before sunset</p><p className="mt-1 text-slate-200">{untilSet(data.visibility.sun,timeMs,"sunset")}</p><p className="mt-3 font-medium text-[#a8c8d9]">Time before Earthset</p><p className="mt-1 text-slate-200">{untilSet(data.visibility.earth,timeMs,"Earthset")}</p></div></>:<p role="status" className="text-xs text-slate-400">{conditions.status==="error"?conditions.message:"Calculating sky angles and terrain-adjusted set times…"}</p>}
 {data&&conditions.status!=="ready"&&<p className="text-[10px] text-slate-400">{conditions.status==="error"?conditions.message:"Updating sky conditions…"}</p>}
 <label className="flex items-center justify-between gap-2 text-xs text-slate-300">Solar energy over the next<select aria-label="Solar energy period" value={durationH} onChange={e=>setDurationH(Number(e.target.value))} className="rounded-lg border border-white/15 bg-[#243140] p-2"><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option></select></label>
 {result&&result!=="error"?<dl className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 p-3 text-xs"><div><dt className="text-slate-400">Horizontal panel</dt><dd className="mt-1 text-base text-[#dfc89d] tabular-nums">{(result.energyWhPerM2.horizontal/1000).toFixed(2)} kWh/m²</dd></div><div><dt className="text-slate-400">Sun-tracking panel</dt><dd className="mt-1 text-base text-[#dfc89d] tabular-nums">{(result.energyWhPerM2.sunTracking/1000).toFixed(2)} kWh/m²</dd></div></dl>:<p role="status" className="text-xs text-slate-400">{result==="error"?"Solar energy is unavailable for this location right now.":"Calculating incident solar energy…"}</p>}
 {result&&result!=="error"&&<p className="text-[10px] text-slate-400">{utc(result.startUtc)} → {utc(result.endUtc)}</p>}
 <p className="text-[10px] leading-relaxed text-slate-400">Angles are calculated; set times include terrain blocking. Energy is incident sunlight, not electrical output: panel efficiency, dust and losses are not included. Earth visibility alone does not guarantee a radio link.</p></section>;
}
