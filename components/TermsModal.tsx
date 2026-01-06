import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export default function TermsModal({ isOpen, onClose, onAccept }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-skyworth-dark bg-opacity-90 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border-t-8 border-skyworth-blue animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
             <span className="text-2xl">📋</span>
             <h3 className="text-3xl font-sport text-skyworth-dark tracking-wide">REGLAMENTO DE JUEGO</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-3xl font-bold leading-none">&times;</button>
        </div>
        
        {/* Content */}
        <div className="p-8 overflow-y-auto text-sm text-gray-700 space-y-5 leading-relaxed bg-white">
          <div className="p-4 bg-blue-50 border-l-4 border-skyworth-blue rounded-r text-skyworth-blue font-bold text-xs uppercase tracking-wider mb-4">
             Documento Oficial - Skyworth Mundial 2025
          </div>

          <p><strong className="text-skyworth-dark uppercase">1. Organizador (La FIFA del evento):</strong> La promoción "Gana con Skyworth 2025" es organizada oficialmente por Skyworth Bolivia.</p>
          <p><strong className="text-skyworth-dark uppercase">2. Tiempo de Juego:</strong> La promoción es válida desde el pitazo inicial del 1 de Enero de 2025 hasta el 16 de Abril de 2025 (Fecha del Gran Sorteo).</p>
          <p><strong className="text-skyworth-dark uppercase">3. Jugadores Habilitados:</strong> Pueden participar mayores de 18 años residentes en el país que posean un televisor Skyworth adquirido legalmente (Fichaje oficial).</p>
          <p><strong className="text-skyworth-dark uppercase">4. Mecánica de Juego:</strong> 
             <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
                <li><strong>Alineación Veterana:</strong> Registra el serial de tu TV actual.</li>
                <li><strong>Nuevo Fichaje:</strong> Registra el serial y sube la factura de compra reciente para bonificaciones extra.</li>
             </ul>
          </p>
          <p><strong className="text-skyworth-dark uppercase">5. Premios y Definición por Penales:</strong> Los tickets generados entrarán en el sorteo final ante notario público el día 16 de Abril. ¡Más pulgadas en tu TV significan más tickets en la cancha!</p>
          <p><strong className="text-skyworth-dark uppercase">6. Juego Limpio (Datos):</strong> Al participar, autorizas el tratamiento de tus datos personales para fines de contacto. Skyworth protege tu información como a un portero estrella.</p>
          <p><strong className="text-skyworth-dark uppercase">7. Tarjeta Roja:</strong> Cualquier intento de fraude, falsificación de seriales o facturas resultará en la descalificación inmediata y expulsión del torneo.</p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-3 text-gray-500 hover:text-gray-800 font-bold text-sm uppercase tracking-wider">Cancelar</button>
          <button onClick={() => { onAccept(); onClose(); }} className="px-8 py-3 bg-gradient-to-r from-skyworth-grass to-skyworth-pitch text-white rounded shadow-lg hover:shadow-xl hover:scale-105 transition transform font-sport text-xl tracking-widest">
            ACEPTAR REGLAS
          </button>
        </div>
      </div>
    </div>
  );
}