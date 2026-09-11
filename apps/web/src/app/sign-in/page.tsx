import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import { auth } from "@/auth";
import { appConfig } from "@/config/app";
import { SignInForm } from "@/app/sign-in/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden bg-muted/40 px-6">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 60% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Building2 className="size-5.5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-semibold">{appConfig.displayName}</span>
          <span className="text-xs text-muted-foreground">NYC facilities compliance planning</span>
        </div>
      </div>

      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Use a seeded demo account or your own credentials.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>

      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Real elevator &amp; boiler compliance data from NYC Open Data, planning tools layered on top.
      </p>
    </main>
  );
}
