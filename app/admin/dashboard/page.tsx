
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { verifyJwt } from "@/lib/auth";
import DatabaseReports from "./DatabaseReports";
import AdminLogoutButton from "../../components/AdminLogoutButton";

async function AdminDashboardContent() {
  // Run authentication only when an actual request arrives.
  await connection();

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const payload = token ? verifyJwt(token) : null;

  if (!payload || payload.role !== "ADMIN") {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            PatentScan Admin
          </h2>
          <p className="text-xs text-slate-500">
            Administrator control panel
          </p>
        </div>

        <AdminLogoutButton />
      </header>

      {/* Existing analytics dashboard */}
      <DatabaseReports />
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          Checking administrator access...
        </main>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
