import { useState } from "react";
import { projectNearby, type NearbyLocation } from "../logic/nearby-map";
import { coordinates } from "./visual-data";
import styles from "./nearby-map.module.css";

export function NearbyMap({ location }: { location: NearbyLocation }) {
  const [selected, setSelected] = useState<number | null>(null);
  const points = location.nearbyFeatures.map(feature => ({ feature, ...projectNearby(location.queryCoord, feature) }));
  const extentKm = Math.max(25, Math.ceil(Math.max(0, ...points.map(p => p.distanceKm)) / 25) * 25);
  const scale = 102 / extentKm;
  const feature = selected === null ? null : points[selected]?.feature;
  return <section className={styles.card} aria-label="Nearby named lunar features">
    <div className={styles.heading}><span>AROUND YOUR LOCATION</span><span className={styles.badge}>SCHEMATIC</span></div>
    <h4>{coordinates(location.queryCoord)}</h4>
    <p className={styles.caption}>IAU named feature centres · not a photograph or terrain survey</p>
    <svg className={styles.map} viewBox="0 0 280 290" role="img" aria-label={`Map of ${points.length} nearby named feature centres. Your location is at the centre. North up, east right; outer ring ${extentKm} kilometres. Use the numbered list below for distances and selection.`}>
      <rect x="5" y="5" width="270" height="280" rx="14" fill="#0b151d" />
      {[.5, 1].map(ratio => <circle key={ratio} cx="140" cy="140" r={102 * ratio} fill="none" stroke="#324752" strokeDasharray="3 5" />)}
      <path d="M140 27V250 M28 140H252" stroke="#263c46" />
      <text x="140" y="22" textAnchor="middle">N</text><text x="260" y="144" textAnchor="middle">E</text>
      <text x="140" y="264" textAnchor="middle">{extentKm} km radius</text>
      {points.map((point, i) => {
        const x = 140 + point.eastKm * scale, y = 140 - point.northKm * scale;
        return <g key={i} opacity={selected === null || selected === i ? 1 : .45}>
          <line x1="140" y1="140" x2={x} y2={y} stroke={selected === i ? "#d2ec9a" : "#57727c"} strokeDasharray="3 4" />
          <circle cx={x} cy={y} r="10" fill={selected === i ? "#d2ec9a" : "#b6dbe0"} stroke="#0b151d" strokeWidth="2" />
          <text x={x} y={y + 3.5} textAnchor="middle" className={styles.number}>{i + 1}</text>
        </g>;
      })}
      <path d="M140 132l8 8-8 8-8-8Z" fill="#d2ec9a" stroke="#0b151d" strokeWidth="2" />
      <text x="140" y="280" textAnchor="middle">◆ Your location · numbered dots: feature centres</text>
    </svg>
    <p className={styles.caption}>Distance rings are measured from your location. Dot sizes do not represent crater diameters. {Math.abs(location.queryCoord.latDeg) > 89.9 ? "Near a pole, orientation depends on the query longitude." : "North up · East right."}</p>
    {!points.length ? <p className={styles.caption}>No matching named features were returned. The catalog may be unavailable or have no matches in this search area; this does not mean the surface is empty.</p> : null}
    <ol className={styles.list}>{points.map(({ feature }, i) => <li key={i}><button type="button" aria-pressed={selected === i} onClick={() => setSelected(selected === i ? null : i)}>
      <span className={styles.index}>{i + 1}</span><span><strong>{feature.name}</strong><small>{feature.featureType} · centre {feature.distanceKm.toFixed(1)} km away</small></span>
    </button></li>)}</ol>
    {feature ? <div className={styles.detail}><strong>{feature.name}</strong><p>{coordinates(feature)} · catalog diameter {feature.diameterKm > 0 ? `${feature.diameterKm} km` : "unavailable"}</p><p>Distance is to the catalog centre, not the rim. Catalog size alone cannot establish whether you are inside an irregular feature.</p></div> : <p className={styles.caption}>Select a feature to highlight it and see its coordinates.</p>}
    <p className={styles.caption}>Source: bundled IAU lunar gazetteer. A selection of nearby named features, not every crater, mountain or hazard. Not a surface-view image or landing safety assessment.</p>
  </section>;
}
