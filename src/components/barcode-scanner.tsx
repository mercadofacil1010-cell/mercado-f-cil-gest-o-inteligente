// Leitura de código de barras pela câmera do celular (B5.4, DEC-B5-10).
// Leitor físico USB/Bluetooth continua funcionando via digitação manual
// (emula teclado) — este componente é só a novidade real: abrir a câmera e
// decodificar o código direto da tela, com a digitação manual como
// alternativa sempre disponível ao lado.
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BarcodeScannerButton({
  onScan,
  label = "Escanear código de barras",
}: {
  onScan: (code: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Camera className="h-4 w-4" /> {label}
      </Button>
      {open && (
        <BarcodeScannerDialog
          onClose={() => setOpen(false)}
          onScan={(code) => {
            setOpen(false);
            onScan(code);
          }}
        />
      )}
    </>
  );
}

function BarcodeScannerDialog({
  onClose,
  onScan,
}: {
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let active = true;
    let controls: { stop: () => void } | null = null;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, ctrl) => {
        if (!active) return;
        controls = ctrl;
        setStarting(false);
        if (result) {
          onScan(result.getText());
        }
      })
      .catch(() => {
        if (active) setError("Não foi possível acessar a câmera. Use a digitação manual.");
      });

    return () => {
      active = false;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- monta a câmera uma única vez
  }, []);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Escanear código de barras</DialogTitle>
          <DialogDescription>Aponte a câmera para o código do produto.</DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-md bg-black">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted />
          {starting && !error && (
            <div className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" /> Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
