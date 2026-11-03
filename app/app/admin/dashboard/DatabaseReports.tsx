"use client";

import { useEffect, useState } from "react";

type Reports = {
  total_patents: number;
  patents_by_classification: { classification: string; patent_count: number }[];
  recent_patents: { publication_number: string; title: string; publication_date: string | null }[];
  patents_by_legal_status: { legal_status: string; patent_count: number }[];
};

export default function DatabaseReports() {
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/patents/reports", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load database reports.");
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load database reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadReports(); }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">PatentScan administration</p>
            <h1 className="mt-2 text-3xl font-bold">Database Reports</h1>
            <p className="mt-2 text-slate-400">Overview of the shared patent database.</p>
          </div>
          <button onClick={() => void loadReports()} disabled={loading}
            className="rounded-xl border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-950 disabled:opacity-50">
            {loading ? "Loading..." : "Refresh reports"}
          </button>
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl bg-red-950/40 p-4 text-red-300">{error}</p>}
        {loading && !reports && <p className="text-slate-400">Loading database reports...</p>}
        {reports && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Total patents</p>
              <p className="mt-2 text-5xl font-bold text-cyan-400">{reports.total_patents}</p>
            </section>
            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="mb-4 text-lg font-semibold">Patents by Classification</h2>
                {reports.patents_by_classification.map((item) => (
                  <div key={item.classification} className="mb-2 flex justify-between rounded-lg bg-slate-800 p-3">
                    <span>{item.classification}</span><strong>{item.patent_count}</strong>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="mb-4 text-lg font-semibold">Patents by Legal Status</h2>
                {reports.patents_by_legal_status.map((item) => (
                  <div key={item.legal_status} className="mb-2 flex justify-between rounded-lg bg-slate-800 p-3">
                    <span>{item.legal_status}</span><strong>{item.patent_count}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="mb-4 text-lg font-semibold">Recently Added Patent Records</h2>
              {reports.recent_patents.map((patent) => (
                <article key={patent.publication_number} className="mb-3 rounded-xl bg-slate-800 p-4">
                  <p className="text-sm text-cyan-400">{patent.publication_number}</p>
                  <p className="mt-1 font-medium">{patent.title}</p>
                  <p className="mt-2 text-sm text-slate-400">Publication date: {patent.publication_date ?? "Not available"}</p>
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
