import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, uploadFile, db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { RegistrationResponse, Product } from '../types';
import ScannerModal from './ScannerModal';
import TermsModal from './TermsModal';

const CITIES = ['La Paz', 'Cochabamba', 'Santa Cruz', 'El Alto', 'Oruro', 'Potosi', 'Tarija', 'Sucre', 'Beni', 'Pando'];

// --- ICONS (Inline SVGs) ---
const IconPlane = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-10 md:h-10 text-skyworth-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"/><path d="M13 2l9 10-9 10"/><path d="M13 2v20"/></svg> // Simplified plane/travel
);
const IconBed = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-10 md:h-10 text-skyworth-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>
);
const IconTicket = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-10 md:h-10 text-skyworth-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v14"/><path d="M9 5v14"/></svg>
);

const CheckIcon = () => (
    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
);
const XIcon = () => (
    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
);

const StadiumBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-skyworth-navy">
    {/* Glows */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[80vh] bg-[#005BBB] opacity-20 blur-[150px] rounded-full"></div>
    <div className="absolute bottom-0 left-0 w-full h-[40vh] bg-skyworth-blue opacity-10 blur-[100px]"></div>
    {/* Texture Overlay */}
    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
  </div>
);

export default function PublicLanding() {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raffleDate, setRaffleDate] = useState<string>('Próximamente');
  const [products, setProducts] = useState<Product[]>([]);

  // Serial Validation State
  const [serialStatus, setSerialStatus] = useState<'IDLE' | 'VALIDATING' | 'AVAILABLE' | 'USED' | 'NOT_FOUND' | 'ERROR'>('IDLE');
  const [serialData, setSerialData] = useState<{model?: string, coupons?: number, message?: string} | null>(null);

  // Modals
  const [showScanner, setShowScanner] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Form State
  const [form, setForm] = useState({
    fullName: '', ci: '', city: 'La Paz', email: '', phone: '', tvModel: '', serial: ''
  });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  useEffect(() => {
    // 1. Fetch Date
    const fetchDate = async () => {
      try {
        const d = await getDoc(doc(db, 'campaign_config', 'general'));
        if (d.exists() && d.data().raffleDate) {
          const date = new Date(d.data().raffleDate + 'T00:00:00');
          setRaffleDate(date.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }));
        }
      } catch (e) { console.warn("Date fetch warning"); }
    };
    fetchDate();

    // 2. Fetch Products for Table
    const fetchProducts = async () => {
        try {
            const q = query(collection(db, 'products'), where('status', '==', 'ACTIVE')); // Add orderBy if needed, requires index
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
            // Client side sort by model
            list.sort((a, b) => a.model.localeCompare(b.model));
            setProducts(list);
        } catch (e) {
            console.error("Error fetching products", e);
        }
    };
    fetchProducts();
  }, []);

  const validateSerialInput = async (inputSerial: string) => {
    const clean = inputSerial.trim().toUpperCase();
    if (clean.length < 3) {
        setSerialStatus('IDLE');
        setSerialData(null);
        return;
    }

    setSerialStatus('VALIDATING');
    try {
        const validateFn = httpsCallable(functions, 'validateSerial');
        const res = await validateFn({ serial: clean });
        const data = res.data as any;

        setSerialStatus(data.status);
        setSerialData(data);

        // Auto-fill model if available and field is empty or strictly implied
        if (data.status === 'AVAILABLE' && data.model) {
            setForm(prev => ({ ...prev, tvModel: data.model }));
        }
    } catch (e: any) {
        console.error("Validation error", e);
        setSerialStatus('ERROR');
        setSerialData({ message: 'Error validando serial.' });
    }
  };

  const handleSerialBlur = () => {
      if (form.serial) validateSerialInput(form.serial);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Block if serial is invalid (must be AVAILABLE or IDLE/unchecked if logic allows optional, but requirements say "Validar SIEMPRE")
    // Requisito: "El campo... debe validarse SIEMPRE". So we enforce AVAILABLE.
    if (serialStatus !== 'AVAILABLE') {
        setError("Debes ingresar un Número de Serial válido y disponible.");
        setLoading(false);
        // Trigger validation just in case they typed but didn't blur
        validateSerialInput(form.serial);
        return;
    }

    try {
      if (!acceptedTerms) throw new Error("Debes aceptar los términos y condiciones.");
      if (!invoiceFile) throw new Error("Debes subir una foto de la factura.");
      
      const invoicePath = await uploadFile(invoiceFile, 'client_invoices');
      const registerFn = httpsCallable(functions, 'registerClient');
      const res = await registerFn({ ...form, invoicePath });
      const data = res.data as RegistrationResponse;

      if (data.success && (data.ticketId || (data as any).ticketIds)) {
        setTickets((data as any).ticketIds || [data.ticketId]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar el registro.");
    } finally {
      setLoading(false);
    }
  };

  if (tickets && tickets.length > 0) {
    return (
      <div className="min-h-screen bg-skyworth-navy text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <StadiumBackground />
        <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl max-w-xl w-full text-center shadow-2xl animate-fade-in">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
            <span className="text-4xl text-white">✓</span>
          </div>
          <h2 className="text-4xl font-sport tracking-wider mb-2">¡REGISTRO COMPLETADO!</h2>
          <p className="text-gray-300 mb-8 font-sans">Has generado <strong className="text-white text-xl">{tickets.length}</strong> cupones para el sorteo.</p>
          
          <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar mb-8">
            {tickets.map((t, idx) => (
                <div key={idx} className="bg-skyworth-blue/30 border border-skyworth-blue/50 p-4 rounded-xl relative overflow-hidden flex justify-between items-center group hover:bg-skyworth-blue/40 transition">
                    <div className="flex items-center gap-3">
                        <span className="bg-skyworth-accent text-white text-[10px] font-bold px-2 py-1 rounded">#{idx + 1}</span>
                        <span className="font-mono font-bold text-2xl text-white tracking-widest drop-shadow-md">{t}</span>
                    </div>
                    <div className="opacity-50 group-hover:opacity-100 transition">🎟️</div>
                </div>
            ))}
          </div>

          <button onClick={() => window.location.reload()} className="text-sm text-gray-400 hover:text-white underline font-sans">
            Registrar otra compra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-skyworth-navy text-white font-sans selection:bg-skyworth-orange selection:text-white overflow-x-hidden">
      <StadiumBackground />
      
      {/* Modals */}
      <ScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScan={(code) => { setForm({ ...form, serial: code }); validateSerialInput(code); }} />
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} onAccept={() => setAcceptedTerms(true)} />

      {/* HEADER / NAV */}
      <header className="relative z-50 w-full py-6 px-6 flex justify-between items-center max-w-7xl mx-auto">
         <div className="flex items-center gap-3">
             {/* Logo Placeholder */}
             <div className="text-3xl font-sport italic tracking-widest text-white">SKYWORTH</div>
             <div className="hidden md:block h-6 w-px bg-white/30"></div>
             <div className="hidden md:block text-xs font-bold tracking-[0.2em] text-skyworth-orange">PROMO 2025</div>
         </div>
         <button
             onClick={() => window.location.hash = 'seller'}
             className="text-xs font-bold uppercase tracking-widest border border-white/20 px-4 py-2 rounded-full hover:bg-white hover:text-skyworth-navy transition"
         >
             Soy Vendedor
         </button>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-10 pb-20 px-4 text-center min-h-[85vh]">
         <div className="animate-fade-in-up">
             <h2 className="text-xl md:text-2xl tracking-[0.3em] font-light mb-4 text-gray-300">SKYWORTH PRESENTA</h2>
             <h1 className="text-7xl md:text-9xl font-sport font-bold text-white leading-[0.85] tracking-tight drop-shadow-2xl">
                 EL SUEÑO<br/>
                 <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">DEL HINCHA</span>
             </h1>
         </div>

         <div className="mt-8 max-w-2xl mx-auto text-gray-300 text-sm md:text-lg font-light tracking-wide leading-relaxed animate-fade-in-up delay-100 uppercase">
             Compra tu TV Skyworth, registra tu compra y participa por increíbles premios.<br/>
             <strong className="text-white font-bold">¡Tu boleto al repechaje te espera!</strong>
         </div>

         <button
            onClick={() => document.getElementById('register-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-10 bg-skyworth-orange hover:bg-skyworth-orange-glow text-white font-sport text-2xl md:text-3xl px-10 py-4 rounded-full shadow-[0_0_30px_rgba(255,106,0,0.4)] hover:shadow-[0_0_50px_rgba(255,106,0,0.6)] transform hover:scale-105 transition-all duration-300 border-2 border-white/20"
         >
             REGISTRAR COMPRA
         </button>
      </section>

      {/* PRIZE CARD SECTION */}
      <section className="relative z-10 px-4 -mt-20 mb-20">
          <div className="max-w-4xl mx-auto bg-white rounded-[2rem] shadow-2xl p-8 md:p-12 relative overflow-hidden transform hover:-translate-y-2 transition duration-500">
              {/* Decorative side number */}
              <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-[12rem] md:text-[20rem] font-sport text-gray-100 leading-none select-none z-0">
                  5
              </div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                  <div className="text-center md:text-left flex-1">
                      <div className="inline-block bg-skyworth-orange text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider shadow-lg">Premio Mayor</div>
                      <h3 className="text-4xl md:text-6xl font-sport text-skyworth-blue leading-none mb-4">
                          PAQUETES COMPLETOS <br/>
                          <span className="text-skyworth-dark">AL REPECHAJE</span>
                      </h3>
                      <p className="text-gray-500 font-medium">¡Viaja con todo pagado para alentar a la selección!</p>
                  </div>

                  {/* Icons */}
                  <div className="flex flex-col items-center gap-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">El premio incluye:</span>
                      <div className="flex gap-4">
                          <div className="flex flex-col items-center gap-2 group">
                              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition">
                                  <IconPlane />
                              </div>
                              <span className="text-[10px] font-bold text-skyworth-blue uppercase">Pasajes</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 group">
                              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition">
                                  <IconBed />
                              </div>
                              <span className="text-[10px] font-bold text-skyworth-blue uppercase">Hotel</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 group">
                              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition">
                                  <IconTicket />
                              </div>
                              <span className="text-[10px] font-bold text-skyworth-blue uppercase">Entradas</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Bottom Strip */}
              <div className="absolute bottom-0 left-0 w-full h-3 bg-skyworth-blue flex">
                  <div className="w-1/3 bg-skyworth-navy"></div>
                  <div className="w-1/3 bg-skyworth-blue"></div>
                  <div className="w-1/3 bg-skyworth-orange"></div>
              </div>
          </div>
      </section>

      {/* REGISTRATION FORM */}
      <section id="register-form" className="relative z-10 py-20 px-4">
        <div className="max-w-3xl mx-auto bg-skyworth-navy/80 backdrop-blur-lg border border-white/10 rounded-3xl p-6 md:p-12 shadow-2xl">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-sport text-white tracking-wide">REGISTRA TU COMPRA</h2>
            <div className="h-1 w-20 bg-skyworth-orange mx-auto mt-2 rounded-full"></div>
            <p className="mt-4 text-gray-400 text-sm">Completa el formulario para generar tus cupones.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-4 mb-8 text-red-200 rounded-xl flex items-start gap-3">
              <XIcon />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* SERIAL FIELD (Highlighted) */}
            <div className="bg-skyworth-blue/20 p-6 rounded-2xl border border-skyworth-blue/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <svg className="w-32 h-32 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/></svg>
                </div>

                <label className="block text-sm font-bold uppercase text-skyworth-accent mb-2">Número de Serial del TV *</label>
                <div className="flex gap-2 mb-2">
                    <input
                        required
                        type="text"
                        className={`flex-1 p-4 bg-skyworth-navy border-2 rounded-xl outline-none font-mono text-lg transition ${
                            serialStatus === 'AVAILABLE' ? 'border-green-500 text-green-400' :
                            serialStatus === 'ERROR' || serialStatus === 'USED' || serialStatus === 'NOT_FOUND' ? 'border-red-500 text-red-400' :
                            'border-skyworth-blue/50 text-white focus:border-skyworth-accent'
                        }`}
                        placeholder="INGRESA EL SERIAL"
                        value={form.serial}
                        onChange={e => setForm({...form, serial: e.target.value.toUpperCase()})}
                        onBlur={handleSerialBlur}
                    />
                    <button type="button" onClick={() => setShowScanner(true)} className="bg-white text-skyworth-navy px-4 rounded-xl hover:bg-gray-200 transition font-bold">
                        📷
                    </button>
                </div>

                {/* Validation Feedback */}
                <div className="min-h-[20px] text-sm">
                    {serialStatus === 'VALIDATING' && <span className="text-skyworth-accent flex items-center gap-2">Validando serial... <span className="animate-spin">⏳</span></span>}
                    {serialStatus === 'NOT_FOUND' && <span className="text-red-400 flex items-center gap-2"><XIcon/> Serial no encontrado. Verifica el código.</span>}
                    {serialStatus === 'USED' && <span className="text-red-400 flex items-center gap-2"><XIcon/> Este serial ya fue registrado.</span>}
                    {serialStatus === 'AVAILABLE' && (
                        <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg flex flex-col gap-1 mt-2">
                            <div className="flex items-center gap-2 text-green-400 font-bold">
                                <CheckIcon /> Serial Válido y Disponible
                            </div>
                            <div className="text-gray-300 text-xs pl-7">
                                Modelo: <span className="text-white">{serialData?.model}</span> <br/>
                                <span className="text-skyworth-accent font-bold">¡Genera {serialData?.coupons} Cupones!</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Modelo de TV</label>
                <input required type="text" readOnly={serialStatus === 'AVAILABLE'} className={`w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-skyworth-orange outline-none text-white ${serialStatus==='AVAILABLE' ? 'opacity-50 cursor-not-allowed':''}`}
                  value={form.tvModel} onChange={e => setForm({...form, tvModel: e.target.value})} placeholder="Se llenará autom." />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Cédula de Identidad</label>
                <input required type="text" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-skyworth-orange outline-none text-white"
                  value={form.ci} onChange={e => setForm({...form, ci: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nombre Completo</label>
                    <input required type="text" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-skyworth-orange outline-none text-white"
                    value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Celular</label>
                    <input required type="tel" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-skyworth-orange outline-none text-white"
                    value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Ciudad</label>
                    <select className="w-full p-3 bg-skyworth-navy border border-white/10 rounded-xl focus:border-skyworth-orange outline-none text-white"
                        value={form.city} onChange={e => setForm({...form, city: e.target.value})}>
                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Email</label>
                    <input required type="email" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-skyworth-orange outline-none text-white"
                    value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
            </div>

            <div className="border border-white/10 rounded-xl p-4 bg-white/5 hover:bg-white/10 transition cursor-pointer relative group">
                <input required type="file" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={e => setInvoiceFile(e.target.files ? e.target.files[0] : null)} />
                <div className="flex items-center gap-4">
                    <div className="bg-skyworth-blue rounded-full p-3 text-white">
                        🧾
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white group-hover:text-skyworth-accent transition">Subir Foto de Factura</p>
                        <p className="text-xs text-gray-400">{invoiceFile ? invoiceFile.name : 'Formatos: JPG, PNG, PDF'}</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 py-2">
              <input required type="checkbox" id="terms" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="w-5 h-5 accent-skyworth-orange" />
              <label htmlFor="terms" className="text-sm text-gray-400">
                Acepto los <button type="button" onClick={() => setShowTerms(true)} className="text-white font-bold hover:underline">términos y condiciones</button>.
              </label>
            </div>

            <button
                disabled={loading || serialStatus !== 'AVAILABLE'}
                type="submit"
                className="w-full bg-gradient-to-r from-skyworth-orange to-orange-600 text-white font-sport text-3xl py-4 rounded-full shadow-lg hover:shadow-skyworth-orange/50 transition transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
            >
              {loading ? 'PROCESANDO...' : 'REGISTRARME AHORA'}
            </button>
          </form>
        </div>
      </section>

      {/* PARTICIPATING MODELS TABLE */}
      <section className="relative z-10 pb-20 px-4">
          <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-sport text-center text-white mb-8 tracking-wide">
                  MODELOS <span className="text-skyworth-accent">PARTICIPANTES</span>
              </h2>

              <div className="bg-skyworth-navy/80 backdrop-blur border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-skyworth-blue/20 text-skyworth-accent font-sport text-xl">
                              <tr>
                                  <th className="p-4 tracking-wider">Modelo</th>
                                  <th className="p-4 tracking-wider">Descripción</th>
                                  <th className="p-4 tracking-wider text-center">Nro de Tickets</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-sm font-light text-gray-300">
                              {products.length === 0 ? (
                                  <tr><td colSpan={3} className="p-8 text-center text-gray-500">Cargando modelos...</td></tr>
                              ) : products.map((p) => (
                                  <tr key={p.id} className="hover:bg-white/5 transition">
                                      <td className="p-4 font-bold text-white font-mono">{p.model}</td>
                                      <td className="p-4">{p.description}</td>
                                      <td className="p-4 text-center">
                                          <div className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-white font-bold">
                                              🎟 {p.couponsBuyer}
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#05101c] text-gray-500 py-10 text-center text-xs border-t border-white/5 relative z-10">
        <p className="mb-4 text-gray-600 tracking-wider uppercase">&copy; 2025 Skyworth Bolivia. "El Sueño del Hincha"</p>
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
