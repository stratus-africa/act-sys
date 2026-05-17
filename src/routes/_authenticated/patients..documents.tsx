import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, type AppRole } from "@/lib/use-current-user";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { FieldLabel, FormSection } from "@/components/app/FormSection";
import { toast } from "sonner";
import { FileText, Download, Trash2, Upload, PenLine, Search, CheckCircle2, Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/documents")({ component: Documents });

type Doc = {
  id: string; file_path: string; file_name: string; mime_type: string | null; size_bytes: number | null;
  category: string | null; uploaded_by: string | null; signed_at: string | null; created_at: string;
  required_signers: string[]; locked: boolean;
};
type DocSig = {
  id: string; document_id: string; signer_role: string; signer_id: string | null;
  signer_name: string | null; signature_url: string | null; signature_typed: string | null; signed_at: string;
};

const CATEGORIES = [
  { value: "clinical", label: "Clinical" },
  { value: "consent", label: "Consent / HIPAA" },
  { value: "insurance", label: "Insurance" },
  { value: "referral", label: "Physician referral" },
  { value: "lab", label: "Lab / imaging" },
  { value: "physician_orders", label: "Physician orders" },
  { value: "advance_directive", label: "Advance directive" },
  { value: "other", label: "Other" },
];

const SIGNER_ROLES = [
  { value: "rn", label: "RN" },
  { value: "participant", label: "Participant" },
  { value: "agency", label: "Agency" },
  { value: "physician", label: "Physician" },
  { value: "caregiver", label: "Caregiver" },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(SIGNER_ROLES.map((r) => [r.value, r.label]));

// Default required signers per category
const DEFAULT_REQUIRED: Record<string, string[]> = {
  clinical: ["rn", "participant"],
  consent: ["rn", "participant", "agency"],
  physician_orders: ["rn", "physician"],
  advance_directive: ["rn", "participant"],
  insurance: [],
  referral: ["rn"],
  lab: ["rn"],
  other: [],
};

// Which app roles can sign as each signer role
const APP_ROLE_TO_SIGNER: Record<AppRole, string[]> = {
  admin: ["rn", "agency", "physician", "caregiver"],
  rn: ["rn", "agency", "physician"],
  caregiver: ["caregiver"],
  patient: ["participant"],
};

function Documents() {
  const { patientId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const role = primaryRole ?? null;
  const canUpload = role === "admin" || role === "rn" || role === "caregiver";
  const canDelete = role === "admin" || role === "rn";

  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [sigs, setSigs] = useState<DocSig[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("clinical");
  const [requiredSigners, setRequiredSigners] = useState<string[]>(DEFAULT_REQUIRED.clinical);
  const [uploading, setUploading] = useState(false);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSigned, setFilterSigned] = useState<"all" | "locked" | "pending">("all");

  const [signTarget, setSignTarget] = useState<{ doc: Doc; signerRole: string } | null>(null);
  const [signSig, setSignSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [signing, setSigning] = useState(false);

  const [auditTarget, setAuditTarget] = useState<Doc | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: s }] = await Promise.all([
      supabase.from("patient_documents").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
      supabase.from("document_signatures").select("*").eq("patient_id", patientId).order("signed_at", { ascending: true }),
    ]);
    setDocs((d ?? []) as Doc[]);
    setSigs((s ?? []) as DocSig[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setRequiredSigners(DEFAULT_REQUIRED[category] ?? []); }, [category]);

  const sigsFor = (docId: string) => sigs.filter((s) => s.document_id === docId);
  const signedRoles = (docId: string) => new Set(sigsFor(docId).map((s) => s.signer_role));
  const isFullySigned = (d: Doc) => {
    if (d.required_signers.length === 0) return false;
    const signed = signedRoles(d.id);
    return d.required_signers.every((r) => signed.has(r));
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Pick a file first");
    if (file.size > 20 * 1024 * 1024) return toast.error("File too large (max 20 MB)");
    setUploading(true);
    const path = `${patientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase.storage.from("patient-documents").upload(path, file, { contentType: file.type });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }

    const { error } = await supabase.from("patient_documents").insert({
      patient_id: patientId, file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
      category, uploaded_by: user?.id, required_signers: requiredSigners,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(d.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Could not get URL");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: Doc) => {
    if (d.locked) return toast.error("Document is locked and cannot be deleted");
    if (!confirm(`Delete "${d.file_name}"?`)) return;
    await supabase.storage.from("patient-documents").remove([d.file_path]);
    const { error } = await supabase.from("patient_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const availableSignerRoles = (d: Doc): string[] => {
    if (!role) return [];
    const allowed = APP_ROLE_TO_SIGNER[role] ?? [];
    const signed = signedRoles(d.id);
    return d.required_signers.filter((r) => allowed.includes(r) && !signed.has(r));
  };

  const openSign = (doc: Doc, signerRole: string) => {
    setSignTarget({ doc, signerRole });
    setSignSig({ dataUrl: null, typed: "" });
  };

  const submitSignature = async () => {
    if (!signTarget) return;
    if (!signSig.dataUrl && !signSig.typed.trim()) return toast.error("Signature required");
    setSigning(true);
    let sigPath: string | null = null;
    if (signSig.dataUrl) {
      const blob = await (await fetch(signSig.dataUrl)).blob();
      const path = `${patientId}/signatures/${signTarget.doc.id}-${signTarget.signerRole}-${Date.now()}.png`;
      const up = await supabase.storage.from("patient-documents").upload(path, blob, { contentType: "image/png" });
      if (up.error) { setSigning(false); return toast.error(up.error.message); }
      sigPath = path;
    }
    const { error } = await supabase.from("document_signatures").insert({
      document_id: signTarget.doc.id, patient_id: patientId,
      signer_role: signTarget.signerRole, signer_id: user?.id, signer_name: user?.email ?? null,
      signature_url: sigPath, signature_typed: signSig.typed.trim() || null,
    });
    if (error) { setSigning(false); return toast.error(error.message); }

    // Recompute lock status after insert
    const newSigned = new Set([...signedRoles(signTarget.doc.id), signTarget.signerRole]);
    const allDone = signTarget.doc.required_signers.length > 0 && signTarget.doc.required_signers.every((r) => newSigned.has(r));
    if (allDone) {
      await supabase.from("patient_documents")
        .update({ locked: true, signed_at: new Date().toISOString(), signed_by: user?.id })
        .eq("id", signTarget.doc.id);
      toast.success("Document fully signed and locked");
    } else {
      toast.success(`Signed as ${ROLE_LABEL[signTarget.signerRole] ?? signTarget.signerRole}`);
    }
    setSigning(false);
    setSignTarget(null);
    setSignSig({ dataUrl: null, typed: "" });
    load();
  };

  const formatSize = (n: number | null) => {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const filteredDocs = docs.filter((d) => {
    if (filterCategory !== "all" && d.category !== filterCategory) return false;
    const locked = d.locked || isFullySigned(d);
    if (filterSigned === "locked" && !locked) return false;
    if (filterSigned === "pending" && locked) return false;
    if (search.trim() && !d.file_name.toLowerCase().includes(search.toLowerCase().trim())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {canUpload && (
        <div className="border border-border bg-card p-6 space-y-6">
          <FormSection title="Upload Document">
            <form onSubmit={upload} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>File (max 20 MB)</FieldLabel>
                  <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <FieldLabel>Required signers</FieldLabel>
                <div className="flex flex-wrap gap-3 mt-1">
                  {SIGNER_ROLES.map((r) => {
                    const checked = requiredSigners.includes(r.value);
                    return (
                      <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          setRequiredSigners(e.target.checked
                            ? [...requiredSigners, r.value]
                            : requiredSigners.filter((x) => x !== r.value));
                        }} />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] font-mono uppercase text-muted-foreground mt-2">
                  Document locks when every required signer has signed. Leave empty for reference-only files.
                </p>
              </div>
              <button type="submit" disabled={uploading} className="bg-primary text-primary-foreground px-6 py-2 text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                <Upload className="size-4" />{uploading ? "Uploading…" : "Upload"}
              </button>
            </form>
          </FormSection>
        </div>
      )}

      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest">Files ({filteredDocs.length} / {docs.length})</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search filename…" className="pl-7 pr-3 py-1.5 border border-border bg-background text-xs w-56" />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-2 py-1.5 border border-border bg-background text-xs">
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={filterSigned} onChange={(e) => setFilterSigned(e.target.value as any)} className="px-2 py-1.5 border border-border bg-background text-xs">
              <option value="all">Any status</option>
              <option value="locked">Fully signed</option>
              <option value="pending">Pending signatures</option>
            </select>
          </div>
        </div>
        {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
          : filteredDocs.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No documents match your filters.</div>
          : (
          <ul className="divide-y divide-border">
            {filteredDocs.map((d) => {
              const docSigs = sigsFor(d.id);
              const signed = signedRoles(d.id);
              const fully = isFullySigned(d) || d.locked;
              const canSignRoles = fully ? [] : availableSignerRoles(d);
              return (
                <li key={d.id} className="px-6 py-4 flex items-start gap-4">
                  <FileText className="size-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="font-semibold text-sm truncate">{d.file_name}</div>
                      {fully && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
                          <Lock className="size-3" /> Signed & Locked
                        </span>
                      )}
                      {!fully && d.required_signers.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                          Awaiting {d.required_signers.filter((r) => !signed.has(r)).map((r) => ROLE_LABEL[r] ?? r).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 text-[10px] font-mono uppercase text-muted-foreground flex-wrap">
                      <span>{CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category}</span>
                      <span>{formatSize(d.size_bytes)}</span>
                      <span>{new Date(d.created_at).toLocaleDateString()}</span>
                      {fully && d.signed_at && <span className="text-primary">Locked {new Date(d.signed_at).toLocaleString()}</span>}
                    </div>
                    {d.required_signers.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap pt-1">
                        {d.required_signers.map((r) => {
                          const sig = docSigs.find((s) => s.signer_role === r);
                          return (
                            <span key={r} className={"inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase " + (sig ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                              {sig ? <CheckCircle2 className="size-3" /> : <span className="size-2 rounded-full border border-muted-foreground/40" />}
                              {ROLE_LABEL[r] ?? r}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {fully && (
                      <div className="text-xs text-primary flex items-center gap-1.5 pt-1">
                        <ShieldCheck className="size-3.5" /> All required signatures captured. This document is read-only.
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canSignRoles.map((r) => (
                      <button key={r} onClick={() => openSign(d, r)} className="px-2 py-1 text-[10px] font-mono uppercase border border-border hover:bg-primary hover:text-primary-foreground flex items-center gap-1">
                        <PenLine className="size-3" /> Sign as {ROLE_LABEL[r] ?? r}
                      </button>
                    ))}
                    {docSigs.length > 0 && (
                      <button onClick={() => setAuditTarget(d)} className="p-2 text-muted-foreground hover:text-foreground" title="Signature audit trail">
                        <ShieldCheck className="size-4" />
                      </button>
                    )}
                    <button onClick={() => download(d)} className="p-2 text-muted-foreground hover:text-primary" title="Download"><Download className="size-4" /></button>
                    {canDelete && !fully && <button onClick={() => remove(d)} className="p-2 text-muted-foreground hover:text-alert-red" title="Delete"><Trash2 className="size-4" /></button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {signTarget && (
        <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={() => setSignTarget(null)}>
          <div className="bg-card border border-border w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Sign document as {ROLE_LABEL[signTarget.signerRole] ?? signTarget.signerRole}</div>
              <h3 className="text-sm font-bold">{signTarget.doc.file_name}</h3>
            </div>
            <SignaturePad value={signSig} onChange={setSignSig} label="Your signature" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setSignTarget(null)} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={submitSignature} disabled={signing} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{signing ? "Signing…" : "Submit signature"}</button>
            </div>
          </div>
        </div>
      )}

      {auditTarget && (
        <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={() => setAuditTarget(null)}>
          <div className="bg-card border border-border w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Signature Audit Trail</div>
                <h3 className="text-sm font-bold">{auditTarget.file_name}</h3>
              </div>
              <button onClick={() => setAuditTarget(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
            </div>
            <div className="overflow-y-auto">
              <ul className="divide-y divide-border">
                {sigsFor(auditTarget.id).map((s) => (
                  <li key={s.id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">{ROLE_LABEL[s.signer_role] ?? s.signer_role}</span>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">{new Date(s.signed_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{s.signer_name ?? s.signer_id ?? "—"}</div>
                    {s.signature_typed && <div className="text-sm italic mt-1" style={{ fontFamily: "cursive" }}>{s.signature_typed}</div>}
                  </li>
                ))}
                {sigsFor(auditTarget.id).length === 0 && <li className="p-6 text-xs text-muted-foreground text-center">No signatures yet.</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
