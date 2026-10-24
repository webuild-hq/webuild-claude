import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listMyOrganizations } from "@/modules/organizations/queries";
import { signOut } from "@/app/(auth)/logout/actions";
import { OrganizationSwitcher } from "./organization-switcher";

export default function OrganizationLayout({ children, params }: LayoutProps<"/dashboard/[org]">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="font-semibold">
            Webuild
          </Link>
          <Suspense fallback={<span className="text-sm opacity-60">Chargement...</span>}>
            <Navigation params={params} />
          </Suspense>
          <form action={signOut} className="ml-auto">
            <button type="submit" className="text-sm opacity-70 hover:opacity-100">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">{children}</main>
    </div>
  );
}

async function Navigation({ params }: { params: LayoutProps<"/dashboard/[org]">["params"] }) {
  const { org: slug } = await params;
  const { supabase, user } = await requireUser(`/dashboard/${slug}`);
  const organizations = await listMyOrganizations(supabase, user.id);
  const current = organizations.find((org) => org.slug === slug);
  if (!current) notFound();

  return (
    <>
      <OrganizationSwitcher organizations={organizations} currentSlug={slug} />
      <nav className="flex gap-4 text-sm">
        <Link href={`/dashboard/${slug}`} className="opacity-80 hover:opacity-100">
          Vue d&apos;ensemble
        </Link>
        <Link href={`/dashboard/${slug}/members`} className="opacity-80 hover:opacity-100">
          Membres
        </Link>
      </nav>
    </>
  );
}
