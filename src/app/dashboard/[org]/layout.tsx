import { Suspense } from "react";
import Link from "next/link";
import { listMyOrganizations } from "@/modules/organizations/queries";
import { signOut } from "@/app/(auth)/logout/actions";
import { Loading } from "@/components/ui";
import { loadOrganization } from "./context";
import { NavLinks } from "./nav-links";
import { OrganizationSwitcher } from "./organization-switcher";

export default function OrganizationLayout({ children, params }: LayoutProps<"/dashboard/[org]">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-border bg-surface px-4 py-4 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r md:py-6">
        <Link href="/" className="px-3 text-lg font-semibold tracking-tight">
          Webuild
        </Link>
        <Suspense fallback={<div className="px-3"><Loading /></div>}>
          <Sidebar params={params} />
        </Suspense>
      </aside>
      <main className="flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 md:px-10">
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </main>
    </div>
  );
}

async function Sidebar({ params }: { params: LayoutProps<"/dashboard/[org]">["params"] }) {
  const { org: slug } = await params;
  const { supabase, user } = await loadOrganization(slug);
  const organizations = await listMyOrganizations(supabase, user.id);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <OrganizationSwitcher organizations={organizations} currentSlug={slug} />
      <NavLinks slug={slug} />
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 pt-4 text-sm md:flex-col">
        <span className="truncate text-muted" title={user.email ?? ""}>
          {user.email}
        </span>
        <Link href="/reset-password" className="text-muted hover:text-foreground">
          Changer mon mot de passe
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-muted hover:text-foreground">
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
