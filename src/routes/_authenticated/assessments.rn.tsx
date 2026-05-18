import { createFileRoute } from "@tanstack/react-router";
import { AssessmentList } from "@/components/app/AssessmentList";
export const Route = createFileRoute("/_authenticated/assessments/rn")({ component: () => <AssessmentList kind="rn" /> });