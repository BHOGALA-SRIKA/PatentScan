// app/researcher/dashboard/page.tsx
"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Investigation {
  investigation_id: string;
  title: string;
  created_at: string;
}

export default function ResearcherDashboard() {
  const router = useRouter();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/investigations', { method: 'GET' });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Failed to load investigations');
          return;
        }
        setInvestigations(data.investigations || []);
      } catch (e) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreate = () => {
    router.push('/investigations/new');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-800 to-indigo-900 text-slate-100 p-8">
      <h1 className="text-4xl font-extrabold mb-6 text-center drop-shadow-lg">Researcher Dashboard</h1>
      {error && <p className="text-red-400 mb-4 text-center">{error}</p>}
      <div className="flex justify-center mb-6">
        <button
          onClick={handleCreate}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-lg font-medium transition-colors"
        >
          New Investigation
        </button>
      </div>
      {loading ? (
        <p className="text-center">Loading investigations…</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {investigations.map((inv) => (
            <li
              key={inv.investigation_id}
              className="bg-slate-700 bg-opacity-60 backdrop-blur-sm rounded-lg p-4 hover:scale-105 transform transition"
            >
              <h2 className="text-xl font-semibold mb-2">{inv.title}</h2>
              <p className="text-sm text-slate-300">Created: {new Date(inv.created_at).toLocaleDateString()}</p>
              <button
                onClick={() => router.push(`/investigations/${inv.investigation_id}`)}
                className="mt-3 inline-block text-indigo-300 hover:underline"
              >
                View Details →
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
