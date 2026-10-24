import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Mot de passe oublié | Webuild" };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex max-w-sm flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
        <p className="text-sm text-muted">Indique ton email : tu recevras un lien pour choisir un nouveau mot de passe.</p>
      </div>
      <ForgotPasswordForm />
    </>
  );
}
