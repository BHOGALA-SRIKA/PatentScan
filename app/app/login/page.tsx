import Link from "next/link";

export default function LoginChoicePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-3xl font-bold">Patent<span className="text-cyan-400">Scan</span></h1>
        <p className="mt-2 text-slate-400">Choose how you want to sign in.</p>
        <div className="mt-8 grid gap-4">
          <Link href="/user-login" className="rounded-xl bg-cyan-500 px-5 py-4 text-center font-semibold text-slate-950 hover:bg-cyan-400">
            User / Researcher Login
          </Link>
          <Link href="/admin/login" className="rounded-xl border border-slate-700 px-5 py-4 text-center font-semibold text-slate-200 hover:bg-slate-800">
            Admin Login
          </Link>
        </div>
      </section>
    </main>
  );
}
