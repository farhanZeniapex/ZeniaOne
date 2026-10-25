"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { fetchApi } from "@/lib/api/client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token provided in the URL.");
      return;
    }

    verifyToken(token);
  }, [token]);

  async function verifyToken(verificationToken: string) {
    try {
      await fetchApi(`/auth/verify-email?token=${verificationToken}`, {
        method: "POST",
      });
      setStatus("success");
    } catch (error: any) {
      setStatus("error");
      setErrorMessage(error.message || "Invalid or expired verification link.");
    }
  }

  return (
    <Card className="w-full max-w-md shadow-sm border-slate-200">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight">Email Verification</CardTitle>
        <CardDescription>Verifying your account email address</CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-sage-600 animate-spin" />
            <p className="text-slate-600">Please wait while we verify your email...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-slate-900">Email Verified!</h3>
              <p className="text-slate-500 text-sm">
                Your email address has been successfully verified. You now have full access to your account.
              </p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-red-500" />
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-slate-900">Verification Failed</h3>
              <p className="text-slate-500 text-sm">
                {errorMessage}
              </p>
              <p className="text-slate-400 text-xs mt-2">
                You can request a new verification link from your Profile Settings.
              </p>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="pt-4 flex justify-center bg-slate-50/50 border-t">
        {status === "success" ? (
          <Button className="w-full bg-sage-600 hover:bg-sage-700 text-white" onClick={() => router.push("/dashboard")}>
            Continue to Dashboard
          </Button>
        ) : status === "error" ? (
          <Button className="w-full" variant="outline" onClick={() => router.push("/dashboard/settings")}>
            Go to Profile Settings
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md shadow-sm border-slate-200 p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-sage-600 animate-spin" />
        </Card>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
