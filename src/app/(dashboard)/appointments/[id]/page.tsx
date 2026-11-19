// Legacy push links use /appointments/<id>; map them onto the query-based view.
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppointmentDeepLinkPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const child = typeof query.child === "string" ? query.child : undefined;
  const search = new URLSearchParams({ appointment: id });
  if (child) search.set("child", child);
  redirect(`/appointments?${search.toString()}`);
}
