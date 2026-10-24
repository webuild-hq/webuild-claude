import Link from "next/link";
import { CreateOrganizationForm } from "./create-organization-form";

export const metadata = { title: "Nouvelle agence | Webuild" };

export default function NewOrganizationPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Nouvelle agence</h1>
        <p className="text-sm text-muted">
          Chaque agence a ses propres membres, crédits et boutiques livrées.
        </p>
      </div>
      <CreateOrganizationForm />
      <Link href="/dashboard" className="text-sm underline text-muted">
        Retour au dashboard
      </Link>
    </main>
  );
}
