"use client";

export default function PendingApprovalPage() {
  return (
    <main className="min-h-screen pg-bg p-8">
      <section className="mx-auto mt-24 max-w-lg rounded-[32px] border border-amber-200 bg-white p-8 shadow-sm">
        <div className="mb-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
          Pending Approval
        </div>

        <h1 className="text-2xl font-black text-slate-950">Account under review</h1>

        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Your Google account was recognized, but it has not been approved yet.
          Please wait for the Owner to assign your role before accessing the admin dashboard.
        </p>
      </section>
    </main>
  );
}