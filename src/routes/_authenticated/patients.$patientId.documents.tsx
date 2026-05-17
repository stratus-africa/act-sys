import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { toast } from "sonner";
import { FileText, Download, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/documents")({ component: Documents });

type Doc = {
  id: string; file_path: string; file_name: string; mime_type: string | null; size_bytes: number | null;
  category: string | null; uploaded_by: string | null; signature_url: string | null; signature_typed: string | null;
  signed_at: string | null; created_at: string;
};

function Documents() {
  const { patientId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const canUpload = primaryRole === "admin" || primaryRole === "rn" || primaryRole === "caregiver";
  const canDelete = primaryRole === "admin" || primaryRole === "rn";

  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("clinical");
  const [sig, setSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [uploading, setUploading] = useState(false);

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
                    <option value="clinical">Clinical</option>
                    <option value="consent">Consent / HIPAA</option>
                    <option value="insurance">Insurance</option>
                    <option value="referral">Physician referral</option>
                    <option value="lab">Lab / imaging</option>
                    <option value="other">Other</option>
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
        <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">Files ({docs.length})</h3></div>
        {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
          : docs.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No documents uploaded yet.</div>
          : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="px-6 py-4 flex items-center gap-4">
                <FileText className="size-5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{d.file_name}</div>
                  <div className="flex gap-3 text-[10px] font-mono uppercase text-muted-foreground mt-1 flex-wrap">
                    <span>{d.category}</span>
                    <span>{formatSize(d.size_bytes)}</span>
                    <span>{new Date(d.created_at).toLocaleDateString()}</span>
                    {d.signed_at && <span className="text-primary">✓ Signed {new Date(d.signed_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <button onClick={() => download(d)} className="p-2 text-muted-foreground hover:text-primary" title="Download"><Download className="size-4" /></button>
                {canDelete && <button onClick={() => remove(d)} className="p-2 text-muted-foreground hover:text-alert-red" title="Delete"><Trash2 className="size-4" /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}