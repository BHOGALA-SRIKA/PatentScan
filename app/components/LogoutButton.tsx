
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Logout failed. Please try again.");
      }

      // Redirect after the server clears the authentication cookie.
      window.location.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Could not log out. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-xl border border-red-700 bg-red-950/40 px-5 py-2.5 text-sm font-semibold text-red-300 shadow-sm transition hover:bg-red-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
