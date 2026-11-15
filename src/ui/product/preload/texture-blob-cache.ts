// 贴图下载缓存：同一个地址只下载一次。
// 首页"提前下"和产品页"真正要用"共用同一次下载：哪怕提前下的还没下完，产品页也是接着等它，不会再发第二个请求。
// 只放在浏览器内存里（预载的几张加起来约 8 MB），刷新页面就没了；跨刷新靠 next.config.ts 里给 /product/moon、/product/sky 设的 HTTP 缓存。
// 不 import three：首页也要用这个文件。

const downloads = new Map<string, Promise<Blob>>();

/** 下载一个文件并缓存。lowPriority 给"后台预下"用，让它不和页面自己的请求抢带宽。 */
export function fetchTextureBlob(url: string, lowPriority = false): Promise<Blob> {
  const existing = downloads.get(url);
  if (existing) return existing;
  const download = fetch(url, lowPriority ? { priority: "low" } : undefined).then((response) => {
    if (!response.ok) throw new Error(`Texture download failed (${response.status}): ${url}`);
    return response.blob();
  });
  downloads.set(url, download);
  // 失败的下载不能一直留在缓存里，否则用户重试也永远失败
  download.catch(() => {
    if (downloads.get(url) === download) downloads.delete(url);
  });
  return download;
}
