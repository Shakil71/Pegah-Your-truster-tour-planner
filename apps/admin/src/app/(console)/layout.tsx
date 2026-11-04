import { AdminShell } from "@/components/admin-shell";
import { StaffProvider } from "@/components/staff-context";
import { requireStaff } from "@/lib/api-server";

/** Everything inside the console needs a staff session; the API re-checks every call. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());
  return (
    <StaffProvider session={session}>
      <AdminShell today={today}>{children}</AdminShell>
    </StaffProvider>
  );
}
