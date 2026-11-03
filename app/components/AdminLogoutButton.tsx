"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      router.replace("/admin/login");
      router.refresh();
    } catch (error) {
      console.error("Admin logout error:", error);
      setLoading(false);
      alert("Unable to log out. Please try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>↪</span>
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}