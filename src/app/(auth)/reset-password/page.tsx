import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { Loading } from "@/components/ui";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Nouveau mot de passe | Webuild" };

/** Atteinte depuis le lien de réinitialisation (session de récupération) ou depuis le dashboard. */
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
      <Suspense fallback={<Loading />}>
        <ResetPassword />
      </Suspense>
    </>
  );
}

async function ResetPassword() {
  const { user } = await requireUser("/reset-password");
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <p className="text-center text-sm text-muted">Compte : {user.email}</p>
      <ResetPasswordForm />
    </div>
  );
}
