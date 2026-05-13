import AdminShell from "@/components/AdminShell";

export default function GenerateDocumentLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
