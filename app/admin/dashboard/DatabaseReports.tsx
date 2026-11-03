
"use client";

import { useCallback, useEffect, useState } from "react";

type TrendItem = {
  month: string;
  patent_count?: number;
  user_count?: number;
  search_count?: number;
};

type Reports = {
  period: string;
  total_patents: number;
  classified_patents: number;
  ipc_records: number;
  cpc_records: number;
  total_embeddings: number;

  patents_by_classification: {
    classification: string;
    patent_count: number;
  }[];

  patents_by_legal_status: {
    legal_status: string;
    patent_count: number;
  }[];

  publication_trend: TrendItem[];

  recent_patents: {
    publication_number: string;
    title: string;
    publication_date: string | null;
  }[];

  data_quality: {
    missing_ipc: number;
    missing_cpc: number;
    missing_abstract: number;
    missing_publication_date: number;
  };

  user_analytics: {
    total_users: number;
    regular_users: number;
    admin_users: number;
    users_by_role: {
      role: string;
      user_count: number;
    }[];
    registration_trend: TrendItem[];
  };

  search_analytics: {
    total_searches: number;
    users_who_searched: number;
    average_duration_ms: number;
    total_results: number;
    monthly_trend: TrendItem[];
    search_types: {
      search_type: string;
      search_count: number;
    }[];
  };

  investigation_analytics: {
    total_investigations: number;
    users_with_investigations: number;
    statuses: {
      status: string;
      investigation_count: number;
    }[];
  };
};

const numberFormat = new Intl.NumberFormat("en-IN");

const statusColors: Record<string, string> = {
  Active: "#10b981",
  Pending: "#f59e0b",
  Abandoned: "#ef4444",
  Withdrawn: "#8b5cf6",
  Ceased: "#f97316",
  Granted: "#06b6d4",
  Unknown: "#94a3b8",
};

function MetricCard({
  label,
  value,
  description,
  color = "text-cyan-400",
}: {
  label: string;
  value: number;
  description: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${color}`}>
        {numberFormat.format(value ?? 0)}
      </p>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function BarList({
  items,
  labelKey,
  valueKey,
  color = "#06b6d4",
}: {
  items: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  const max = Math.max(
    1,
    ...items.map((item) => Number(item[valueKey]) || 0)
  );

  if (!items.length) {
    return (
      <p className="py-6 text-sm text-slate-400">
        No data available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const value = Number(item[valueKey]) || 0;

        return (
          <div key={`${String(item[labelKey])}-${index}`}>
            <div className="mb-2 flex justify-between gap-3 text-sm">
              <span className="text-slate-700">
                {item[labelKey]}
              </span>
              <strong className="text-slate-600">
                {numberFormat.format(value)}
              </strong>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(value / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PublicationChart({ data }: { data: TrendItem[] }) {
  const width = 760;
  const height = 260;
  const left = 48;
  const right = 20;
  const top = 20;
  const bottom = 45;

  const max = Math.max(
    1,
    ...data.map((item) => item.patent_count ?? 0)
  );

  const points = data.map((item, index) => {
    const x =
      left +
      (index / Math.max(data.length - 1, 1)) *
        (width - left - right);

    const y =
      top +
      (1 - (item.patent_count ?? 0) / max) *
        (height - top - bottom);

    return { x, y, item };
  });

  const path = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  if (!data.length) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        No publication trend data available.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[500px]"
        role="img"
        aria-label="Monthly patent publication trend"
      >
        {[0, 1, 2, 3].map((step) => {
          const y =
            top +
            (step / 3) * (height - top - bottom);

          return (
            <g key={step}>
              <line
                x1={left}
                y1={y}
                x2={width - right}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x={left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {Math.round(max * (1 - step / 3))}
              </text>
            </g>
          );
        })}

        <path
          d={path}
          fill="none"
          stroke="#0891b2"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <g key={point.item.month}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#0891b2"
            />
            <title>
              {point.item.month}: {point.item.patent_count} patents
            </title>

            {(index === 0 ||
              index === points.length - 1 ||
              index % Math.max(1, Math.floor(points.length / 5)) === 0) && (
              <text
                x={point.x}
                y={height - 15}
                fontSize="10"
                fill="#64748b"
                textAnchor="middle"
              >
                {point.item.month}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}


function PieChart({
  items,
  labelKey,
  valueKey,
}: {
  items: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
}) {
  const total = items.reduce(
    (sum, item) => sum + Number(item[valueKey] || 0),
    0
  );

  let current = 0;

  const colors = [
    "#0891b2",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#64748b",
    "#ec4899",
  ];

  const segments = items.map((item, index) => {
    const value = Number(item[valueKey] || 0);
    const start = current;
    current += total ? (value / total) * 100 : 0;

    return {
      label: String(item[labelKey]),
      value,
      color: colors[index % colors.length],
      start,
      end: current,
    };
  });

  if (!total) {
    return <p className="text-sm text-slate-400">No data available.</p>;
  }

  const gradient = segments
    .map(s => `${s.color} ${s.start}% ${s.end}%`)
    .join(", ");

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="h-40 w-40 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label="Distribution chart"
      >
        <div className="m-auto mt-11 flex h-18 w-18 items-center justify-center rounded-full bg-white text-center">
          <span className="text-lg font-bold text-slate-800">
            {numberFormat.format(total)}
          </span>
        </div>
      </div>

      <div className="min-w-[140px] flex-1 space-y-3">
        {segments.map(item => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
            <strong className="text-slate-800">
              {item.value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({
  items,
  labelKey,
  valueKey,
}: {
  items: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(
    1,
    ...items.map(item => Number(item[valueKey]) || 0)
  );

  if (!items.length) {
    return <p className="text-sm text-slate-400">No data available.</p>;
  }

  return (
    <div className="flex h-52 items-end gap-2 overflow-x-auto border-b border-slate-200 px-2">
      {items.map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const height = Math.max(3, (value / max) * 100);

        return (
          <div
            key={`${String(item[labelKey])}-${index}`}
            className="flex h-full min-w-9 flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="text-xs font-semibold text-slate-600">
              {value}
            </span>
            <div
              className="w-full max-w-12 rounded-t-md bg-cyan-600"
              style={{ height: `${height}%` }}
              title={`${item[labelKey]}: ${value}`}
            />
            <span className="max-w-16 truncate text-[10px] text-slate-500">
              {item[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}



export default function DatabaseReports() {
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");

  const loadReports = useCallback(async (selectedPeriod = period) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/patents/reports?period=${selectedPeriod}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load reports.");
      }

      setReports(data as Reports);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics."
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadReports(period);

    // Refresh aggregate reports every 30 seconds without changing the selected period.
    const refreshTimer = window.setInterval(() => {
      void loadReports(period);
    }, 30_000);

    return () => window.clearInterval(refreshTimer);
  }, [loadReports, period]);

  if (loading && !reports) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading PatentScan analytics...</p>
      </main>
    );
  }

  if (error && !reports) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6">
          <h1 className="text-xl font-bold text-red-600">
            Unable to load analytics
          </h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            onClick={() => void loadReports()}
            className="mt-5 rounded-lg bg-cyan-600 px-4 py-2 text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!reports) return null;

  const classifiedPercentage = reports.total_patents
    ? Math.round(
        (reports.classified_patents / reports.total_patents) * 100
      )
    : 0;

  const statusItems = reports.patents_by_legal_status.map((item) => ({
    ...item,
    color: statusColors[item.legal_status] ?? "#64748b",
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              PatentScan Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Analytics Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Patent database, user activity and system insights.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(event) => {
                const value = event.target.value;
                setPeriod(value);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="1y">Last 1 year</option>
              <option value="3y">Last 3 years</option>
              <option value="5y">Last 5 years</option>
              <option value="all">All time</option>
            </select>

            <button
              onClick={() => void loadReports()}
              disabled={loading}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* PATENT ANALYTICS */}
        <section className="space-y-4">
          <SectionTitle
            title="Patent Database Overview"
            subtitle="Key metrics from the shared patent database."
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total patents"
              value={reports.total_patents}
              description="Patent records"
            />
            <MetricCard
              label="Classified patents"
              value={reports.classified_patents}
              description={`${classifiedPercentage}% classification coverage`}
              color="text-emerald-600"
            />
            <MetricCard
              label="Patent embeddings"
              value={reports.total_embeddings}
              description="Distinct embedded patents"
              color="text-violet-600"
            />
            <MetricCard
              label="CPC records"
              value={reports.cpc_records}
              description={`${reports.ipc_records} records with IPC`}
              color="text-amber-600"
            />
          </div>
        </section>

        {/* PUBLICATION TREND */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionTitle
            title="Patent Publication Trend"
            subtitle="Monthly patent publications based on publication date."
          />
          <div className="mt-5">
            <PublicationChart data={reports.publication_trend} />
          </div>
        </section>

        {/* CLASSIFICATION AND STATUS */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle
              title="Top Technology Areas"
              subtitle="Top IPC/CPC subclasses by distinct patent count."
            />
            <div className="mt-6">
              <BarList
                items={reports.patents_by_classification}
                labelKey="classification"
                valueKey="patent_count"
                color="#0891b2"
              />
            </div>
            <p className="mt-5 text-xs text-slate-400">
              A patent can belong to multiple technology subclasses.
              Counts may overlap.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle
              title="Legal Status Distribution"
              subtitle="Recognised legal-status categories."
            />
            <div className="mt-6 space-y-4">
              {statusItems.map((item) => (
                <div key={item.legal_status}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{item.legal_status}</span>
                    <strong>{item.patent_count}</strong>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${
                          (item.patent_count /
                            Math.max(1, reports.total_patents)) *
                          100
                        }%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        
{/* USER ANALYTICS */}
<section className="space-y-4">
  <h2 className="text-xl font-bold">User Analytics</h2>

  <div className="grid gap-5 lg:grid-cols-2">
    <div className="rounded-2xl border bg-white p-5">
      <h3 className="mb-5 font-semibold">User Distribution</h3>
      <PieChart
        items={reports.user_analytics.users_by_role}
        labelKey="role"
        valueKey="user_count"
      />
    </div>

    <div className="rounded-2xl border bg-white p-5">
      <h3 className="mb-5 font-semibold">Monthly Registrations</h3>
      <BarChart
        items={reports.user_analytics.registration_trend}
        labelKey="month"
        valueKey="user_count"
      />
    </div>

    <div className="rounded-2xl border bg-white p-5">
      <h3 className="mb-5 font-semibold">Search Type Distribution</h3>
      <PieChart
        items={reports.search_analytics.search_types}
        labelKey="search_type"
        valueKey="search_count"
      />
    </div>

    <div className="rounded-2xl border bg-white p-5">
      <h3 className="mb-5 font-semibold">Monthly Search Activity</h3>
      <BarChart
        items={reports.search_analytics.monthly_trend}
        labelKey="month"
        valueKey="search_count"
      />
    </div>

    <div className="rounded-2xl border bg-white p-5">
      <h3 className="mb-5 font-semibold">Investigation Status</h3>
      <PieChart
        items={reports.investigation_analytics.statuses}
        labelKey="status"
        valueKey="investigation_count"
      />
    </div>

    <div className="rounded-2xl border bg-white p-5">
      <h3 className="mb-5 font-semibold">Top Technology Areas</h3>
      <BarChart
        items={reports.patents_by_classification}
        labelKey="classification"
        valueKey="patent_count"
      />
    </div>
  </div>
</section>

{/* LEGAL STATUS */}
<section className="rounded-2xl border bg-white p-5">
  <h2 className="mb-5 text-xl font-bold">
    Patent Legal Status Distribution
  </h2>
  <PieChart
    items={reports.patents_by_legal_status}
    labelKey="legal_status"
    valueKey="patent_count"
  />
</section>

{/* PUBLICATION TREND */}
<section className="rounded-2xl border bg-white p-5">
  <h2 className="mb-5 text-xl font-bold">
    Patent Publication Activity
  </h2>
  <BarChart
    items={reports.publication_trend}
    labelKey="month"
    valueKey="patent_count"
  />
</section>


        {/* DATA QUALITY */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionTitle
            title="Database Quality"
            subtitle="Missing metadata in patent records."
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Missing IPC", reports.data_quality.missing_ipc],
              ["Missing CPC", reports.data_quality.missing_cpc],
              ["Missing abstracts", reports.data_quality.missing_abstract],
              [
                "Missing publication dates",
                reports.data_quality.missing_publication_date,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-amber-600">
                  {numberFormat.format(Number(value))}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm">
              <span>Classification coverage</span>
              <strong>{classifiedPercentage}%</strong>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-emerald-500"
                style={{ width: `${classifiedPercentage}%` }}
              />
            </div>
          </div>
        </section>

        {/* RECENT PATENTS */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <SectionTitle
              title="Recently Published Patents"
              subtitle="Latest 10 records by publication date."
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Publication number</th>
                  <th className="px-5 py-4">Patent title</th>
                  <th className="px-5 py-4">Publication date</th>
                </tr>
              </thead>
              <tbody>
                {reports.recent_patents.map((patent) => (
                  <tr
                    key={patent.publication_number}
                    className="border-t border-slate-100"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-cyan-700">
                      {patent.publication_number}
                    </td>
                    <td className="min-w-[250px] px-5 py-4 text-slate-700">
                      {patent.title}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {patent.publication_date
                        ? new Date(
                            patent.publication_date
                          ).toLocaleDateString("en-IN")
                        : "Unavailable"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        

      </div>
    </main>
  );
}
