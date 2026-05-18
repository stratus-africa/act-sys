import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

function safeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
}

function header(doc: jsPDF, title: string, subtitle?: string) {
  const margin = 40;
  doc.setFontSize(18).setFont("helvetica", "bold").setTextColor(20).text(title, margin, margin);
  doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, margin + 16);
  if (subtitle) doc.text(subtitle, margin, margin + 30);
  return margin + (subtitle ? 50 : 36);
}

function pageNumbers(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(140);
    doc.text(`Page ${i} of ${n}`, 540, 770, { align: "right" });
  }
}

export async function exportPatientSummaryPdf(patientId: string) {
  const [p, fall, skin, rn, part, care, goals, prog, visits, allergies, consents] = await Promise.all([
    supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
    supabase.from("fall_risk_assessments").select("assessment_date,risk_level,total_score,signed_at:created_at").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(5),
    supabase.from("skin_assessments").select("assessment_date,status,signed_at").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(5),
    supabase.from("rn_assessments").select("assessment_date,signed_at,nurse_name").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(5),
    supabase.from("participant_assessments").select("assessment_date,visit_type,status,signed_at").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(5),
    supabase.from("caregiver_assessments").select("service_date,signed_at,caregiver_name").eq("patient_id", patientId).order("service_date", { ascending: false }).limit(5),
    supabase.from("care_plan_goals").select("id,title,status,priority,target_date").eq("patient_id", patientId),
    supabase.from("care_plan_progress").select("goal_id,status,note,recorded_at").eq("patient_id", patientId).order("recorded_at", { ascending: false }).limit(20),
    supabase.from("visits").select("scheduled_date,visit_type,status,check_in_at,check_out_at,start_miles,end_miles,verified_at,staff_id").eq("patient_id", patientId).order("scheduled_date", { ascending: false }).limit(20),
    supabase.from("patient_allergies").select("allergen,severity,reaction,active").eq("patient_id", patientId).eq("active", true),
    supabase.from("patient_consents").select("status,signed_at,created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
  ]);

  const patient = p.data;
  if (!patient) throw new Error("Patient not found");
  const fullName = `${patient.last_name}, ${patient.first_name}`;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = header(doc, "Patient Summary", fullName);
  const margin = 40;

  doc.setFontSize(10).setTextColor(40).setFont("helvetica", "normal");
  const demoLines = [
    patient.mrn ? `MRN: ${patient.mrn}` : null,
    patient.dob ? `DOB: ${patient.dob}` : null,
    patient.phone ? `Phone: ${patient.phone}` : null,
    patient.primary_physician ? `Physician: ${patient.primary_physician}` : null,
    patient.insurance_carrier ?? patient.insurance ? `Insurance: ${patient.insurance_carrier ?? patient.insurance}` : null,
    `Status: ${patient.status ?? "—"}`,
    patient.dnr_status ? "DNR: YES" : null,
  ].filter(Boolean) as string[];
  doc.text(demoLines.join("   ·   "), margin, y, { maxWidth: 520 });
  y += demoLines.length > 3 ? 28 : 18;

  const section = (title: string) => {
    if (y > 720) { doc.addPage(); y = margin; }
    doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(20).text(title, margin, y);
    y += 12;
  };

  section("Consents & HIPAA");
  const consent = consents.data?.[0];
  doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(60);
  doc.text(consent ? `Status: ${consent.status}  ·  Signed: ${consent.signed_at ? new Date(consent.signed_at).toLocaleDateString() : "—"}` : "No consent on file.", margin, y);
  y += 18;

  section("Allergies");
  if (!(allergies.data ?? []).length) {
    doc.setFontSize(9).setTextColor(120).text("No known allergies.", margin, y); y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Allergen", "Severity", "Reaction"]],
      body: (allergies.data ?? []).map((a: any) => [a.allergen, a.severity, a.reaction ?? "—"]),
      styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [30, 30, 30] },
      margin: { left: margin, right: margin }, theme: "grid",
    });
    // @ts-expect-error
    y = (doc.lastAutoTable?.finalY ?? y) + 14;
  }

  section("Recent Assessments");
  const rows: Array<[string, string, string, string]> = [];
  for (const r of (fall.data ?? [])) rows.push(["Fall Risk", r.assessment_date, `${r.risk_level} (${r.total_score})`, "—"]);
  for (const r of (skin.data ?? [])) rows.push(["Skin", r.assessment_date, r.status, r.signed_at ? "Signed" : "Draft"]);
  for (const r of (rn.data ?? [])) rows.push(["RN", r.assessment_date, r.nurse_name ?? "—", r.signed_at ? "Signed" : "Draft"]);
  for (const r of (part.data ?? [])) rows.push(["Participant", r.assessment_date, `${r.visit_type} · ${r.status}`, r.signed_at ? "Signed" : "Draft"]);
  for (const r of (care.data ?? [])) rows.push(["Caregiver", r.service_date, r.caregiver_name ?? "—", r.signed_at ? "Signed" : "Draft"]);
  if (rows.length === 0) {
    doc.setFontSize(9).setTextColor(120).text("No assessments on file.", margin, y); y += 18;
  } else {
    autoTable(doc, {
      startY: y, head: [["Type", "Date", "Result", "Status"]], body: rows,
      styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [60, 90, 160] },
      margin: { left: margin, right: margin }, theme: "striped",
    });
    // @ts-expect-error
    y = (doc.lastAutoTable?.finalY ?? y) + 14;
  }

  section("Care Plan Goals");
  if (!(goals.data ?? []).length) {
    doc.setFontSize(9).setTextColor(120).text("No goals on care plan.", margin, y); y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Goal", "Priority", "Status", "Target", "Recent progress"]],
      body: (goals.data ?? []).map((g: any) => {
        const recent = (prog.data ?? []).filter((p: any) => p.goal_id === g.id).slice(0, 1)[0];
        return [g.title, g.priority, g.status, g.target_date ?? "—", recent ? `${recent.status}: ${recent.note.slice(0, 60)}` : "—"];
      }),
      styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [30, 30, 30] },
      margin: { left: margin, right: margin }, theme: "grid",
    });
    // @ts-expect-error
    y = (doc.lastAutoTable?.finalY ?? y) + 14;
  }

  section("Recent Visits");
  if (!(visits.data ?? []).length) {
    doc.setFontSize(9).setTextColor(120).text("No visits recorded.", margin, y); y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Date", "Type", "Status", "Hours", "Miles", "Verified"]],
      body: (visits.data ?? []).map((v: any) => {
        const hrs = v.check_in_at && v.check_out_at
          ? ((new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 3600000).toFixed(2)
          : "—";
        const miles = v.start_miles != null && v.end_miles != null ? (Number(v.end_miles) - Number(v.start_miles)).toFixed(1) : "—";
        return [v.scheduled_date, v.visit_type, v.status, hrs, miles, v.verified_at ? "Yes" : "No"];
      }),
      styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [60, 90, 160] },
      margin: { left: margin, right: margin }, theme: "striped",
    });
  }

  pageNumbers(doc);
  doc.save(`patient-summary-${safeName(fullName)}.pdf`);
}

export async function exportVisitLogPdf(from: string, to: string) {
  const [{ data: visits }, { data: patients }, { data: staff }] = await Promise.all([
    supabase.from("visits").select("*").gte("scheduled_date", from).lte("scheduled_date", to).order("scheduled_date"),
    supabase.from("patients").select("id,first_name,last_name"),
    supabase.from("profiles").select("id,full_name,email"),
  ]);
  const pName = (id: string) => {
    const p = patients?.find((x: any) => x.id === id);
    return p ? `${p.last_name}, ${p.first_name}` : "—";
  };
  const sName = (id: string | null) => {
    if (!id) return "—";
    const s = staff?.find((x: any) => x.id === id);
    return s?.full_name ?? s?.email ?? "—";
  };

  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  header(doc, "Visit Log Report", `${from} to ${to}`);

  autoTable(doc, {
    startY: 110,
    head: [["Date", "Time", "Patient", "Staff", "Type", "Status", "Hours", "Miles", "Verified"]],
    body: (visits ?? []).map((v: any) => {
      const hrs = v.check_in_at && v.check_out_at ? ((new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 3600000).toFixed(2) : "—";
      const miles = v.start_miles != null && v.end_miles != null ? (Number(v.end_miles) - Number(v.start_miles)).toFixed(1) : "—";
      return [v.scheduled_date, v.scheduled_time ?? "—", pName(v.patient_id), sName(v.staff_id), v.visit_type, v.status, hrs, miles, v.verified_at ? "Yes" : "No"];
    }),
    styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [30, 30, 30] }, theme: "striped",
  });

  pageNumbers(doc);
  doc.save(`visit-log-${from}_to_${to}.pdf`);
}

export async function exportComplianceSnapshotPdf() {
  const [{ data: patients }, { data: consents }, { data: hipaa }, { data: fall }] = await Promise.all([
    supabase.from("patients").select("id,first_name,last_name,mrn,status").eq("status", "active"),
    supabase.from("patient_consents").select("patient_id,status"),
    supabase.from("hipaa_authorizations").select("patient_id,status"),
    supabase.from("fall_risk_assessments").select("patient_id,assessment_date").order("assessment_date", { ascending: false }),
  ]);

  const consentByPt = new Map<string, string>();
  for (const c of consents ?? []) if (!consentByPt.has(c.patient_id)) consentByPt.set(c.patient_id, c.status);
  const hipaaByPt = new Map<string, string>();
  for (const h of hipaa ?? []) if (!hipaaByPt.has(h.patient_id)) hipaaByPt.set(h.patient_id, h.status);
  const fallByPt = new Map<string, string>();
  for (const f of fall ?? []) if (!fallByPt.has(f.patient_id)) fallByPt.set(f.patient_id, f.assessment_date);

  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  header(doc, "Compliance Snapshot", `${(patients ?? []).length} active patients`);

  autoTable(doc, {
    startY: 110,
    head: [["Patient", "MRN", "Consent", "HIPAA", "Last Fall Risk", "Issues"]],
    body: (patients ?? []).map((p: any) => {
      const c = consentByPt.get(p.id) ?? "missing";
      const h = hipaaByPt.get(p.id) ?? "missing";
      const f = fallByPt.get(p.id);
      const issues: string[] = [];
      if (c !== "signed" && c !== "complete") issues.push("Consent");
      if (h !== "signed" && h !== "complete") issues.push("HIPAA");
      if (!f) issues.push("Fall Risk");
      return [`${p.last_name}, ${p.first_name}`, p.mrn ?? "—", c, h, f ?? "missing", issues.join(", ") || "OK"];
    }),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5 && data.cell.raw && data.cell.raw !== "OK") {
        data.cell.styles.textColor = [200, 30, 30];
        data.cell.styles.fontStyle = "bold";
      }
    },
    theme: "grid",
  });

  pageNumbers(doc);
  doc.save(`compliance-snapshot-${new Date().toISOString().slice(0, 10)}.pdf`);
}
