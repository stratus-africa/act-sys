import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/visits")({
  component: () => (
    <>
      <PageHeader eyebrow="Phase 2" title="Visits & Scheduling" />
      <ComingSoon module="Visit workflow, check-in/out, GPS verification" />
    </>
  ),
});