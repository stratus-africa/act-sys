import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  target_date: string | null;
  status: string;
  source_assessment_type: string | null;
  created_at: string;
};
export type Intervention = { id: string; goal_id: string; description: string; frequency: string | null; assigned_role: string | null; active: boolean };
export type Progress = { id: string; goal_id: string; note: string; status: string; recorded_at: string };

export function exportCarePlanPdf(opts: {
  patientName: string;
  patientMrn?: string | null;
  goals: Goal[];
  interventions: Intervention[];
  progress: Progress[];
}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  let y = margin;

  doc.setFontSize(18).setFont("helvetica", "bold").text("Care Plan", margin, y);
  y += 22;
  doc.setFontSize(11).setFont("helvetica", "normal");
  doc.text(`Patient: ${opts.patientName}`, margin, y); y += 14;
  if (opts.patientMrn) { doc.text(`MRN: ${opts.patientMrn}`, margin, y); y += 14; }
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y); y += 18;

  if (opts.goals.length === 0) {
    doc.setFontSize(10).setTextColor(120).text("No care goals on record.", margin, y);
    doc.save(`care-plan-${safeFilename(opts.patientName)}.pdf`);
    return;
  }

  for (const g of opts.goals) {
    if (y > 720) { doc.addPage(); y = margin; }
    doc.setFontSize(13).setFont("helvetica", "bold").setTextColor(20);
    doc.text(g.title, margin, y); y += 16;

    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(80);
    const meta = [
      `Status: ${g.status}`,
      `Priority: ${g.priority}`,
      g.category ? `Category: ${g.category}` : null,
      g.target_date ? `Target: ${g.target_date}` : null,
      g.source_assessment_type ? `Source: ${g.source_assessment_type}` : null,
    ].filter(Boolean).join("   ·   ");
    doc.text(meta, margin, y); y += 14;

    if (g.description) {
      const lines = doc.splitTextToSize(g.description, 520);
      doc.setTextColor(40).text(lines, margin, y);
      y += lines.length * 12 + 4;
    }

    const ints = opts.interventions.filter((i) => i.goal_id === g.id);
    if (ints.length) {
      autoTable(doc, {
        startY: y,
        head: [["Intervention", "Frequency", "Assigned"]],
        body: ints.map((i) => [i.description, i.frequency ?? "—", i.assigned_role ?? "—"]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [30, 30, 30] },
        margin: { left: margin, right: margin },
        theme: "grid",
      });
      // @ts-expect-error finalY added by autoTable
      y = (doc.lastAutoTable?.finalY ?? y) + 8;
    }

    const prog = opts.progress.filter((p) => p.goal_id === g.id);
    if (prog.length) {
      autoTable(doc, {
        startY: y,
        head: [["Date", "Status", "Note"]],
        body: prog.map((p) => [new Date(p.recorded_at).toLocaleDateString(), p.status, p.note]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [60, 90, 160] },
        margin: { left: margin, right: margin },
        theme: "striped",
      });
      // @ts-expect-error finalY added by autoTable
      y = (doc.lastAutoTable?.finalY ?? y) + 18;
    } else {
      y += 10;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(140);
    doc.text(`Page ${i} of ${pageCount}`, 540, 770, { align: "right" });
  }

  doc.save(`care-plan-${safeFilename(opts.patientName)}.pdf`);
}

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
}
