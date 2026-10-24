import { Suspense } from "react";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion | Webuild" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <h1 className="text-2xl font-semibold">Connexion à Webuild</h1>
      <Suspense>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginFormWithParams({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "/dashboard");
  const error = typeof params.error === "string" ? params.error : undefined;
  return <LoginForm next={next} error={error} />;
}
