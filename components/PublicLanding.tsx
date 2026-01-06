import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, uploadFile, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { RegistrationResponse, CampaignType } from '../types';
import TermsModal from './TermsModal';
import ScannerModal from './ScannerModal';

// --- COMPONENTE: CONFETI ---
const Confetti = () => {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const colors = ['#FFD700', '#005BBB', '#28A745', '#FFFFFF'];
    const newParticles = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100 + '%',
      bg: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2 + 's',
      duration: Math.random() * 3 + 2 + 's',
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-3 h-3 rounded-sm opacity-80 animate-fall"
          style={{
            left: p.left,
            backgroundColor: p.bg,
            top: '-20px',
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-fall { animation-name: fall; animation-timing-function: linear; animation-iteration-count: infinite; }
      `}</style>
    </div>
  );
};

// --- COMPONENTE: COUNTDOWN TIMER ---
const Countdown = () => {
    // Default Date: 17 de Abril a las 00:00 UTC (Equivale a 16 Abril 20:00 Bolivia UTC-4)
    const [targetDate, setTargetDate] = useState<number>(Date.UTC(2025, 3, 17, 0, 0, 0));
    const [displayDate, setDisplayDate] = useState<string>("16 DE ABRIL");

    useEffect(() => {
        // Fetch fecha configurable
        const fetchDate = async () => {
            try {
                const docRef = doc(db, 'settings', 'general');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.raffleDate) {
                        const dateObj = new Date(data.raffleDate);
                        setTargetDate(dateObj.getTime());
                        // Formatear fecha para display: "16 DE ABRIL"
                        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
                        setDisplayDate(dateObj.toLocaleDateString('es-ES', options).toUpperCase());
                    }
                }
            } catch (e) {
                console.error("Error fetching date", e);
            }
        };
        fetchDate();
    }, []);

    const calculateTimeLeft = () => {
        const now = Date.now();
        const difference = targetDate - now;

        if (difference > 0) {
            return {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        }
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        // Actualizar el timer cuando cambie el targetDate también
        setTimeLeft(calculateTimeLeft()); 

        const interval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]); // Dependencia de targetDate para recalcular si cambia

    const TimeUnit = ({ val, label }: { val: number, label: string }) => (
        <div className="flex flex-col items-center gap-2 z-10 mx-2 md:mx-4">
            <div className="bg-gradient-to-b from-[#002F6C] to-[#001A3D] border border-skyworth-light/30 rounded-lg w-16 h-20 md:w-20 md:h-24 flex items-center justify-center shadow-lg relative overflow-hidden group">
                {/* Brillo superior */}
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent opacity-50"></div>
                
                <span className="font-sport text-4xl md:text-5xl text-white tracking-widest leading-none drop-shadow-md">
                    {String(val).padStart(2, '0')}
                </span>
            </div>
            <span className="text-skyworth-accent font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase">{label}</span>
        </div>
    );

    return (
        <div className="w-full max-w-3xl mx-auto mt-12 mb-8 relative z-10 px-4">
             {/* Caja Azul estilo tarjeta */}
             <div className="bg-[#001A3D]/80 backdrop-blur-md border border-skyworth-light/50 rounded-xl p-8 md:p-10 relative overflow-hidden shadow-[0_0_50px_rgba(0,91,187,0.3)]">
                
                {/* Elementos decorativos de fondo */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-skyworth-light/20 rounded-full blur-[50px] pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-skyworth-accent/10 rounded-full blur-[50px] pointer-events-none"></div>

                <h3 className="text-skyworth-accent font-sport text-2xl md:text-3xl text-center mb-8 uppercase tracking-[0.15em] drop-shadow-lg relative z-10">
                    GRAN SORTEO: {displayDate}
                </h3>
                
                <div className="flex justify-center flex-wrap relative z-10">
                    <TimeUnit val={timeLeft.days} label="DÍAS" />
                    <TimeUnit val={timeLeft.hours} label="HRS" />
                    <TimeUnit val={timeLeft.minutes} label="MIN" />
                    <TimeUnit val={timeLeft.seconds} label="SEG" />
                </div>
             </div>
        </div>
    );
};

// --- COMPONENTE: FAQ SECTION ---
const FAQ = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const questions = [
        { q: "¿Dónde encuentro el código de mi TV?", a: "El código serial está en la etiqueta plateada o blanca en la parte trasera del televisor. Comienza generalmente con letras y números." },
        { q: "¿Cuántos tickets recibo?", a: "Depende del tamaño de tu TV: 32-49 pulgadas = 1 ticket, 50-64 pulgadas = 2 tickets, 65+ pulgadas = 3 tickets." },
        { q: "¿Cuándo es el sorteo?", a: "El gran sorteo se realizará en la fecha indicada arriba. Te notificaremos por WhatsApp y Email si resultas ganador." },
        { q: "¿Qué pasa si no tengo la factura?", a: "Si compraste recientemente, es obligatoria para la campaña 'Nuevo Fichaje'. Si eres usuario antiguo, participa en 'Alineación Veterana' solo con el serial." }
    ];

    return (
        <div className="max-w-3xl mx-auto px-4 py-12">
            <h3 className="text-3xl font-sport text-center text-skyworth-dark mb-8">PREGUNTAS DEL HINCHA</h3>
            <div className="space-y-4">
                {questions.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <button 
                            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                            className="w-full text-left p-4 flex justify-between items-center bg-gray-50 hover:bg-white transition"
                        >
                            <span className="font-bold text-skyworth-blue">{item.q}</span>
                            <span className="text-2xl text-gray-400">{openIndex === idx ? '−' : '+'}</span>
                        </button>
                        {openIndex === idx && (
                            <div className="p-4 text-gray-600 text-sm border-t border-gray-100 bg-white animate-fade-in">
                                {item.a}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- COMPONENTE: GOLDEN TICKET ---
interface GoldenTicketProps {
  code: string;
  tvCode: string;
}

const GoldenTicket: React.FC<GoldenTicketProps> = ({ code, tvCode }) => (
  <div className="relative w-full max-w-sm mx-auto bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 rounded-lg shadow-lg overflow-hidden transform transition hover:scale-105 border border-yellow-500 mb-4 group">
    {/* Efecto Holográfico */}
    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-20 group-hover:opacity-40 transition-opacity w-[200%] translate-x-[-50%] group-hover:translate-x-[50%] duration-1000"></div>
    
    <div className="flex">
      {/* Stub (Izquierda) */}
      <div className="bg-skyworth-dark text-white p-3 flex flex-col justify-center items-center border-r-2 border-dashed border-yellow-600 relative w-24 shrink-0">
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full"></div>
        <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-full"></div>
        <span className="text-2xl">⚽</span>
        <span className="text-[10px] font-mono text-gray-400 mt-2 rotate-90 whitespace-nowrap">SKY-2025</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 flex flex-col justify-between relative">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-sport text-skyworth-dark text-xl leading-none">TICKET DORADO</h4>
            <p className="text-[10px] font-bold text-skyworth-blue uppercase tracking-wider">Sorteo Oficial</p>
          </div>
          <div className="w-8 h-8 opacity-50">
             <svg viewBox="0 0 24 24" fill="currentColor" className="text-skyworth-dark"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </div>
        </div>

        <div className="mt-2 text-center border-t border-yellow-600 border-opacity-30 pt-2">
           <div className="text-2xl font-mono font-bold text-skyworth-dark tracking-widest">{code.split('-').pop()}</div>
           <div className="text-[10px] text-yellow-800 font-bold">SERIAL: {code}</div>
        </div>

        <div className="mt-2 flex justify-between items-end">
           <span className="text-[9px] text-gray-700 font-bold bg-white/30 px-1 rounded">TV: {tvCode}</span>
           <span className="text-[9px] text-skyworth-dark font-bold">★★★★★</span>
        </div>
      </div>
    </div>
  </div>
);

// --- ICONOS SVG ---
const TVBallIcon = () => (
  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth={1.5} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9l2.1 2.1M12 9l-2.1 2.1M12 9l0 -3" />
  </svg>
);

const JerseyIcon = () => (
  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14v-2m0 0V8m0 4h2m-2 0H10" />
  </svg>
);

const TrophyIcon = () => (
  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
  </svg>
);

// Modal para Consultar Tickets
const CheckTicketsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const checkFn = httpsCallable(functions, 'checkMyTickets');
      const res = await checkFn({ email });
      const data = res.data as any;
      
      if (data.found) {
        setResult(data.history);
      } else {
        setError(data.message || 'No se encontraron registros. ¿Usaste otro email?');
      }
    } catch (err: any) {
      setError('Error de conexión. Intente en el medio tiempo.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-skyworth-dark bg-opacity-90 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative border-t-8 border-skyworth-accent max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-600 font-bold text-xl">✕</button>
        <h3 className="text-3xl font-sport text-skyworth-dark mb-4 text-center">VAR: Mis Tickets</h3>
        
        <form onSubmit={handleCheck} className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">CORREO DEL JUGADOR</label>
            <input 
              required
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded focus:border-skyworth-light outline-none font-mono"
              placeholder="campeon@correo.com"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-skyworth-grass text-white py-3 rounded font-bold font-sport text-xl hover:bg-skyworth-pitch transition disabled:opacity-50 shadow-lg">
            {loading ? 'Revisando Jugada...' : 'CONSULTAR TICKETS'}
          </button>
        </form>

        {error && <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded font-bold text-center animate-pulse">{error}</div>}

        {result && (
          <div className="mt-6 border-t pt-4">
            <p className="text-skyworth-grass font-bold text-center mb-4 uppercase text-lg">¡Jugada Confirmada!</p>
            {result.map((item: any, idx: number) => (
              <div key={idx} className="mb-6">
                 <p className="text-xs text-center text-gray-400 mb-2 uppercase font-bold">{new Date(item.date).toLocaleDateString()} • TV: {item.tvCode}</p>
                 <div className="space-y-2">
                    {item.tickets.map((t: string) => (
                        <GoldenTicket key={t} code={t} tvCode={item.tvCode} />
                    ))}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function PublicLanding() {
  const [activeTab, setActiveTab] = useState<CampaignType>('EXISTING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<RegistrationResponse | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCheckTickets, setShowCheckTickets] = useState(false);
  const [ticketsCopied, setTicketsCopied] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    ci: '',
    email: '',
    phone: '',
    city: '',
    code: '',
    terms: false
  });
  const [files, setFiles] = useState<{
    ciFront: File | null;
    ciBack: File | null;
    invoice: File | null;
  }>({ ciFront: null, ciBack: null, invoice: null });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: 'ciFront' | 'ciBack' | 'invoice') => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [key]: e.target.files![0] }));
    }
  };

  const handleScanResult = (code: string) => {
    setFormData(prev => ({ ...prev, code: code.toUpperCase().trim() }));
  };

  const copyTickets = () => {
    if (successData?.tickets) {
      navigator.clipboard.writeText(successData.tickets.join('\n'));
      setTicketsCopied(true);
      setTimeout(() => setTicketsCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!files.ciFront || !files.ciBack) throw new Error("Árbitro: Falta la foto de tu CI.");
      if (activeTab === 'NEW_PURCHASE' && !files.invoice) throw new Error("Árbitro: Falta la factura de compra.");
      if (!formData.terms) throw new Error("Debes aceptar las reglas del juego.");

      // Validación previa de tamaño (UX)
      const MAX_MB = 5;
      if (files.ciFront.size > MAX_MB*1024*1024) throw new Error("CI Frontal: Archivo muy grande (Máx 5MB)");
      if (files.ciBack.size > MAX_MB*1024*1024) throw new Error("CI Reverso: Archivo muy grande (Máx 5MB)");
      if (files.invoice && files.invoice.size > MAX_MB*1024*1024) throw new Error("Factura: Archivo muy grande (Máx 5MB)");

      const ciFrontPath = await uploadFile(files.ciFront, 'ci_front');
      const ciBackPath = await uploadFile(files.ciBack, 'ci_back');
      let invoicePath = undefined;
      if (files.invoice) {
        invoicePath = await uploadFile(files.invoice, 'invoices');
      }

      const createRegistration = httpsCallable(functions, 'createRegistration');
      const response = await createRegistration({
        campaignType: activeTab,
        ...formData,
        code: formData.code.toUpperCase().replace(/\s/g, ''),
        filePaths: { ciFrontPath, ciBackPath, invoicePath }
      });

      const data = response.data as RegistrationResponse;
      if (data.success) {
        setSuccessData(data);
      } else {
        throw new Error(data.message);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falta cometida. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen bg-stadium-gradient flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <Confetti />
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center animate-fade-in border-t-8 border-skyworth-accent z-10 max-h-screen overflow-y-auto">
          <div className="flex justify-center mb-6">
             <div className="w-24 h-24 bg-skyworth-grass rounded-full flex items-center justify-center border-4 border-white shadow-lg -mt-20">
                <span className="text-4xl animate-bounce">⚽</span>
             </div>
          </div>
          <h2 className="text-5xl font-sport text-skyworth-dark mb-2">¡GOLAZO!</h2>
          <p className="text-gray-600 mb-6 font-medium">Registro exitoso. Ya estás participando.</p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 relative">
            <div className="flex justify-between items-center mb-4">
                <p className="font-sport text-xl text-skyworth-blue">TU JUGADA OFICIAL</p>
                <button 
                  onClick={copyTickets}
                  className="text-xs bg-skyworth-accent text-skyworth-dark px-3 py-1 rounded font-bold hover:bg-yellow-300 shadow-sm transition"
                >
                  {ticketsCopied ? '✅ COPIADO' : '📋 COPIAR CÓDIGOS'}
                </button>
            </div>
            <div className="space-y-4">
                {successData.tickets.map(ticket => (
                    <GoldenTicket key={ticket} code={ticket} tvCode={formData.code} />
                ))}
            </div>
          </div>
          
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-skyworth-blue text-white font-sport text-2xl rounded-lg hover:bg-skyworth-dark transition-colors shadow-lg">
            VOLVER AL CAMPO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-gray-100 font-sans">
      {loading && (
        <div className="fixed inset-0 z-[60] bg-skyworth-dark bg-opacity-90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="w-20 h-20 border-4 border-white border-t-skyworth-accent rounded-full animate-spin mb-4"></div>
          <h2 className="text-3xl font-sport text-white tracking-widest">CALENTANDO MOTORES...</h2>
          <p className="text-skyworth-accent text-sm mt-2">Validando tu jugada en el sistema.</p>
        </div>
      )}

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} onAccept={() => setFormData(prev => ({ ...prev, terms: true }))} />
      <ScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScan={handleScanResult} />
      <CheckTicketsModal isOpen={showCheckTickets} onClose={() => setShowCheckTickets(false)} />

      {/* Hero Section Mundial */}
      <header className="bg-stadium-gradient text-white py-12 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern-soccer opacity-10"></div>
        
        {/* Luces del estadio decorativas */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-skyworth-light opacity-30 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-skyworth-accent opacity-20 rounded-full blur-[100px]"></div>

        <div className="absolute top-6 right-6 z-20">
          <button onClick={() => setShowCheckTickets(true)} className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-white hover:text-skyworth-blue transition flex items-center gap-2 shadow-xl">
             🏆 Consultar Resultados
          </button>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto mt-8">
          <div className="inline-block bg-skyworth-accent text-skyworth-dark px-4 py-1 rounded font-bold text-xs tracking-widest mb-4">EDICIÓN MUNDIAL 2025</div>
          <h1 className="text-6xl md:text-8xl font-sport mb-2 tracking-tighter leading-none drop-shadow-lg">
            GANA EL <span className="text-skyworth-accent">MUNDIAL</span> <br/>CON SKYWORTH
          </h1>
          <p className="text-xl text-gray-200 font-light max-w-2xl mx-auto mb-4">
            Tu pasión vale oro. Registra tu TV y participa por premios de campeonato.
          </p>
          
          <Countdown />

          <button onClick={() => document.getElementById('main-form')?.scrollIntoView({behavior: 'smooth'})} className="bg-gradient-to-r from-skyworth-grass to-[#1E7E34] text-white px-10 py-4 rounded-full font-sport text-2xl hover:scale-105 transition transform shadow-[0_0_20px_rgba(40,167,69,0.6)] border-2 border-[#28A745] mt-8 relative z-20 tracking-wider">
             SALTAR A LA CANCHA
          </button>
        </div>
      </header>

      {/* Steps en formato táctico */}
      <section className="py-12 bg-white relative">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-sport text-center text-skyworth-dark mb-12">LA TÁCTICA PARA GANAR</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {/* Step 1 */}
            <div className="group bg-gray-50 hover:bg-skyworth-blue hover:text-white transition-all duration-300 p-8 rounded-2xl border border-gray-100 shadow-lg text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gray-200 group-hover:bg-skyworth-accent text-gray-500 group-hover:text-skyworth-dark font-sport text-4xl p-4 rounded-bl-2xl transition-colors">01</div>
              <div className="w-20 h-20 mx-auto bg-blue-100 group-hover:bg-white/20 rounded-full flex items-center justify-center mb-6 text-skyworth-blue group-hover:text-white transition-colors">
                <TVBallIcon />
              </div>
              <h3 className="text-2xl font-sport mb-2">UBICA TU EQUIPO</h3>
              <p className="text-sm opacity-80">Encuentra el código serial (tu número de camiseta) en la parte trasera de tu Skyworth.</p>
            </div>

            {/* Step 2 */}
            <div className="group bg-gray-50 hover:bg-skyworth-blue hover:text-white transition-all duration-300 p-8 rounded-2xl border border-gray-100 shadow-lg text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-gray-200 group-hover:bg-skyworth-accent text-gray-500 group-hover:text-skyworth-dark font-sport text-4xl p-4 rounded-bl-2xl transition-colors">02</div>
              <div className="w-20 h-20 mx-auto bg-blue-100 group-hover:bg-white/20 rounded-full flex items-center justify-center mb-6 text-skyworth-blue group-hover:text-white transition-colors">
                <JerseyIcon />
              </div>
              <h3 className="text-2xl font-sport mb-2">REGISTRA TU PASE</h3>
              <p className="text-sm opacity-80">Llena la ficha técnica con tus datos y sube tu identificación oficial.</p>
            </div>

            {/* Step 3 */}
            <div className="group bg-gray-50 hover:bg-skyworth-blue hover:text-white transition-all duration-300 p-8 rounded-2xl border border-gray-100 shadow-lg text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-gray-200 group-hover:bg-skyworth-accent text-gray-500 group-hover:text-skyworth-dark font-sport text-4xl p-4 rounded-bl-2xl transition-colors">03</div>
              <div className="w-20 h-20 mx-auto bg-blue-100 group-hover:bg-white/20 rounded-full flex items-center justify-center mb-6 text-skyworth-blue group-hover:text-white transition-colors">
                <TrophyIcon />
              </div>
              <h3 className="text-2xl font-sport mb-2">LEVANTA LA COPA</h3>
              <p className="text-sm opacity-80">Recibe tus tickets dorados al instante y espera el pitazo final del sorteo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Form Pitch */}
      <main id="main-form" className="flex-grow py-16 px-4 bg-skyworth-dark relative">
        {/* Decoración de cancha */}
        <div className="absolute inset-0 grass-pattern opacity-10"></div>
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-skyworth-accent via-white to-skyworth-accent"></div>

        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden relative z-10">
          {/* Tablero de Marcador */}
          <div className="flex bg-gray-900 text-white p-2">
            <button 
                onClick={() => setActiveTab('EXISTING')} 
                className={`flex-1 py-4 text-center font-sport text-2xl tracking-wider transition-all transform ${activeTab === 'EXISTING' ? 'bg-skyworth-blue text-skyworth-accent scale-105 shadow-lg z-10 rounded' : 'text-gray-500 hover:text-white'}`}
            >
                YA TENGO EQUIPO
            </button>
            <div className="w-1 bg-gray-700"></div>
            <button 
                onClick={() => setActiveTab('NEW_PURCHASE')} 
                className={`flex-1 py-4 text-center font-sport text-2xl tracking-wider transition-all transform ${activeTab === 'NEW_PURCHASE' ? 'bg-skyworth-blue text-skyworth-accent scale-105 shadow-lg z-10 rounded' : 'text-gray-500 hover:text-white'}`}
            >
                FICHAJE NUEVO
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8 bg-white">
            <div className="text-center mb-4">
              <h3 className="text-3xl font-sport text-skyworth-dark uppercase">{activeTab === 'EXISTING' ? 'Alineación Veterana' : 'Nuevo Fichaje Estrella'}</h3>
              <div className="h-1 w-20 bg-skyworth-accent mx-auto mt-2"></div>
            </div>

            {error && <div className="bg-red-50 border-l-8 border-red-600 p-4 text-red-800 animate-pulse font-bold flex items-center gap-2"><span>🟥</span> {error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="text-xs font-bold text-gray-400">JUGADOR</label>
                <input required name="firstName" placeholder="Nombres" value={formData.firstName} onChange={handleInputChange} className="w-full p-3 border-b-2 border-gray-200 focus:border-skyworth-blue outline-none transition bg-gray-50 focus:bg-white" />
              </div>
              <div className="group">
                <label className="text-xs font-bold text-gray-400">APELLIDOS</label>
                <input required name="lastName" placeholder="Apellidos" value={formData.lastName} onChange={handleInputChange} className="w-full p-3 border-b-2 border-gray-200 focus:border-skyworth-blue outline-none transition bg-gray-50 focus:bg-white" />
              </div>
              <div className="group">
                <label className="text-xs font-bold text-gray-400">DNI / CÉDULA</label>
                <input required name="ci" placeholder="Documento de Identidad" value={formData.ci} onChange={handleInputChange} className="w-full p-3 border-b-2 border-gray-200 focus:border-skyworth-blue outline-none transition bg-gray-50 focus:bg-white" />
              </div>
              <div className="group">
                <label className="text-xs font-bold text-gray-400">SEDE / CIUDAD</label>
                <input required name="city" placeholder="Ciudad de residencia" value={formData.city} onChange={handleInputChange} className="w-full p-3 border-b-2 border-gray-200 focus:border-skyworth-blue outline-none transition bg-gray-50 focus:bg-white" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="text-xs font-bold text-gray-400">EMAIL</label>
                <input required type="email" name="email" placeholder="correo@ejemplo.com" value={formData.email} onChange={handleInputChange} className="w-full p-3 border-b-2 border-gray-200 focus:border-skyworth-blue outline-none transition bg-gray-50 focus:bg-white" />
              </div>
              <div className="group">
                <label className="text-xs font-bold text-gray-400">WHATSAPP</label>
                <input required type="tel" name="phone" placeholder="Número de celular" value={formData.phone} onChange={handleInputChange} className="w-full p-3 border-b-2 border-gray-200 focus:border-skyworth-blue outline-none transition bg-gray-50 focus:bg-white" />
              </div>
            </div>

            <div className="bg-stadium-gradient p-6 rounded-xl border border-skyworth-blue relative text-white shadow-inner">
              <label className="block text-sm font-sport tracking-widest text-skyworth-accent mb-2">SERIAL DEL TV (TU DORSAL)</label>
              <div className="flex gap-2">
                <input required name="code" value={formData.code} onChange={handleInputChange} placeholder="ESCRIBE EL CÓDIGO..." className="flex-1 p-3 rounded font-mono text-lg uppercase text-skyworth-dark focus:ring-4 focus:ring-skyworth-accent outline-none font-bold" />
                <button type="button" onClick={() => setShowScanner(true)} className="bg-skyworth-accent text-skyworth-dark px-6 rounded hover:bg-white transition flex items-center gap-2 font-bold font-sport text-xl">
                    📸 ESCANEAR
                </button>
              </div>
              <p className="text-xs text-blue-200 mt-2 flex items-center gap-1">ℹ️ Encuéntralo en la etiqueta trasera del televisor.</p>
            </div>

            <div className="space-y-4 pt-4">
              <h4 className="font-sport text-xl text-skyworth-dark border-b pb-2">DOCUMENTACIÓN REGLAMENTARIA</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`relative border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer group ${files.ciFront ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-skyworth-blue'}`}>
                  <label className="block w-full h-full cursor-pointer">
                    <span className="block text-3xl mb-2 group-hover:scale-110 transition">🪪</span>
                    <span className="text-xs font-bold text-gray-500 uppercase">CI (Anverso)</span>
                    <p className="text-[10px] text-gray-400 mt-1">{files.ciFront ? files.ciFront.name : 'Max 5MB'}</p>
                    <input required type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ciFront')} className="hidden" />
                  </label>
                  {files.ciFront && <div className="absolute top-2 right-2 text-green-600">✓</div>}
                </div>
                
                <div className={`relative border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer group ${files.ciBack ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-skyworth-blue'}`}>
                  <label className="block w-full h-full cursor-pointer">
                    <span className="block text-3xl mb-2 group-hover:scale-110 transition">🔙</span>
                    <span className="text-xs font-bold text-gray-500 uppercase">CI (Reverso)</span>
                    <p className="text-[10px] text-gray-400 mt-1">{files.ciBack ? files.ciBack.name : 'Max 5MB'}</p>
                    <input required type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ciBack')} className="hidden" />
                  </label>
                  {files.ciBack && <div className="absolute top-2 right-2 text-green-600">✓</div>}
                </div>
              </div>
              
              {activeTab === 'NEW_PURCHASE' && (
                <div className={`relative border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer group ${files.invoice ? 'border-yellow-500 bg-yellow-50' : 'border-yellow-300 bg-yellow-50/50 hover:bg-yellow-50'}`}>
                  <label className="block w-full h-full cursor-pointer">
                    <span className="block text-3xl mb-2 group-hover:scale-110 transition">🧾</span>
                    <span className="text-xs font-bold text-yellow-800 uppercase">Factura de Compra</span>
                    <p className="text-[10px] text-gray-400 mt-1">{files.invoice ? files.invoice.name : 'PDF/Img Max 5MB'}</p>
                    <input required type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'invoice')} className="hidden" />
                  </label>
                  {files.invoice && <div className="absolute top-2 right-2 text-green-600">✓</div>}
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 mt-6 p-4 bg-gray-50 rounded border border-gray-100">
              <input required type="checkbox" name="terms" checked={formData.terms} onChange={handleInputChange} className="w-5 h-5 text-skyworth-blue rounded mt-1 cursor-pointer" />
              <span className="text-sm text-gray-600 leading-tight">Juego Limpio: Acepto los <button type="button" onClick={() => setShowTerms(true)} className="text-skyworth-blue font-bold underline">Términos y Condiciones</button> del campeonato Skyworth 2025.</span>
            </div>

            <button disabled={loading} type="submit" className={`w-full py-5 rounded-lg text-white font-sport text-3xl tracking-wider shadow-xl transform transition-all ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-skyworth-grass to-skyworth-pitch hover:scale-[1.02] hover:shadow-2xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1'}`}>
              {loading ? 'PROCESANDO JUGADA...' : 'ANOTAR GOL Y REGISTRAR'}
            </button>
          </form>
        </div>
      </main>

      <FAQ />
      
      <footer className="bg-skyworth-dark text-white text-center py-8 border-t-4 border-skyworth-accent">
        <p className="font-sport text-xl tracking-widest mb-2 text-skyworth-accent">SKYWORTH MUNDIAL</p>
        <p className="text-sm opacity-60">© 2025 Skyworth Promo. Juega responsablemente.</p>
        <div className="mt-4">
            <button className="text-xs opacity-30 hover:opacity-100 cursor-pointer px-3 py-1 hover:text-skyworth-accent transition" onClick={() => window.location.hash = '#admin'}>Zona Técnica (Admin)</button>
        </div>
      </footer>
    </div>
  );
}