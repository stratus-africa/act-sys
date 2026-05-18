import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/assessments/")({
  beforeLoad: () => { throw redirect({ to: "/assessments/participant" }); },
});