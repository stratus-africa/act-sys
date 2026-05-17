import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { toast } from "sonner";
import { FileText, Download, Trash2, Upload, PenLine, Search, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/documents")({ component: Documents });

type Doc = {
  id: string; file_path: string; file_name: string; mime_type: string | null; size_bytes: number | null;
  category: string | null; uploaded_by: string | null; signature_url: string | null; signature_typed: string | null;
  signed_at: string | null; created_at: string;
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

// Roles allowed to sign each category. "*" = any authenticated user with upload access.
const CATEGORY_SIGN_ROLES: Record<string, string[]> = {
  clinical: ["admin", "rn"],
  consent: ["admin", "rn"],
  physician_orders: ["admin", "rn"],
  advance_directive: ["admin", "rn"],
  insurance: ["admin", "rn", "caregiver"],
  referral: ["admin", "rn"],
  lab: ["admin", "rn"],
  other: ["admin", "rn", "caregiver"],
};

function Documents() {
  const { patientId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const canUpload = primaryRole === "admin" || primaryRole === "rn" || primaryRole === "caregiver";
  const canDelete = primaryRole === "admin" || primaryRole === "rn";
  const role = primaryRole ?? "";
  const canSignCategory = (cat: string | null) => {
    const allowed = CATEGORY_SIGN_ROLES[cat ?? "other"] ?? ["admin", "rn"];
    return allowed.includes(role);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("clinical");
  const [sig, setSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSigned, setFilterSigned] = useState<"all" | "signed" | "unsigned">("all");
  const [signTarget, setSignTarget] = useState<Doc | null>(null);
  const [signSig, setSignSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [signing, setSigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("patient_documents").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Pick a file first");
    if (file.size > 20 * 1024 * 1024) return toast.error("File too large (max 20 MB)");
    setUploading(true);
    const path = `${patientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase.storage.from("patient-documents").upload(path, file, { contentType: file.type });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }

    let signatureUrl: string | null = null;
    if (sig.dataUrl) {
      const blob = await (await fetch(sig.dataUrl)).blob();
      const sigPath = `${patientId}/signatures/doc-${Date.now()}.png`;
      const sigUp = await supabase.storage.from("patient-documents").upload(sigPath, blob, { contentType: "image/png" });
      if (!sigUp.error) signatureUrl = sigPath;
    }
    const signed = !!(sig.dataUrl || sig.typed);
    const { error } = await supabase.from("patient_documents").insert({
      patient_id: patientId, file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
      category, uploaded_by: user?.id,
      signature_url: signatureUrl, signature_typed: sig.typed || null,
      signed_by: signed ? user?.id : null, signed_at: signed ? new Date().toISOString() : null,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded");
    setFile(null); setSig({ dataUrl: null, typed: "" });
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(d.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Could not get URL");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Delete "${d.file_name}"?`)) return;
    await supabase.storage.from("patient-documents").remove([d.file_path]);
    if (d.signature_url) await supabase.storage.from("patient-documents").remove([d.signature_url]);
    const { error } = await supabase.from("patient_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
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
    if (filterSigned === "signed" && !d.signed_at) return false;
    if (filterSigned === "unsigned" && d.signed_at) return false;
    if (search.trim() && !d.file_name.toLowerCase().includes(search.toLowerCase().trim())) return false;
    return true;
  });

  const signDocument = async () => {
    if (!signTarget) return;
    if (!signSig.dataUrl && !signSig.typed.trim()) { toast.error("Signature required"); return; }
    setSigning(true);
    let sigPath: string | null = null;
    if (signSig.dataUrl) {
      const blob = await (await fetch(signSig.dataUrl)).blob();
      const path = `${patientId}/signatures/doc-${signTarget.id}-${Date.now()}.png`;
      const up = await supabase.storage.from("patient-documents").upload(path, blob, { contentType: "image/png" });
      if (up.error) { setSigning(false); return toast.error(up.error.message); }
      sigPath = path;
    }
    const { error } = await supabase.from("patient_documents").update({
      signature_url: sigPath,
      signature_typed: signSig.typed.trim() || null,
      signed_by: user?.id,
      signed_at: new Date().toISOString(),
    }).eq("id", signTarget.id);
    setSigning(false);
    if (error) return toast.error(error.message);
    toast.success("Document signed");
    setSignTarget(null);
    setSignSig({ dataUrl: null, typed: "" });
    load();
  };

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
              <SignaturePad value={sig} onChange={setSig} label="Signature (optional)" />
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
              <option value="signed">Signed only</option>
              <option value="unsigned">Unsigned only</option>
            </select>
          </div>
        </div>
        {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
          : filteredDocs.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No documents match your filters.</div>
          : (
          <ul className="divide-y divide-border">
            {filteredDocs.map((d) => (
              <li key={d.id} className="px-6 py-4 flex items-center gap-4">
                <FileText className="size-5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{d.file_name}</div>
                  <div className="flex gap-3 text-[10px] font-mono uppercase text-muted-foreground mt-1 flex-wrap">
                    <span>{CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category}</span>
                    <span>{formatSize(d.size_bytes)}</span>
                    <span>{new Date(d.created_at).toLocaleDateString()}</span>
                    {d.signed_at
                      ? <span className="text-primary flex items-center gap-1"><CheckCircle2 className="size-3" />Signed {new Date(d.signed_at).toLocaleDateString()}</span>
                      : <span className="text-amber-600">Unsigned</span>}
                  </div>
                </div>
                {!d.signed_at && canSignCategory(d.category) && (
                  <button onClick={() => { setSignTarget(d); setSignSig({ dataUrl: null, typed: "" }); }} className="p-2 text-muted-foreground hover:text-primary" title="Sign"><PenLine className="size-4" /></button>
                )}
                <button onClick={() => download(d)} className="p-2 text-muted-foreground hover:text-primary" title="Download"><Download className="size-4" /></button>
                {canDelete && <button onClick={() => remove(d)} className="p-2 text-muted-foreground hover:text-alert-red" title="Delete"><Trash2 className="size-4" /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {signTarget && (
        <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={() => setSignTarget(null)}>
          <div className="bg-card border border-border w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Sign document</div>
              <h3 className="text-sm font-bold">{signTarget.file_name}</h3>
              <div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Signing as {role}</div>
            </div>
            <SignaturePad value={signSig} onChange={setSignSig} label="Your signature" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setSignTarget(null)} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={signDocument} disabled={signing} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{signing ? "Signing…" : "Sign document"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}