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
             <h3 className="text-3xl font-sport text-skyworth-dark tracking-wide">BASES Y CONDICIONES</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-3xl font-bold leading-none">&times;</button>
        </div>
        
        {/* Content */}
        <div className="p-8 overflow-y-auto text-sm text-gray-700 space-y-5 leading-relaxed bg-white">
          <div className="p-4 bg-blue-50 border-l-4 border-skyworth-blue rounded-r text-skyworth-blue font-bold text-xs uppercase tracking-wider mb-4">
             Promoción Empresarial Autorizada - Skyworth Bolivia 2025
          </div>

          <p><strong className="text-skyworth-dark uppercase">1. Elegibilidad:</strong> Podrán participar en la promoción todas las personas naturales, mayores de 18 años, residentes legalmente en el Estado Plurinacional de Bolivia, que adquieran un televisor marca SKYWORTH en cualquiera de sus modelos habilitados.</p>
          
          <p><strong className="text-skyworth-dark uppercase">2. Vigencia:</strong> El periodo de participación comprende desde las 00:00 horas del 1 de Enero de 2025 hasta las 23:59 horas del 15 de Abril de 2025.</p>
          
          <p><strong className="text-skyworth-dark uppercase">3. Mecánica de Registro:</strong> 
             <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
                <li>El participante debe ingresar al sitio web oficial.</li>
                <li>Completar el formulario con datos verídicos (Nombre según CI, Celular activo).</li>
                <li>Registrar el modelo y número de serie del equipo adquirido.</li>
                <li>Adjuntar una fotografía clara y legible de la factura o nota de venta fiscal.</li>
             </ul>
          </p>
          
          <p><strong className="text-skyworth-dark uppercase">4. Sorteo y Premios:</strong> El sorteo se realizará públicamente en la fecha estipulada (ver página principal) ante Notario de Fe Pública. Los premios no son canjeables por dinero en efectivo.</p>
          
          <p><strong className="text-skyworth-dark uppercase">5. Validación de Ganadores:</strong> Para reclamar el premio, el ganador deberá presentar:
             <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
                <li>Cédula de Identidad original y vigente.</li>
                <li>Factura original de compra que coincida con la imagen subida.</li>
                <li>El equipo físico (o etiqueta trasera) para validar el número de serie.</li>
             </ul>
             <span className="text-red-500 font-bold text-xs block mt-1">IMPORTANTE: Si los datos no coinciden, el premio será sorteado nuevamente.</span>
          </p>

          <p><strong className="text-skyworth-dark uppercase">6. Protección de Datos:</strong> La información recolectada será utilizada únicamente para fines de contacto relacionados con esta promoción y futuros eventos de la marca, cumpliendo con la normativa vigente de privacidad.</p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-3 text-gray-500 hover:text-gray-800 font-bold text-sm uppercase tracking-wider">Cerrar</button>
          <button onClick={() => { onAccept(); onClose(); }} className="px-8 py-3 bg-gradient-to-r from-skyworth-grass to-skyworth-pitch text-white rounded shadow-lg hover:shadow-xl hover:scale-105 transition transform font-sport text-xl tracking-widest">
            HE LEÍDO Y ACEPTO
          </button>
        </div>
      </div>
    </div>
  );
}