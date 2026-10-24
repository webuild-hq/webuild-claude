import { Suspense } from "react";
import { safeNextPath } from "@/lib/safe-redirect";
import { Loading } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion | Webuild" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
      <Suspense fallback={<Loading />}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </>
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
