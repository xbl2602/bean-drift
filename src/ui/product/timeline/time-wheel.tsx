"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
const ROW_HEIGHT = 40;
/** A native-scroll wheel with a fixed central selection and faded neighbouring values.
 *  rows = how many rows are visible (odd; 5 for the time columns, 3 for the compact month/year wheels).
 *  format = how a value is shown (default: two-digit numbers, AM/PM as is). */
export function TimeWheel({label,value,values,onChange,rows=5,format}: {label:string;value:string|number;values:string[];onChange:(value:string)=>void;rows?:number;format?:(item:string)=>string}) {
 const pad=((rows-1)/2)*ROW_HEIGHT;
 const ref=useRef<HTMLDivElement>(null), timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const latest=useRef({values,onChange});latest.current={values,onChange};
 const selected=Math.max(0,values.indexOf(String(value)));
 const [active,setActive]=useState(selected);
 const id=useId();
 useLayoutEffect(()=>{if(ref.current){ref.current.scrollTop=selected*ROW_HEIGHT;setActive(selected);}},[selected]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const choose=(index:number)=>{const next=Math.max(0,Math.min(values.length-1,index));if(timer.current)clearTimeout(timer.current);setActive(next);ref.current?.scrollTo({top:next*ROW_HEIGHT,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});onChange(values[next]);};
 return <div><p className="mb-2 text-center text-[10px] text-slate-400">{label}</p><div className="relative"><div aria-hidden="true" style={{top:pad}} className="pointer-events-none absolute inset-x-0 h-10 rounded-lg border-y border-white/15 bg-white/[0.09]"/><div ref={ref} role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={`${id}-${active}`} style={{height:rows*ROW_HEIGHT,paddingBlock:pad}} className={`time-wheel-scroll ${rows<5?"time-wheel-compact":""} relative snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl text-center outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200`} onScroll={event=>{const el=event.currentTarget;const index=Math.max(0,Math.min(latest.current.values.length-1,Math.round(el.scrollTop/ROW_HEIGHT)));setActive(index);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{latest.current.onChange(latest.current.values[index]);},140);}} onKeyDown={event=>{const next=event.key==="ArrowDown"?active+1:event.key==="ArrowUp"?active-1:event.key==="Home"?0:event.key==="End"?values.length-1:null;if(next!==null){event.preventDefault();choose(next);}}}>
 {values.map((item,index)=><div id={`${id}-${index}`} role="option" aria-selected={active===index} key={item} onClick={()=>choose(index)} className={`flex h-10 cursor-pointer snap-center items-center justify-center text-base tabular-nums transition-[color,font-size] motion-reduce:transition-none ${active===index?"text-xl font-medium text-slate-50":"text-slate-400"}`}>{format?format(item):label==="AM / PM"?item:item.padStart(2,"0")}</div>)}
 </div></div></div>;
}
