import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/staff")({
  component: () => (
    <>
      <PageHeader eyebrow="Phase 2" title="Staff & Invitations" description="Admin-only management of RNs and caregivers." />
      <ComingSoon module="Staff invitations & role assignment" />
    </>
  ),
});