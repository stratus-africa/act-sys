import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { notifyAdminsAndRns } from "@/lib/notify";
import { toast } from "sonner";
import { FileText, Download, Trash2, Upload, PenLine, Search, CheckCircle2, History, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/documents")({ component: Documents });

type Doc = {
  id: string; file_path: string; file_name: string; mime_type: string | null; size_bytes: number | null;
  category: string | null; uploaded_by: string | null; signature_url: string | null; signature_typed: string | null;
  signed_at: string | null; created_at: string; current_version: number | null;
};
type Version = {
  id: string; document_id: string; patient_id: string; version: number; file_path: string; file_name: string;
  mime_type: string | null; size_bytes: number | null; uploaded_by: string | null; change_note: string | null; created_at: string;
};
type AuditLog = {
  id: string; table_name: string; record_id: string; action: string; changed_at: string; changed_by: string | null;
};

const CATEGORIES = [
  { value: "clinical", label: "Clinical" },
  { value: "consent", label: "Consent / HIPAA" },
  { value: "insurance", label: "Insurance" },
  { value: "id_card", label: "ID card" },
  { value: "referral", label: "Physician referral" },
  { value: "lab", label: "Lab / imaging" },
  { value: "physician_orders", label: "Physician orders" },
  { value: "advance_directive", label: "Advance directive" },
  { value: "other", label: "Other" },
];

const CATEGORY_SIGN_ROLES: Record<string, string[]> = {
  clinical: ["admin", "rn"],
  consent: ["admin", "rn"],
  physician_orders: ["admin", "rn"],
  advance_directive: ["admin", "rn"],
  insurance: ["admin", "rn", "caregiver"],
  id_card: ["admin", "rn", "caregiver"],
  referral: ["admin", "rn"],
  lab: ["admin", "rn"],
  other: ["admin", "rn", "caregiver"],
};

function Documents() {
  const { patientId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const canUpload = primaryRole === "admin" || primaryRole === "rn" || primaryRole === "caregiver";
  const canDelete = primaryRole === "admin" || primaryRole === "rn";
  const canViewAudit = primaryRole === "admin" || primaryRole === "rn";
  const role = primaryRole ?? "";
  const canSignCategory = (cat: string | null) =>
    (CATEGORY_SIGN_ROLES[cat ?? "other"] ?? ["admin", "rn"]).includes(role);

  const fileRef = useRef<HTMLInputElement>(null);
  const newVersionRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
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
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [newVersionFor, setNewVersionFor] = useState<Doc | null>(null);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionNote, setNewVersionNote] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<AuditLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ds }, { data: vs }] = await Promise.all([
      supabase.from("patient_documents").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
      supabase.from("patient_document_versions").select("*").eq("patient_id", patientId).order("version", { ascending: false }),
    ]);
    setDocs((ds ?? []) as Doc[]);
    setVersions((vs ?? []) as Version[]);
    setLoading(false);
  }, [patientId]);

  const loadAudit = useCallback(async () => {
    if (!canViewAudit) return;
    const docIds = docs.map((d) => d.id);
    if (!docIds.length) return setAudit([]);
    const { data } = await supabase
      .from("audit_logs")
      .select("id,table_name,record_id,action,changed_at,changed_by")
      .in("table_name", ["patient_documents", "patient_document_versions"])
      .in("record_id", [...docIds, ...versions.map((v) => v.id)])
      .order("changed_at", { ascending: false })
      .limit(100);
    setAudit((data ?? []) as AuditLog[]);
  }, [docs, versions, canViewAudit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (auditOpen) loadAudit(); }, [auditOpen, loadAudit]);

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
    const { data: docRow, error } = await supabase.from("patient_documents").insert({
      patient_id: patientId, file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
      category, uploaded_by: user?.id, current_version: 1,
      signature_url: signatureUrl, signature_typed: sig.typed || null,
      signed_by: signed ? user?.id : null, signed_at: signed ? new Date().toISOString() : null,
    }).select().single();
    if (error || !docRow) { setUploading(false); return toast.error(error?.message ?? "Failed"); }

    await supabase.from("patient_document_versions").insert({
      document_id: docRow.id, patient_id: patientId, version: 1,
      file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
      uploaded_by: user?.id, change_note: "Initial upload",
    });

    setUploading(false);
    toast.success("Document uploaded");
    notifyAdminsAndRns({
      kind: "document_uploaded",
      title: "New patient document uploaded",
      body: `${file.name} (${CATEGORIES.find((c) => c.value === category)?.label ?? category})`,
      link: `/patients/${patientId}/documents`,
      metadata: { document_id: docRow.id, patient_id: patientId },
    });
    setFile(null); setSig({ dataUrl: null, typed: "" });
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const uploadNewVersion = async () => {
    if (!newVersionFor || !newVersionFile) return;
    if (newVersionFile.size > 20 * 1024 * 1024) return toast.error("File too large (max 20 MB)");
    setUploading(true);
    const nextVersion = (newVersionFor.current_version ?? 1) + 1;
    const path = `${patientId}/${Date.now()}-v${nextVersion}-${newVersionFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase.storage.from("patient-documents").upload(path, newVersionFile, { contentType: newVersionFile.type });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }

    const [{ error: insErr }, { error: updErr }] = await Promise.all([
      supabase.from("patient_document_versions").insert({
        document_id: newVersionFor.id, patient_id: patientId, version: nextVersion,
        file_path: path, file_name: newVersionFile.name, mime_type: newVersionFile.type,
        size_bytes: newVersionFile.size, uploaded_by: user?.id, change_note: newVersionNote || null,
      }),
      supabase.from("patient_documents").update({
        file_path: path, file_name: newVersionFile.name, mime_type: newVersionFile.type,
        size_bytes: newVersionFile.size, current_version: nextVersion,
      }).eq("id", newVersionFor.id),
    ]);
    setUploading(false);
    if (insErr || updErr) return toast.error(insErr?.message ?? updErr?.message ?? "Failed");
    toast.success(`Saved as v${nextVersion}`);
    setNewVersionFor(null); setNewVersionFile(null); setNewVersionNote("");
    if (newVersionRef.current) newVersionRef.current.value = "";
    load();
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "Could not get URL");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Delete "${d.file_name}" and all its versions?`)) return;
    const docVersions = versions.filter((v) => v.document_id === d.id);
    await supabase.storage.from("patient-documents").remove([d.file_path, ...docVersions.map((v) => v.file_path)]);
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

  const toggleVersions = (id: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
            {canViewAudit && (
              <button onClick={() => setAuditOpen((v) => !v)} className="px-2 py-1.5 border border-border bg-background text-xs font-mono uppercase hover:bg-muted flex items-center gap-1">
                <History className="size-3" /> Audit
              </button>
            )}
          </div>
        </div>
        {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
          : filteredDocs.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No documents match your filters.</div>
          : (
          <ul className="divide-y divide-border">
            {filteredDocs.map((d) => {
              const docVersions = versions.filter((v) => v.document_id === d.id);
              const expanded = expandedVersions.has(d.id);
              return (
                <li key={d.id} className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <FileText className="size-5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {d.file_name}
                        {(d.current_version ?? 1) > 1 && (
                          <span className="ml-2 text-[10px] font-mono uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">v{d.current_version}</span>
                        )}
                      </div>
                      <div className="flex gap-3 text-[10px] font-mono uppercase text-muted-foreground mt-1 flex-wrap">
                        <span>{CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category ?? "Uncategorized"}</span>
                        <span>{formatSize(d.size_bytes)}</span>
                        <span>{new Date(d.created_at).toLocaleDateString()}</span>
                        {d.signed_at
                          ? <span className="text-primary flex items-center gap-1"><CheckCircle2 className="size-3" />Signed {new Date(d.signed_at).toLocaleDateString()}</span>
                          : <span className="text-amber-600">Unsigned</span>}
                      </div>
                    </div>
                    {docVersions.length > 0 && (
                      <button onClick={() => toggleVersions(d.id)} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <History className="size-3" /> {docVersions.length} <ChevronDown className={"size-3 transition-transform " + (expanded ? "rotate-180" : "")} />
                      </button>
                    )}
                    {canUpload && (
                      <button onClick={() => setNewVersionFor(d)} className="p-2 text-muted-foreground hover:text-primary" title="Upload new version"><Upload className="size-4" /></button>
                    )}
                    {!d.signed_at && canSignCategory(d.category) && (
                      <button onClick={() => { setSignTarget(d); setSignSig({ dataUrl: null, typed: "" }); }} className="p-2 text-muted-foreground hover:text-primary" title="Sign"><PenLine className="size-4" /></button>
                    )}
                    <button onClick={() => download(d.file_path)} className="p-2 text-muted-foreground hover:text-primary" title="Download"><Download className="size-4" /></button>
                    {canDelete && <button onClick={() => remove(d)} className="p-2 text-muted-foreground hover:text-alert-red" title="Delete"><Trash2 className="size-4" /></button>}
                  </div>
                  {expanded && docVersions.length > 0 && (
                    <div className="ml-9 mt-3 border-l-2 border-border pl-4 space-y-2">
                      {docVersions.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 text-xs">
                          <span className="font-mono text-primary font-bold">v{v.version}</span>
                          <span className="flex-1 truncate text-foreground/80">{v.file_name}</span>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground">{formatSize(v.size_bytes)}</span>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                          {v.change_note && <span className="text-[10px] italic text-muted-foreground max-w-xs truncate">"{v.change_note}"</span>}
                          <button onClick={() => download(v.file_path)} className="text-muted-foreground hover:text-primary"><Download className="size-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {auditOpen && canViewAudit && (
        <div className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h3 className="text-xs font-bold uppercase tracking-widest">Audit Trail (last 100 changes)</h3>
          </div>
          {audit.length === 0 ? (
            <div className="p-6 text-xs text-muted-foreground text-center">No changes recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
                <tr><th className="px-4 py-2 text-left">When</th><th className="px-4 py-2 text-left">Table</th><th className="px-4 py-2 text-left">Action</th><th className="px-4 py-2 text-left">Record</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{new Date(a.changed_at).toLocaleString()}</td>
                    <td className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground">{a.table_name}</td>
                    <td className="px-4 py-2"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + (a.action === "INSERT" ? "bg-green-100 text-green-700" : a.action === "UPDATE" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700")}>{a.action}</span></td>
                    <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground truncate max-w-xs">{a.record_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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

      {newVersionFor && (
        <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={() => setNewVersionFor(null)}>
          <div className="bg-card border border-border w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Upload new version</div>
              <h3 className="text-sm font-bold">{newVersionFor.file_name}</h3>
              <div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Current: v{newVersionFor.current_version ?? 1} → new: v{(newVersionFor.current_version ?? 1) + 1}</div>
            </div>
            <div><FieldLabel>New file</FieldLabel>
              <input ref={newVersionRef} type="file" onChange={(e) => setNewVersionFile(e.target.files?.[0] ?? null)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
            </div>
            <div><FieldLabel>What changed?</FieldLabel>
              <TextInput value={newVersionNote} onChange={(e) => setNewVersionNote(e.target.value)} placeholder="e.g. Updated insurance card with new policy #" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setNewVersionFor(null); setNewVersionFile(null); setNewVersionNote(""); }} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={uploadNewVersion} disabled={uploading || !newVersionFile} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{uploading ? "Uploading…" : "Save new version"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
