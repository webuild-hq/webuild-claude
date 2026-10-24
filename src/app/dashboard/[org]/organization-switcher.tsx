"use client";

import { useRef } from "react";
import Link from "next/link";
import { switchOrganization } from "@/modules/organizations/actions";
import type { MyOrganization } from "@/modules/organizations/types";

export function OrganizationSwitcher({
  organizations,
  currentSlug,
}: {
  organizations: MyOrganization[];
  currentSlug: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const current = organizations.find((org) => org.slug === currentSlug);

  return (
    <form ref={formRef} action={switchOrganization} className="flex items-center gap-2">
      <input type="hidden" name="organization_id" defaultValue={current?.id ?? ""} />
      <input type="hidden" name="slug" defaultValue={currentSlug} />
      <select
        aria-label="Agence"
        defaultValue={currentSlug}
        onChange={(event) => {
          const target = organizations.find((org) => org.slug === event.target.value);
          if (!target) return;
          const form = formRef.current!;
          (form.elements.namedItem("organization_id") as HTMLInputElement).value = target.id;
          (form.elements.namedItem("slug") as HTMLInputElement).value = target.slug;
          form.requestSubmit();
        }}
        className="rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.slug}>
            {org.name}
          </option>
        ))}
      </select>
      <Link href="/dashboard/new" className="text-sm opacity-70 hover:opacity-100" title="Nouvelle agence">
        + Agence
      </Link>
    </form>
  );
}
