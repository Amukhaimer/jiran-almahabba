import Link from "next/link";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/residents", label: "الجيران" },
  { href: "/payments", label: "الإيرادات" },
  { href: "/expenses", label: "المصاريف" },
  { href: "/reports", label: "التقارير" },
];

export function Nav({ buildingName }: { buildingName: string }) {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-md sticky top-0 z-40 no-print">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex flex-col">
          <span className="text-lg font-bold tracking-tight text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
            {buildingName}
          </span>
          <span className="text-xs text-[var(--muted)]">إدارة خدمات البناية</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--ink)]/80 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
