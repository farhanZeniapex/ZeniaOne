"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApi } from "@/lib/api/client";
import { ArrowRight, Eye, EyeOff, Loader2, Mail, XCircle } from "lucide-react";
import styles from "../auth-form.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function FieldError({ msg }: { msg: string | undefined }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium" role="alert">
      <XCircle className="h-3.5 w-3.5 shrink-0" />
      {msg}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Per-field errors
  const [emailErr, setEmailErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [formErr, setFormErr] = useState("");
  const [twoFactorChallenge, setTwoFactorChallenge] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorErr, setTwoFactorErr] = useState("");
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateForm(): boolean {
    let ok = true;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailErr("Enter your email address.");
      ok = false;
    } else if (!isValidEmail(trimmedEmail)) {
      setEmailErr("Enter a valid email address.");
      ok = false;
    } else {
      setEmailErr("");
    }

    if (!password || !password.trim()) {
      setPasswordErr("Enter your password.");
      ok = false;
    } else {
      setPasswordErr("");
    }

    return ok;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr("");
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const res = await fetchApi<{ access_token?: string; user?: { is_platform_admin?: boolean }; two_factor_required?: boolean; challenge_token?: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (res.two_factor_required && res.challenge_token) {
        setTwoFactorChallenge(res.challenge_token);
        setTwoFactorCode("");
        setTwoFactorErr("");
        return;
      }

      if (res.access_token) {
        localStorage.setItem("zenaipex_token", res.access_token);
        if (res.user?.is_platform_admin) {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: unknown) {
      // Always show generic message — do not reveal whether email/account exists
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 400 || status === 422) {
        setFormErr("Invalid email or password.");
      } else if (status === 503 || status === 0 || !status) {
        setFormErr("Unable to reach the server. Please try again.");
      } else {
        setFormErr("Invalid email or password.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyTwoFactor() {
    if (!/^\d{6}$/.test(twoFactorCode)) {
      setTwoFactorErr("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setTwoFactorErr("");
    setIsLoading(true);
    try {
      const res = await fetchApi<{ access_token: string; user: { is_platform_admin?: boolean } }>("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ challenge_token: twoFactorChallenge, code: twoFactorCode }),
      });
      localStorage.setItem("zenaipex_token", res.access_token);
      router.push(res.user?.is_platform_admin ? "/admin" : "/dashboard");
    } catch {
      setTwoFactorErr("Invalid or expired authenticator code. Please sign in again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function requestPasswordReset() {
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setResetStatus("error");
      return;
    }
    setResetStatus("sending");
    try {
      await fetchApi(`/auth/forgot-password?email=${encodeURIComponent(normalizedEmail)}`, { method: "POST" });
      setResetStatus("sent");
    } catch {
      setResetStatus("error");
    }
  }

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <span className={styles.kicker}><i className={styles.kickerDot} /> {twoFactorChallenge ? "VERIFY YOUR IDENTITY" : "SIGN IN TO ZENIAONE"}</span>
        <CardTitle className={styles.title}>{twoFactorChallenge ? "One more security step." : "Good to have you back."}</CardTitle>
        <CardDescription className={styles.description}>{twoFactorChallenge ? "Enter the code from your authenticator app to continue." : "Pick up where your conversations left off."}</CardDescription>
      </CardHeader>

      <CardContent className={styles.content}>
        {twoFactorChallenge ? (
          <div className={styles.form}>
            <div className={styles.field}>
              <Label htmlFor="twoFactorCode" className={styles.fieldLabel}>Authenticator code</Label>
              <Input
                id="twoFactorCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => { setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6)); if (twoFactorErr) setTwoFactorErr(""); }}
                disabled={isLoading}
                aria-invalid={!!twoFactorErr}
                className={`${styles.input} tracking-[0.35em] text-center`}
              />
              <FieldError msg={twoFactorErr} />
            </div>
            <Button type="button" className={styles.submit} disabled={isLoading} onClick={verifyTwoFactor}>
              {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : <>Verify and continue <ArrowRight size={17} /></>}
            </Button>
            <button type="button" className="text-sm text-slate-500 underline underline-offset-2" onClick={() => { setTwoFactorChallenge(""); setTwoFactorCode(""); setTwoFactorErr(""); }}>Back to sign in</button>
          </div>
        ) : (
        <form onSubmit={onSubmit} className={styles.form} noValidate>
          {/* Email */}
          <div className={styles.field}>
            <Label htmlFor="email" className={styles.fieldLabel}>Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(""); }}
              onBlur={() => {
                const t = email.trim();
                if (!t) setEmailErr("Enter your email address.");
                else if (!isValidEmail(t)) setEmailErr("Enter a valid email address.");
                else setEmailErr("");
              }}
              disabled={isLoading}
              aria-invalid={!!emailErr}
              aria-describedby={emailErr ? "email-error" : undefined}
              className={`${styles.input} ${emailErr ? styles.inputError : ""}`}
            />
            <FieldError msg={emailErr} />
          </div>

          {/* Password */}
          <div className={styles.field}>
            <div className={styles.fieldTop}>
              <Label htmlFor="password" className={styles.fieldLabel}>Password</Label>
              <span className={styles.fieldHint}><button type="button" className="underline underline-offset-2 hover:text-sage-700" onClick={() => { setResetEmail(email); setResetStatus("idle"); setIsResetOpen(true); }}>Forgot password?</button></span>
            </div>
            <div className={styles.passwordWrap}>
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordErr) setPasswordErr(""); }}
                onBlur={() => {
                  if (!password || !password.trim()) setPasswordErr("Enter your password.");
                  else setPasswordErr("");
                }}
                disabled={isLoading}
                aria-invalid={!!passwordErr}
                aria-describedby={passwordErr ? "password-error" : undefined}
                className={`${styles.input} ${passwordErr ? styles.inputError : ""}`}
              />
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowPw((p) => !p)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className={styles.eyeButton}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError msg={passwordErr} />
          </div>

          {/* Form-level error */}
          {formErr && (
            <div
              className={styles.error}
              role="alert"
            >
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              {formErr}
            </div>
          )}

          <Button
            type="submit"
            className={styles.submit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing in…
              </>
            ) : (
              <>Sign in to workspace <ArrowRight size={17} /></>
            )}
          </Button>
        </form>
        )}
      </CardContent>

      <CardFooter className={styles.footer}>
        <p>
          New to ZeniaOne?{" "}
          <Link href="/signup">Create an account</Link>
        </p>
      </CardFooter>

      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage-700"><Mail className="h-5 w-5" /></span>
              <div>
                <h2 id="reset-password-title" className="font-semibold text-slate-900">Reset your password</h2>
                <p className="mt-1 text-sm text-slate-500">We will send instructions if this email belongs to an account.</p>
              </div>
            </div>
            {resetStatus === "sent" ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">If this address is registered, password reset instructions have been requested.</div>
            ) : (
              <>
                <Label htmlFor="reset-email" className={styles.fieldLabel}>Work email</Label>
                <Input id="reset-email" type="email" autoComplete="email" value={resetEmail} onChange={(event) => { setResetEmail(event.target.value); setResetStatus("idle"); }} placeholder="you@example.com" className="mt-2" disabled={resetStatus === "sending"} />
                {resetStatus === "error" && <p className="mt-2 text-xs font-medium text-red-600">Enter a valid email, then try again.</p>}
              </>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsResetOpen(false)}>Close</Button>
              {resetStatus !== "sent" && <Button type="button" onClick={requestPasswordReset} disabled={resetStatus === "sending"}>{resetStatus === "sending" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Requesting…</> : "Send instructions"}</Button>}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
