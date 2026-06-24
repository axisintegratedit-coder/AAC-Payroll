import ClientPortalPayrollRunDetail from "./Detail";

// IDs are resolved client-side from Firestore via useParams(); emit a single
// placeholder route so `output: export` can prerender the [id] shell.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <ClientPortalPayrollRunDetail />;
}
