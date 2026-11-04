import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { ContentEditor } from "./content-editor";

export const metadata: Metadata = { title: "Content pages" };

/** Pages linked from the website footer; others can be added. */
const SUGGESTED = ["about", "terms", "privacy", "cancellations", "payments", "contact", "partners"];

export default async function ContentPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("content:manage")) {
    return <NoAccess what="content pages" permission="content:manage" />;
  }
  const { slug } = await searchParams;
  const api = await serverApi();
  const { items } = ensure(await api.GET("/api/v1/admin/pages"));
  const current =
    slug && items.some((p) => p.slug === slug)
      ? ensure(await api.GET("/api/v1/admin/pages/{slug}", { params: { path: { slug } } }))
      : null;
  const missing = SUGGESTED.filter((s) => !items.some((p) => p.slug === s));

  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow="Growth"
        title="Content pages"
        intro="Text pages on the website, such as About, Terms and Privacy. Plain text: leave a blank line between paragraphs and start a line with ## for a heading."
      />
      <ContentEditor
        key={current?.slug ?? slug ?? "new"}
        pages={items}
        current={current}
        newSlug={current ? null : (slug ?? missing[0] ?? "")}
        missing={missing}
        csrfToken={session.csrfToken}
      />
    </div>
  );
}
