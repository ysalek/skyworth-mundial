import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function ScannerModal({ isOpen, onClose, onScan }: Props) {
  const [error, setError] = useState<string>('');
  const [permissionError, setPermissionError] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const divId = "reader";

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const init = async () => {
        try {
            const devices = await Html5Qrcode.getCameras();
            if (isMounted) {
                setCameras(devices);
                if (devices && devices.length > 0) {
                     // Prefer back camera
                     const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera'));
                     setSelectedCamera(backCamera ? backCamera.id : devices[devices.length - 1].id);
                }
            }
        } catch (e) {
            console.error("Error getting cameras", e);
            if (isMounted) {
                setPermissionError(true);
                setError("No se detectaron cámaras o permisos denegados.");
            }
        }
    };

    init();

    return () => { isMounted = false; };
  }, [isOpen]);

  useEffect(() => {
     if (selectedCamera && isOpen) {
        startScanner(selectedCamera);
     }
     return () => { stopScanner(); };
  }, [selectedCamera, isOpen]);

  const startScanner = async (cameraId: string) => {
    try {
        if (scannerRef.current) {
            if (scannerRef.current.isScanning) await scannerRef.current.stop();
            scannerRef.current.clear();
        }

        const html5QrCode = new Html5Qrcode(divId);
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 15,
          qrbox: { width: 250, height: 250 }, 
          aspectRatio: 1.0,
          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128 ]
        };

        await html5QrCode.start(
          cameraId,
          config,
          (decodedText) => {
              // Vibración de éxito si el navegador lo soporta
              if (navigator.vibrate) navigator.vibrate(200);
              onScan(decodedText);
              onClose();
          },
          (errorMessage) => {
            // Ignorar errores de "no code found" frame a frame
          }
        );
        setError('');
    } catch (err: any) {
        console.error("Error starting scanner:", err);
        setError("Error iniciando cámara. Intenta otra o ingresa manual.");
    }
  };

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

  const switchCamera = () => {
      if (cameras.length > 1) {
          const currentIndex = cameras.findIndex(c => c.id === selectedCamera);
          const nextIndex = (currentIndex + 1) % cameras.length;
          setSelectedCamera(cameras[nextIndex].id);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-90 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh]">
        <div className="p-4 bg-skyworth-dark text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold flex items-center gap-2"><Camera size={18} /> Escanear Serial</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-xl px-2">&times;</button>
        </div>
        
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-[350px]">
            {!permissionError ? (
                <>
                   <div id={divId} className="w-full h-full"></div>
                   {cameras.length > 1 && (
                       <button onClick={switchCamera} className="absolute bottom-4 right-4 bg-white/20 p-3 rounded-full text-white backdrop-blur-sm z-20 hover:bg-white/40">
                           <RefreshCw size={24} />
                       </button>
                   )}
                </>
            ) : (
                <div className="text-white text-center p-6 space-y-4">
                    <div className="text-4xl">📷🚫</div>
                    <p>Acceso a cámara denegado.</p>
                    <button onClick={onClose} className="bg-white text-black px-4 py-2 rounded font-bold text-sm">Cerrar e ingresar manual</button>
                </div>
            )}
            
            {/* Overlay visual para guiar */}
            {!permissionError && !error && (
                <div className="absolute inset-0 pointer-events-none border-[50px] border-black border-opacity-50 z-10">
                    <div className="w-full h-full border-2 border-skyworth-accent opacity-80 relative shadow-[0_0_20px_rgba(0,169,224,0.5)]">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-skyworth-accent"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-skyworth-accent"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-skyworth-accent"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-skyworth-accent"></div>

                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 opacity-50"></div>
                        <div className="absolute bottom-4 left-0 right-0 text-center text-white text-xs font-bold drop-shadow-md">Apunta al código de barras</div>
                    </div>
                </div>
            )}

            {error && !permissionError && (
                <div className="absolute inset-0 flex items-center justify-center text-center p-4 bg-black bg-opacity-80 z-30">
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