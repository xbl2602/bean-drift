// 第一人称的"拍照"：把此刻画面里看到的东西存成一张 PNG 图片，下边加一条说明（地点、时间、太阳高度）。
// 必须在画完一帧的同一个时刻读画布（WebGL 画布画完后会被浏览器清掉），所以由绘制循环在 renderer.render 之后调用。

/** 把 WebGL 画布合成一张带说明条的图，返回 PNG。canvas.style.filter（自动曝光的对比度）也一起画进去，和屏幕上看到的一致。 */
export function composePhoto(source: HTMLCanvasElement, caption: string): Promise<Blob> {
  const { width, height } = source;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.filter = source.style.filter || "none";
  ctx.drawImage(source, 0, 0);
  ctx.filter = "none";
  const stripH = Math.round(Math.max(36, width * 0.026));
  const gradient = ctx.createLinearGradient(0, height - stripH * 1.6, 0, height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - stripH * 1.6, width, stripH * 1.6);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `${Math.round(stripH * 0.46)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText(caption, stripH * 0.5, height - stripH * 0.5);
  return new Promise((resolve, reject) => out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be encoded."))), "image/png"));
}

/** 触发浏览器下载。 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 文件名里不放空格和度数符号：lunar-quest_37.14N-66.16W_2026-11-15T0805Z.png */
export function photoFilename(latDeg: number, lonDeg: number, timeMs: number): string {
  const lat = `${Math.abs(latDeg).toFixed(2)}${latDeg >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(lonDeg).toFixed(2)}${lonDeg >= 0 ? "E" : "W"}`;
  const stamp = new Date(timeMs).toISOString().slice(0, 16).replace(/[-:]/g, "");
  return `lunar-quest_${lat}-${lon}_${stamp}Z.png`;
}
