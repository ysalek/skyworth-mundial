import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function ScannerModal({ isOpen, onClose, onScan }: Props) {
  const [error, setError] = useState<string>('');
  const [permissionError, setPermissionError] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const divId = "reader";

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const startScanner = async () => {
      try {
        // Limpiar instancia previa si existe (por seguridad)
        if (scannerRef.current) {
          await scannerRef.current.clear();
        }

        const html5QrCode = new Html5Qrcode(divId);
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 }, 
          aspectRatio: 1.0,
          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128 ]
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (isMounted) {
              // Vibración de éxito si el navegador lo soporta
              if (navigator.vibrate) navigator.vibrate(200);
              onScan(decodedText);
              stopScanner();
              onClose();
            }
          },
          (errorMessage) => {
            // Ignorar errores de "no code found" frame a frame
          }
        );
      } catch (err: any) {
        console.error("Error scanner:", err);
        if (isMounted) {
            if (err?.name === "NotAllowedError" || err?.name === "NotFoundError") {
                setPermissionError(true);
                setError("No se pudo acceder a la cámara. Verifica los permisos.");
            } else {
                setError("Error al iniciar la cámara. Intenta ingresarlo manualmente.");
            }
        }
      }
    };

    // Pequeño delay para asegurar render del div
    const timer = setTimeout(startScanner, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
        try {
            await scannerRef.current.stop();
            scannerRef.current.clear();
        } catch (e) {
            console.error("Error stopping scanner", e);
        }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-90 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh]">
        <div className="p-4 bg-skyworth-dark text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold">Escanear Serial</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-xl px-2">&times;</button>
        </div>
        
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
            {!permissionError ? (
                <div id={divId} className="w-full h-full min-h-[300px]"></div>
            ) : (
                <div className="text-white text-center p-6 space-y-4">
                    <div className="text-4xl">📷🚫</div>
                    <p>Acceso a cámara denegado.</p>
                    <button onClick={onClose} className="bg-white text-black px-4 py-2 rounded font-bold text-sm">Cerrar e ingresar manual</button>
                </div>
            )}
            
            {/* Overlay visual para guiar */}
            {!permissionError && !error && (
                <div className="absolute inset-0 pointer-events-none border-[50px] border-black border-opacity-50">
                    <div className="w-full h-full border-2 border-skyworth-accent opacity-50 relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-skyworth-accent"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-skyworth-accent"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-skyworth-accent"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-skyworth-accent"></div>
                    </div>
                </div>
            )}

            {error && !permissionError && (
                <div className="absolute inset-0 flex items-center justify-center text-center p-4 bg-black bg-opacity-80">
                    <p className="text-red-400 font-bold">{error}</p>
                </div>
            )}
        </div>

        <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 shrink-0">
          Encuentra el código de barras en la etiqueta trasera del TV.
        </div>
      </div>
    </div>
  );
}