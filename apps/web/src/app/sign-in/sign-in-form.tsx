"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, ShieldCheck, ClipboardList, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@gantry.local", password: "admin1234", icon: ShieldCheck },
  { role: "Planner", email: "planner@gantry.local", password: "planner1234", icon: ClipboardList },
  { role: "Viewer", email: "viewer@gantry.local", password: "viewer1234", icon: Eye },
] as const;

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(emailValue: string, passwordValue: string) {
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: emailValue,
        password: passwordValue,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <Button
            key={account.role}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto flex-col gap-1.5 py-3"
            disabled={isPending}
            onClick={() => {
              setEmail(account.email);
              setPassword(account.password);
              submit(account.email, account.password);
            }}
          >
            <account.icon className="size-4 text-muted-foreground" />
            <span className="text-xs">{account.role}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or sign in manually</span>
        <Separator className="flex-1" />
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(email, password);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={isPending} className="mt-1">
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
