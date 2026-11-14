// product page 占位页。负责人：ShanLe1224。可以整个替换。
// 要数据时请调用 /api/point、/api/compare、/api/presets（接口说明见 docs/SHARED_INTERFACES.md），不要自己算星历。
import Link from "next/link";

export default function ProductPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-sm uppercase tracking-widest text-[var(--muted)]">Product page · placeholder</p>
      <h1 className="text-4xl font-semibold">Lunar map</h1>
      <p className="text-[var(--muted)]">The 2D whole-Moon map, timeline and layers will live here.</p>
      <div>
        <Link href="/" className="text-[var(--accent)] underline-offset-4 hover:underline">
          ← Back to landing page
        </Link>
      </div>
    </main>
  );
}
