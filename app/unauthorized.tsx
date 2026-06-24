"use client";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen pg-bg p-8">
      <section className="mx-auto mt-24 max-w-lg rounded-[32px] border border-rose-200 bg-white p-8 shadow-sm">
        <div className="mb-4 inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-rose-700">
          Unauthorized
        </div>

        <h1 className="text-2xl font-black text-slate-950">Access not allowed</h1>

        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Your account does not have permission to access this page. Please contact the Owner if you believe this is a mistake.
        </p>
      </section>
    </main>
  );
}