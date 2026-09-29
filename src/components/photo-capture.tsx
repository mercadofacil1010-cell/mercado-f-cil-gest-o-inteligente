// Captura de foto de evidência pela câmera do celular (B5.4, DEC-B5-09).
// Usa o seletor nativo de arquivo com `capture="environment"` — abre a
// câmera traseira direto no celular, com upload de arquivo como alternativa
// no desktop, sem precisar de uma pré-visualização de câmera ao vivo.
import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadEvidencePhoto } from "@/lib/evidence-photos-api";

export function PhotoCapture({
  companyId,
  marketId,
  photoPath,
  onChange,
  notify,
  label = "Adicionar foto (opcional)",
}: {
  companyId: string;
  marketId: string;
  photoPath: string | null;
  onChange: (path: string | null) => void;
  notify: (message: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const result = await uploadEvidencePhoto(companyId, marketId, file);
    setUploading(false);
    if (!result.ok) {
      notify(result.message);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    onChange(result.path);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      {previewUrl ? (
        <div className="flex items-center gap-3">
          <img
            src={previewUrl}
            alt="Prévia da foto de evidência"
            className="h-16 w-16 rounded-md border border-border object-cover"
          />
          <Button variant="ghost" size="sm" onClick={handleRemove}>
            <X className="h-4 w-4" /> Remover
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Camera className="h-4 w-4" /> {label}
            </>
          )}
        </Button>
      )}
      {photoPath && !previewUrl && (
        <p className="text-xs text-muted-foreground">Foto já anexada.</p>
      )}
    </div>
  );
}
