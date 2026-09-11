import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { appConfig } from "@/config/app";

export default function SignInPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Sign in to {appConfig.displayName}</h1>
      <form
        className="flex flex-col gap-3"
        action={async (formData: FormData) => {
          "use server";
          try {
            await signIn("credentials", {
              email: formData.get("email"),
              password: formData.get("password"),
              redirect: false,
            });
          } catch {
            redirect("/sign-in?error=1");
          }
          redirect("/");
        }}
      >
        <input
          className="rounded border px-3 py-2"
          name="email"
          type="email"
          placeholder="Email"
          required
        />
        <input
          className="rounded border px-3 py-2"
          name="password"
          type="password"
          placeholder="Password"
          required
        />
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
