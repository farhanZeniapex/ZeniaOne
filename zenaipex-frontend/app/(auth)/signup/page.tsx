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
import { ArrowRight, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
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

// ─── Password strength indicator ──────────────────────────────────────────────
function PasswordHint({ password }: { password: string }) {
  const minLen = password.length >= 8;
  const notBlank = password.trim().length > 0;

  if (!password) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <Requirement met={minLen && notBlank} label="At least 8 characters" />
    </div>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${met ? "text-green-600" : "text-[#7A756D]"}`}>
      {met ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Per-field errors
  const [nameErr, setNameErr] = useState("");
  const [companyErr, setCompanyErr] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [confirmErr, setConfirmErr] = useState("");
  const [formErr, setFormErr] = useState("");

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateForm(): boolean {
    let ok = true;

    const trimName = name.trim();
    if (!trimName) {
      setNameErr("Enter your name."); ok = false;
    } else if (trimName.length < 2) {
      setNameErr("Name must be at least 2 characters."); ok = false;
    } else {
      setNameErr("");
    }

    const trimCompany = companyName.trim();
    if (!trimCompany) {
      setCompanyErr("Enter your company name."); ok = false;
    } else if (trimCompany.length < 2) {
      setCompanyErr("Company name must be at least 2 characters."); ok = false;
    } else {
      setCompanyErr("");
    }

    const trimEmail = email.trim();
    if (!trimEmail) {
      setEmailErr("Enter your email address."); ok = false;
    } else if (!isValidEmail(trimEmail)) {
      setEmailErr("Enter a valid email address."); ok = false;
    } else {
      setEmailErr("");
    }

    if (!password || !password.trim()) {
      setPasswordErr("Enter a password."); ok = false;
    } else if (password.length < 8) {
      setPasswordErr("Use at least 8 characters."); ok = false;
    } else {
      setPasswordErr("");
    }

    if (!confirmPassword) {
      setConfirmErr("Confirm your password."); ok = false;
    } else if (password !== confirmPassword) {
      setConfirmErr("Passwords do not match."); ok = false;
    } else {
      setConfirmErr("");
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
      const res = await fetchApi<{ access_token: string; user: { is_platform_admin?: boolean } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          company_name: companyName.trim(),
        }),
      });

      if (res.access_token) {
        localStorage.setItem("zenaipex_token", res.access_token);
        router.push("/onboarding");
      }
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      const status = apiErr?.status;
      const rawMsg: string = apiErr?.message || "";

      if (rawMsg.toLowerCase().includes("already exists") || rawMsg.toLowerCase().includes("duplicate") || status === 409) {
        setFormErr("An account with this email already exists.");
      } else if (status === 422 || rawMsg.includes("password")) {
        // Backend Pydantic validation — safe to surface (no secrets involved)
        setFormErr(rawMsg || "Please check your details and try again.");
      } else if (status === 503 || !status) {
        setFormErr("Unable to reach the server. Please try again.");
      } else {
        setFormErr("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <span className={styles.kicker}><i className={styles.kickerDot} /> CREATE YOUR WORKSPACE</span>
        <CardTitle className={styles.title}>Your next conversation starts here.</CardTitle>
        <CardDescription className={styles.description}>A few details, then you can shape your first AI agent.</CardDescription>
        <div className={styles.progress} aria-label="Setup steps"><span>01 Account</span><i /><span>02 Company</span><i /><span>03 AI agent</span></div>
      </CardHeader>

      <CardContent className={styles.content}>
        <form onSubmit={onSubmit} className={styles.form} noValidate>
          {/* Name */}
          <div className={styles.field}>
            <Label htmlFor="name" className={styles.fieldLabel}>Your name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameErr) setNameErr(""); }}
              onBlur={() => {
                const t = name.trim();
                if (!t) setNameErr("Enter your name.");
                else if (t.length < 2) setNameErr("Name must be at least 2 characters.");
                else setNameErr("");
              }}
              disabled={isLoading}
              aria-invalid={!!nameErr}
              className={`${styles.input} ${nameErr ? styles.inputError : ""}`}
            />
            <FieldError msg={nameErr} />
          </div>

          {/* Company */}
          <div className={styles.field}>
            <Label htmlFor="companyName" className={styles.fieldLabel}>Company name</Label>
            <Input
              id="companyName"
              type="text"
              autoComplete="organization"
              placeholder="Acme Inc."
              value={companyName}
              onChange={(e) => { setCompanyName(e.target.value); if (companyErr) setCompanyErr(""); }}
              onBlur={() => {
                const t = companyName.trim();
                if (!t) setCompanyErr("Enter your company name.");
                else if (t.length < 2) setCompanyErr("Company name must be at least 2 characters.");
                else setCompanyErr("");
              }}
              disabled={isLoading}
              aria-invalid={!!companyErr}
              className={`${styles.input} ${companyErr ? styles.inputError : ""}`}
            />
            <FieldError msg={companyErr} />
          </div>

          {/* Email */}
          <div className={styles.field}>
            <Label htmlFor="email" className={styles.fieldLabel}>Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
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
              className={`${styles.input} ${emailErr ? styles.inputError : ""}`}
            />
            <FieldError msg={emailErr} />
          </div>

          {/* Password */}
          <div className={styles.field}>
            <Label htmlFor="password" className={styles.fieldLabel}>Password</Label>
            <div className={styles.passwordWrap}>
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordErr) setPasswordErr(""); if (confirmErr && confirmPassword) setConfirmErr(e.target.value === confirmPassword ? "" : "Passwords do not match."); }}
                onBlur={() => {
                  if (!password || !password.trim()) setPasswordErr("Enter a password.");
                  else if (password.length < 8) setPasswordErr("Use at least 8 characters.");
                  else setPasswordErr("");
                }}
                disabled={isLoading}
                aria-invalid={!!passwordErr}
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
            <PasswordHint password={password} />
          </div>

          {/* Confirm Password */}
          <div className={styles.field}>
            <Label htmlFor="confirmPassword" className={styles.fieldLabel}>Confirm password</Label>
            <div className={styles.passwordWrap}>
              <Input
                id="confirmPassword"
                type={showConfirmPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmErr) setConfirmErr(e.target.value === password ? "" : "Passwords do not match.");
                }}
                onBlur={() => {
                  if (!confirmPassword) setConfirmErr("Confirm your password.");
                  else if (confirmPassword !== password) setConfirmErr("Passwords do not match.");
                  else setConfirmErr("");
                }}
                disabled={isLoading}
                aria-invalid={!!confirmErr}
                className={`${styles.input} ${confirmErr ? styles.inputError : ""}`}
              />
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowConfirmPw((p) => !p)}
                aria-label={showConfirmPw ? "Hide password" : "Show password"}
                className={styles.eyeButton}
              >
                {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError msg={confirmErr} />
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
                Creating account…
              </>
            ) : (
              <>Create your workspace <ArrowRight size={17} /></>
            )}
          </Button>
        </form>
        <p className={styles.nextStep}>Next: <strong>set up your company and AI agent</strong></p>
      </CardContent>

      <CardFooter className={styles.footer}>
        <p>
          Already have an account?{" "}
          <Link href="/login">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
