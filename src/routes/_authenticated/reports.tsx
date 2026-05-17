import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <>
      <PageHeader eyebrow="Phase 2" title="Reports" />
      <ComingSoon module="Compliance, census, and clinical outcome reports" />
    </>
  ),
});