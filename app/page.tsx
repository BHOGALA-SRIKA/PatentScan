
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-5xl">

        <header className="text-center mb-14">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl font-bold shadow-md">
            P
          </div>

          <h1 className="text-4xl font-bold text-slate-900 mt-5">
            Patent<span className="text-blue-600">Scan</span>
          </h1>

          <p className="text-slate-500 mt-3">
            Hybrid Patent Prior-Art Search & Claim Analysis System
          </p>

          <h2 className="text-2xl font-semibold text-slate-800 mt-10">
            Welcome to PatentScan
          </h2>

          <p className="text-slate-500 mt-2">
            Please select your login type to continue.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-9 hover:shadow-lg transition">
            <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mb-6">
              ♙
            </div>

            <h3 className="text-2xl font-bold text-slate-900">
              User Sign In
            </h3>

            <p className="text-slate-500 leading-7 mt-3">
              Search patents, create investigations, analyze claims
              and explore relevant prior-art documents.
            </p>

            <Link
              href="/user-login"
              className="block text-center mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 transition"
            >
              Continue as User →
            </Link>

            <p className="text-center text-sm text-slate-500 mt-5">
              First time here?{" "}
              <Link href="/register" className="text-blue-600 font-semibold hover:underline">
                Create an account
              </Link>
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-9 hover:shadow-lg transition">
            <div className="w-14 h-14 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl mb-6">
              ♙
            </div>

            <h3 className="text-2xl font-bold text-slate-900">
              Admin Sign In
            </h3>

            <p className="text-slate-500 leading-7 mt-3">
              Access the PatentScan administrative dashboard
              and platform management features.
            </p>

            <Link
              href="/admin/login"
              className="block text-center mt-8 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl py-3 transition"
            >
              Continue as Admin →
            </Link>
          </section>

        </div>

        <footer className="text-center text-sm text-slate-400 mt-12">
          PatentScan · Intelligent Patent Discovery
        </footer>

      </div>
    </main>
  );
}
