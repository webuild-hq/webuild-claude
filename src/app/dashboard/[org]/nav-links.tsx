"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { path: "", label: "Vue d'ensemble" },
  { path: "/claude", label: "Connecter Claude" },
  { path: "/themes", label: "Thèmes" },
  { path: "/shops", label: "Boutiques" },
  { path: "/images", label: "Images" },
  { path: "/credits", label: "Crédits" },
  { path: "/billing", label: "Abonnement" },
  { path: "/members", label: "Membres" },
];

export function NavLinks({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${slug}`;

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {LINKS.map((link) => {
        const href = `${base}${link.path}`;
        const active = link.path === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={link.path}
            href={href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-background font-medium text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
