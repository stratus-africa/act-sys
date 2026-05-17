import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";

export type SignatureValue = { dataUrl: string | null; typed: string };

interface Props {
  value?: SignatureValue;
  onChange: (v: SignatureValue) => void;
  label?: string;
}

export function SignaturePad({ value, onChange, label = "Signature" }: Props) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(value?.typed ?? "");

  useEffect(() => {
    if (mode === "draw" && sigRef.current && value?.dataUrl) {
      try { sigRef.current.fromDataURL(value.dataUrl); } catch { /* ignore */ }
    }
  }, [mode, value?.dataUrl]);

  const handleEnd = () => {
    const dataUrl = sigRef.current?.toDataURL("image/png") ?? null;
    onChange({ dataUrl, typed });
  };

  const clear = () => {
    sigRef.current?.clear();
    onChange({ dataUrl: null, typed });
  };

  return (
    <div className="border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
        <div className="flex gap-1 text-[10px] font-mono uppercase">
          <button type="button" onClick={() => setMode("draw")} className={"px-2 py-1 " + (mode === "draw" ? "bg-primary text-primary-foreground" : "bg-muted")}>Draw</button>
          <button type="button" onClick={() => setMode("type")} className={"px-2 py-1 " + (mode === "type" ? "bg-primary text-primary-foreground" : "bg-muted")}>Type</button>
        </div>
      </div>

      {mode === "draw" ? (
        <>
          <div className="border-2 border-dashed border-border bg-muted/30">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{ className: "w-full h-32", style: { width: "100%", height: "128px" } }}
              penColor="#0f172a"
              onEnd={handleEnd}
            />
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={clear} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground">Clear</button>
            <span className="text-[10px] font-mono text-muted-foreground">Sign with finger or mouse</span>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Type full legal name"
            value={typed}
            onChange={(e) => { setTyped(e.target.value); onChange({ dataUrl: null, typed: e.target.value }); }}
            className="w-full px-3 py-2 border border-border bg-background text-sm font-serif italic"
          />
          <p className="text-[10px] text-muted-foreground">By typing your name, you provide a legally binding electronic signature.</p>
        </div>
      )}
    </div>
  );
}
