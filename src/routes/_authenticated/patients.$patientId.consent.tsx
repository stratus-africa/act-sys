import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { CheckboxRow, FormSection, FieldLabel, TextInput, RadioGroup } from "@/components/app/FormSection";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$patientId/consent")({ component: ConsentPage });

async function uploadSig(sig: SignatureValue, patientId: string, kind: string): Promise<string | null> {
  if (!sig.dataUrl) return null;
  const blob = await (await fetch(sig.dataUrl)).blob();
  const path = `${patientId}/${kind}-${Date.now()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
  if (error) { toast.error(error.message); return null; }
  return path;
}

function ConsentPage() {
  const { patientId } = Route.useParams();
  const [existing, setExisting] = useState<any>(null);
  const [hipaa, setHipaa] = useState<any>(null);

  const [c, setC] = useState({ services: false, emergency: false, payment: false, privacy: false, advance: false, ssn: "", startDate: "" });
  const [patientSig, setPatientSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [agencySig, setAgencySig] = useState<SignatureValue>({ dataUrl: null, typed: "" });

  const [h, setH] = useState({ provider: "", recipient: "", periodType: "range" as "range" | "all_time", start: "", end: "", extent: "full" as "full" | "full_with_exceptions", exMental: false, exComm: false, exSubstance: false, exOther: "", expDate: "", expEvent: "", printedName: "", relationship: "" });
  const [hipaaSig, setHipaaSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });

  useEffect(() => {
    supabase.from("patient_consents").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1).then(({ data }) => setExisting(data?.[0] ?? null));
    supabase.from("hipaa_authorizations").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1).then(({ data }) => setHipaa(data?.[0] ?? null));
  }, [patientId]);

  const submitConsent = async () => {
    if (!c.services || !c.emergency || !c.payment || !c.privacy) { toast.error("All four consent sections must be acknowledged."); return; }
    if (!patientSig.dataUrl && !patientSig.typed) { toast.error("Patient signature required."); return; }
    const pSig = await uploadSig(patientSig, patientId, "consent-patient");
    const aSig = await uploadSig(agencySig, patientId, "consent-agency");
    const { error } = await supabase.from("patient_consents").insert({
      patient_id: patientId,
      consent_services: c.services, consent_emergency: c.emergency, consent_payment: c.payment, consent_privacy: c.privacy,
      advance_directive: c.advance, ssn_full: c.ssn || null, start_of_care: c.startDate || null,
      patient_signature_url: pSig, patient_signature_typed: patientSig.typed || null,
      agency_signature_url: aSig, agency_signature_typed: agencySig.typed || null,
      signed_at: new Date().toISOString(), status: "complete",
    });
    if (error) toast.error(error.message); else { toast.success("Consent submitted"); window.location.reload(); }
  };

  const submitHipaa = async () => {
    if (!hipaaSig.dataUrl && !hipaaSig.typed) { toast.error("Signature required."); return; }
    const sig = await uploadSig(hipaaSig, patientId, "hipaa");
    const { error } = await supabase.from("hipaa_authorizations").insert({
      patient_id: patientId,
      provider_name: h.provider, recipient_name: h.recipient,
      period_type: h.periodType, start_date: h.start || null, end_date: h.end || null,
      extent: h.extent,
      exclude_mental_health: h.exMental, exclude_communicable: h.exComm, exclude_substance_abuse: h.exSubstance, exclude_other: h.exOther || null,
      expiry_date: h.expDate || null, expiry_event: h.expEvent || null,
      patient_signature_url: sig, patient_signature_typed: hipaaSig.typed || null,
      printed_name: h.printedName, relationship: h.relationship,
      signed_at: new Date().toISOString(), status: "complete",
    });
    if (error) toast.error(error.message); else { toast.success("HIPAA authorization submitted"); window.location.reload(); }
  };

  return (
    <div className="space-y-12 animate-entrance">
      <section className="border border-border bg-card p-8 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-extrabold tracking-tight">Consent for Services</h2>
          {existing?.status === "complete" && <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase">Complete · {new Date(existing.signed_at).toLocaleDateString()}</span>}
        </div>
        {existing?.status === "complete" ? (
          <p className="text-sm text-muted-foreground">Consent on file. Submitting a new form will create a new record.</p>
        ) : null}
        <FormSection title="Acknowledgments">
          <CheckboxRow label="I consent to receive home care services from American Care Team." checked={c.services} onChange={(v) => setC({ ...c, services: v })} />
          <CheckboxRow label="I authorize emergency medical services as needed." checked={c.emergency} onChange={(v) => setC({ ...c, emergency: v })} />
          <CheckboxRow label="I authorize payment for services rendered." checked={c.payment} onChange={(v) => setC({ ...c, payment: v })} />
          <CheckboxRow label="I have read the Statement of Patient Rights & Notice of Privacy Practices." checked={c.privacy} onChange={(v) => setC({ ...c, privacy: v })} />
        </FormSection>
        <FormSection title="Patient Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><FieldLabel>SSN</FieldLabel><TextInput value={c.ssn} onChange={(e) => setC({ ...c, ssn: e.target.value })} /></div>
            <div><FieldLabel>Start of care</FieldLabel><TextInput type="date" value={c.startDate} onChange={(e) => setC({ ...c, startDate: e.target.value })} /></div>
          </div>
          <CheckboxRow label="Patient has advance directives on file" checked={c.advance} onChange={(v) => setC({ ...c, advance: v })} />
          {c.advance && <p className="text-xs text-muted-foreground italic px-3">Note: Physician orders must accompany advance directives.</p>}
        </FormSection>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignaturePad label="Patient / Legal Representative Signature" value={patientSig} onChange={setPatientSig} />
          <SignaturePad label="Agency Representative Signature" value={agencySig} onChange={setAgencySig} />
        </div>
        <button onClick={submitConsent} className="bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold">Submit Consent</button>
      </section>

      <section className="border border-border bg-card p-8 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-extrabold tracking-tight">HIPAA Authorization</h2>
          {hipaa?.status === "complete" && <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase">Complete · {new Date(hipaa.signed_at).toLocaleDateString()}</span>}
        </div>
        <FormSection title="Parties">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><FieldLabel>Healthcare provider</FieldLabel><TextInput value={h.provider} onChange={(e) => setH({ ...h, provider: e.target.value })} /></div>
            <div><FieldLabel>Recipient</FieldLabel><TextInput value={h.recipient} onChange={(e) => setH({ ...h, recipient: e.target.value })} /></div>
          </div>
        </FormSection>
        <FormSection title="Effective period">
          <RadioGroup name="periodType" value={h.periodType} onChange={(v) => setH({ ...h, periodType: v })} options={[{ value: "range", label: "Date range" }, { value: "all_time", label: "All past, present and future periods" }]} />
          {h.periodType === "range" && (
            <div className="grid grid-cols-2 gap-4">
              <div><FieldLabel>Start</FieldLabel><TextInput type="date" value={h.start} onChange={(e) => setH({ ...h, start: e.target.value })} /></div>
              <div><FieldLabel>End</FieldLabel><TextInput type="date" value={h.end} onChange={(e) => setH({ ...h, end: e.target.value })} /></div>
            </div>
          )}
        </FormSection>
        <FormSection title="Extent of authorization">
          <RadioGroup name="extent" value={h.extent} onChange={(v) => setH({ ...h, extent: v })} options={[{ value: "full", label: "Full record" }, { value: "full_with_exceptions", label: "Full record with exceptions" }]} />
          {h.extent === "full_with_exceptions" && (
            <div className="space-y-2 pl-2">
              <CheckboxRow label="Exclude mental health records" checked={h.exMental} onChange={(v) => setH({ ...h, exMental: v })} />
              <CheckboxRow label="Exclude communicable disease records" checked={h.exComm} onChange={(v) => setH({ ...h, exComm: v })} />
              <CheckboxRow label="Exclude alcohol/drug abuse records" checked={h.exSubstance} onChange={(v) => setH({ ...h, exSubstance: v })} />
              <div><FieldLabel>Other exclusions</FieldLabel><TextInput value={h.exOther} onChange={(e) => setH({ ...h, exOther: e.target.value })} /></div>
            </div>
          )}
        </FormSection>
        <FormSection title="Expiration">
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>Expiry date</FieldLabel><TextInput type="date" value={h.expDate} onChange={(e) => setH({ ...h, expDate: e.target.value })} /></div>
            <div><FieldLabel>Or upon event</FieldLabel><TextInput value={h.expEvent} onChange={(e) => setH({ ...h, expEvent: e.target.value })} /></div>
          </div>
        </FormSection>
        <FormSection title="Signature">
          <p className="text-xs text-muted-foreground">I understand that I have the right to revoke this authorization in writing, and that my treatment is not conditioned upon signing.</p>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>Printed name</FieldLabel><TextInput value={h.printedName} onChange={(e) => setH({ ...h, printedName: e.target.value })} /></div>
            <div><FieldLabel>Relationship to patient</FieldLabel><TextInput value={h.relationship} onChange={(e) => setH({ ...h, relationship: e.target.value })} /></div>
          </div>
          <SignaturePad value={hipaaSig} onChange={setHipaaSig} />
        </FormSection>
        <button onClick={submitHipaa} className="bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold">Submit HIPAA Authorization</button>
      </section>
    </div>
  );
}
