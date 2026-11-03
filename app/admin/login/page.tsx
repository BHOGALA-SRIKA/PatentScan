
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Invalid email or password.");
        return;
      }

      router.push("/admin/dashboard");
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-4 py-10">

      {/* Background decoration */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">

        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-2xl font-bold text-white shadow-lg shadow-cyan-200">
            P
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Patent<span className="text-cyan-600">Scan</span>
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Hybrid Patent Prior-Art Search &amp; Claim Analysis
          </p>
        </div>

        {/* Login card */}
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-9">

          {/* Admin heading */}
          <div className="mb-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-700">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              Secure Access
            </div>

            <h2 className="text-2xl font-bold text-slate-900">
              Admin Portal
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sign in to manage PatentScan and access system-wide reports.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
            >
              <svg
                className="mt-0.5 h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label
                htmlFor="admin-email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email Address
              </label>

              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>

                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="admin-password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>

                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-600"
                >
                  {showPassword ? (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1.1-.9 2.2-2 3.2M6.2 6.2C3.8 7.8 2.3 10 2 12c.5 2.5 4 7 10 7 1.1 0 2.2-.2 3.2-.6" />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-200 transition hover:-translate-y-0.5 hover:from-cyan-700 hover:to-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="3"
                      opacity="0.3"
                    />
                    <path
                      d="M21 12a9 9 0 0 0-9-9"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In to Admin Portal
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Security notice */}
          <div className="mt-7 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>

            <div>
              <p className="text-xs font-semibold text-slate-700">
                Authorized Administrators Only
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                This portal is restricted to authorized PatentScan administrators.
              </p>
            </div>
          </div>
        </section>

        {/* Back to login selection */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-sm font-medium text-slate-500 transition hover:text-cyan-700"
          >
            ← Back to login selection
          </button>
        </div>

        {/* Footer */}
<p className="mt-8 text-center text-xs text-slate-400">
  © 2026 PatentScan. All rights reserved.
</p>
      </div>
    </main>
  );
}
