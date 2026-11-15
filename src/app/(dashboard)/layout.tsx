import { getSession } from "@/core/auth/session.service";

import { SyncRegistryBridge } from "../sync-registry-bridge";

/**
 * Authenticated dashboard shell.
 *
 * The sync registry lives here (not in the global root layout) so it only runs
 * for signed-in pages and knows which account owns the outbox.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <>
      <SyncRegistryBridge userId={session?.uid} />
      {children}
    </>
  );
}
