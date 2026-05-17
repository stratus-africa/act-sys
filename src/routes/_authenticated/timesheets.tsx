import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/timesheets")({
  component: () => (
    <>
      <PageHeader eyebrow="Phase 2" title="Provider Timesheets" />
      <ComingSoon module="Tasks reconciled against active care plan" />
    </>
  ),
});