import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <>
      <PageHeader eyebrow="Settings" title="Account & Preferences" />
      <ComingSoon module="Profile, license, notifications" />
    </>
  ),
});