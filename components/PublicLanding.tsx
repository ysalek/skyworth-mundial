import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, uploadFile, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { RegistrationResponse } from '../types';
import ScannerModal from './ScannerModal';
import TermsModal from './TermsModal';

const CITIES = ['La Paz', 'Cochabamba', 'Santa Cruz', 'El Alto', 'Oruro', 'Potosi', 'Tarija', 'Sucre', 'Beni', 'Pando'];

const StadiumBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-[#0F172A]">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150vw] h-[80vh] bg-skyworth-blue opacity-20 blur-[120px] rounded-full"></div>
    <div className="absolute bottom-0 right-0 w-[50vw] h-[50vh] bg-skyworth-grass opacity-10 blur-[100px] rounded-full"></div>
    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
  </div>
);

export default function PublicLanding() {
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raffleDate, setRaffleDate] = useState<string>('Próximamente');

  // Modals State
  const [showScanner, setShowScanner] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Form State
  const [form, setForm] = useState({
    fullName: '', ci: '', city: 'La Paz', email: '', phone: '', tvModel: '', serial: ''
  });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchDate = async () => {
      try {
        const d = await getDoc(doc(db, 'campaign_config', 'general'));
        if (d.exists() && d.data().raffleDate) {
          const date = new Date(d.data().raffleDate + 'T00:00:00'); // Ensure local time interpretation
          setRaffleDate(date.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }));
        }
      } catch (e) { console.warn("Date fetch warning"); }
    };
    fetchDate();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!acceptedTerms) throw new Error("Debes aceptar los términos y condiciones.");
      if (!invoiceFile) throw new Error("Debes subir una foto de la factura.");
      
      const invoicePath = await uploadFile(invoiceFile, 'client_invoices');
      const registerFn = httpsCallable(functions, 'registerClient');
      const res = await registerFn({ ...form, invoicePath });
      const data = res.data as RegistrationResponse;

      if (data.success && data.ticketId) {
        setTicket(data.ticketId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar el registro.");
    } finally {
      setLoading(false);
    }
  };

  if (ticket) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <StadiumBackground />
        <div className="relative z-10 bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl max-w-lg w-full text-center shadow-2xl animate-fade-in">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
            <span className="text-4xl">✓</span>
          </div>
          <h2 className="text-3xl font-sport tracking-wider mb-2">¡REGISTRO COMPLETADO!</h2>
          <p className="text-gray-300 mb-8">Ya estás participando en el sorteo oficial.</p>
          
          <div className="bg-skyworth-blue/20 border border-skyworth-blue/50 p-6 rounded-xl mb-8 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-skyworth-accent to-transparent"></div>
            <p className="text-xs uppercase tracking-[0.2em] text-skyworth-accent mb-2">Tu Ticket Oficial</p>
            <p className="text-4xl font-mono font-bold text-white tracking-widest">{ticket}</p>
          </div>

          <button onClick={() => window.location.reload()} className="text-sm text-gray-400 hover:text-white underline">
            Registrar otra compra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans selection:bg-skyworth-blue selection:text-white">
      <StadiumBackground />
      
      {/* Modals */}
      <ScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScan={(code) => setForm({ ...form, serial: code })} />
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} onAccept={() => setAcceptedTerms(true)} />

      {/* Navbar */}
      <nav className="relative z-20 border-b border-white/5 bg-[#0B0F19]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-sport text-white tracking-widest">SKYWORTH</div>
              <span className="bg-skyworth-blue text-[10px] px-2 py-0.5 rounded text-white font-bold tracking-wider">PROMO 2025</span>
            </div>
            <div className="text-xs text-gray-400 font-mono">
                Sorteo: {raffleDate}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Split - 2 Campaigns */}
      <div className="relative z-10 pt-10 pb-12 px-4">
        <div className="text-center mb-10">
            <h1 className="text-4xl md:text-6xl font-sport text-white mb-2 tracking-tight leading-none drop-shadow-xl">
            ELIGE TU CAMINO
            </h1>
            <p className="text-gray-400">Selecciona tu perfil para participar</p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Campaign 1: Consumer */}
            <div className="group relative bg-gradient-to-br from-blue-900 to-slate-900 border border-white/10 rounded-2xl p-8 overflow-hidden hover:border-skyworth-blue transition-all cursor-pointer shadow-2xl hover:shadow-skyworth-blue/20"
                 onClick={() => document.getElementById('register-form')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition text-9xl leading-none select-none">📺</div>
                <div className="relative z-10">
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Soy Cliente</span>
                    <h2 className="text-3xl font-sport text-white mt-4 mb-2">COMPRÉ UN TV</h2>
                    <p className="text-gray-400 text-sm mb-6">Registra tu factura, obtén tu ticket y participa por premios increíbles.</p>
                    <span className="inline-block text-skyworth-accent font-bold text-sm border-b border-skyworth-accent">Registrar Compra →</span>
                </div>
            </div>

            {/* Campaign 2: Seller */}
            <div className="group relative bg-gradient-to-br from-green-900 to-slate-900 border border-white/10 rounded-2xl p-8 overflow-hidden hover:border-skyworth-grass transition-all cursor-pointer shadow-2xl hover:shadow-skyworth-grass/20"
                 onClick={() => window.location.hash = 'seller'}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition text-9xl leading-none select-none">💼</div>
                <div className="relative z-10">
                    <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Soy Vendedor</span>
                    <h2 className="text-3xl font-sport text-white mt-4 mb-2">FUERZA DE VENTAS</h2>
                    <p className="text-gray-400 text-sm mb-6">Gestiona tus ventas, acumula puntos y gana comisiones en efectivo.</p>
                    <span className="inline-block text-green-400 font-bold text-sm border-b border-green-400">Ir al Portal →</span>
                </div>
            </div>
        </div>
      </div>

      {/* Form Section (Consumer) */}
      <div id="register-form" className="relative z-10 bg-white text-slate-900 py-16" style={{clipPath: "polygon(0 5%, 100% 0, 100% 100%, 0% 100%)"}}>
        <div className="max-w-3xl mx-auto px-4 pt-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-sport text-slate-900 mb-2">REGISTRO DE CLIENTES</h2>
            <div className="h-1 w-20 bg-skyworth-blue mx-auto"></div>
            <p className="mt-4 text-gray-500">Completa tus datos para el sorteo del {raffleDate}</p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 text-red-700 rounded shadow-sm">
              <p className="font-bold">Atención</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Nombre Completo (Según CI)</label>
                <input required type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded focus:border-skyworth-blue focus:ring-2 focus:ring-skyworth-blue/20 outline-none transition" 
                  value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Cédula de Identidad</label>
                <input required type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded focus:border-skyworth-blue focus:ring-2 focus:ring-skyworth-blue/20 outline-none transition" 
                  value={form.ci} onChange={e => setForm({...form, ci: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Ciudad</label>
                <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded focus:border-skyworth-blue focus:ring-2 focus:ring-skyworth-blue/20 outline-none transition"
                  value={form.city} onChange={e => setForm({...form, city: e.target.value})}>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Celular (WhatsApp)</label>
                <input required type="tel" className="w-full p-3 bg-gray-50 border border-gray-200 rounded focus:border-skyworth-blue focus:ring-2 focus:ring-skyworth-blue/20 outline-none transition" 
                  value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Correo Electrónico</label>
              <input required type="email" className="w-full p-3 bg-gray-50 border border-gray-200 rounded focus:border-skyworth-blue focus:ring-2 focus:ring-skyworth-blue/20 outline-none transition" 
                value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>

            {/* Product Data */}
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="text-sm font-bold text-skyworth-blue uppercase mb-4 border-b pb-2">Datos del Producto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Modelo de TV</label>
                  <input required type="text" placeholder="Ej: 55SUE9500" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-skyworth-blue" 
                    value={form.tvModel} onChange={e => setForm({...form, tvModel: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Número de Serie (Opcional)</label>
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 p-3 bg-white border border-gray-200 rounded outline-none focus:border-skyworth-blue" 
                      value={form.serial} onChange={e => setForm({...form, serial: e.target.value})} />
                    <button type="button" onClick={() => setShowScanner(true)} className="bg-skyworth-dark text-white px-4 rounded hover:bg-gray-800 transition">📷</button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Foto de la Factura</label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-white hover:border-skyworth-blue transition cursor-pointer group">
                  <input required type="file" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={e => setInvoiceFile(e.target.files ? e.target.files[0] : null)} />
                  <div className="pointer-events-none">
                    <span className="text-3xl mb-2 block group-hover:scale-110 transition">🧾</span>
                    <span className="text-sm font-bold text-gray-600">{invoiceFile ? invoiceFile.name : 'Click para subir factura'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="terms" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="w-5 h-5 text-skyworth-blue border-gray-300 rounded focus:ring-skyworth-blue" />
              <label htmlFor="terms" className="text-sm text-gray-600">
                Acepto los <button type="button" onClick={() => setShowTerms(true)} className="text-skyworth-blue font-bold hover:underline">términos y condiciones</button>.
              </label>
            </div>

            <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-skyworth-blue to-skyworth-dark text-white font-sport text-2xl py-4 rounded-xl shadow-xl hover:shadow-2xl hover:scale-[1.01] transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'PROCESANDO...' : 'GENERAR TICKET DE SORTEO'}
            </button>
          </form>
        </div>
      </div>

      <footer className="bg-[#0B0F19] text-gray-500 py-8 text-center text-xs border-t border-white/10 relative z-10">
        <p className="mb-2">&copy; 2025 Skyworth Bolivia. Todos los derechos reservados.</p>
        <button 
          onClick={(e) => { e.preventDefault(); window.location.hash = 'admin'; }} 
          className="text-gray-700 hover:text-gray-500 transition underline bg-transparent border-0 cursor-pointer"
        >
          Acceso Administrativo
        </button>
      </footer>
    </div>
  );
}