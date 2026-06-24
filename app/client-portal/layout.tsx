import type { Metadata } from "next";
import ClientPortalNav from "./components/ClientPortalNav";
import ClientPortalPageBackground from "@/app/components/ClientPortalPageBackground";

export const metadata: Metadata = {
  title: "Client Portal — Axis Payroll System",
  description: "Read-only client view of payroll and HR data",
};

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`body > header { display: none !important; }`}</style>
      <div className="flex min-h-screen flex-col text-slate-900">
        <ClientPortalPageBackground />
        <ClientPortalNav />
        <div className="flex-1">{children}</div>
      </div>
    </>
  );
}
