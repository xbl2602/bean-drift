// Module worker: keeps the curvature-corrected 20 m height field and returns a lit mask whenever the main thread asks for a sun direction.
//   -> {type:'init', dem: Float32Array(n*n) 20 m heights, n, px, x0, z0}      (dem is transferred)
//   -> {type:'shadow', id, az, el}                                           <- {type:'shadow', id, lit: Uint8Array(n*n), ms} (lit is transferred)
// The main thread keeps one request in flight at a time and only sends the newest sun direction afterwards.
import { castShadow, curvatureCorrect } from './shadowcast.js';

let H = null, N = 0, PX = 0;

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    N = m.n; PX = m.px; H = curvatureCorrect(m.dem, m.n, m.px, m.x0, m.z0);
    postMessage({ type: 'ready' });
  } else if (m.type === 'shadow') {
    const t0 = performance.now();
    const lit = castShadow(H, N, PX, m.az, m.el);
    postMessage({ type: 'shadow', id: m.id, lit, ms: performance.now() - t0 }, [lit.buffer]);
  }
};
