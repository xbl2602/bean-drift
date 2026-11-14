// landing page 占位页。负责人：chanjy0806。可以整个替换，只要保留指向 /product 的入口。
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-sm uppercase tracking-widest text-[var(--muted)]">Landing page · placeholder</p>
      <h1 className="text-5xl font-semibold">Bean Drift</h1>
      <p className="text-lg text-[var(--muted)]">
        Compare sunlight and Earth-communication conditions anywhere on the Moon, on any date.
      </p>
      <div>
        <Link
          href="/product"
          className="inline-block rounded-md bg-[var(--accent)] px-5 py-2.5 font-medium text-black hover:opacity-90"
        >
          Open the map
        </Link>
      </div>
    </main>
  );
}
