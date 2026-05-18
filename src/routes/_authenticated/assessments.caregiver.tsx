import { createFileRoute } from "@tanstack/react-router";
import { AssessmentList } from "@/components/app/AssessmentList";
export const Route = createFileRoute("/_authenticated/assessments/caregiver")({ component: () => <AssessmentList kind="caregiver" /> });