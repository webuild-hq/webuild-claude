"use client";

import { useRef } from "react";
import Link from "next/link";
import { switchOrganization } from "@/modules/organizations/actions";
import type { MyOrganization } from "@/modules/organizations/types";
import { Select } from "@/components/ui";

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
    <form ref={formRef} action={switchOrganization} className="flex flex-col gap-1 px-1">
      <input type="hidden" name="organization_id" defaultValue={current?.id ?? ""} />
      <input type="hidden" name="slug" defaultValue={currentSlug} />
      <span className="px-2 text-xs font-medium uppercase tracking-wide text-muted">Agence</span>
      <Select
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
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.slug}>
            {org.name}
          </option>
        ))}
      </Select>
      <Link href="/dashboard/new" className="px-2 text-xs text-muted hover:text-foreground">
        + Nouvelle agence
      </Link>
    </form>
  );
}
