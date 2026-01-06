import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, limit, getDocs, where, getCountFromServer, doc, getDoc, startAfter } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { auth, functions, db, storage } from '../firebase';
import { Participant, Ticket, TVCode } from '../types';

// Componente auxiliar para resolver URLs de Storage de forma segura
const SecureFileLink = ({ path, label, color = "blue" }: { path: string, label: string, color?: "blue" | "yellow" }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    if (path === 'MANUAL') { setUrl('#'); return; }
    const fetchUrl = async () => {
      try {
        const fileRef = ref(storage, path);
        const link = await getDownloadURL(fileRef);
        setUrl(link);
      } catch (e) {
        console.error("Error cargando archivo:", path, e);
        setError(true);
      }
    };
    fetchUrl();
  }, [path]);

  if (path === 'MANUAL') return <span className="text-xs text-gray-400 border px-2 py-1 rounded bg-gray-50">MANUAL</span>;
  if (error) return <span className="text-xs text-red-400" title="No se pudo cargar">❌ {label}</span>;
  if (!url) return <span className="text-xs text-gray-400 animate-pulse">⌛ {label}...</span>;

  const colors = color === "yellow" 
    ? "border-yellow-200 text-yellow-700 hover:bg-yellow-50" 
    : "border-skyworth-blue text-skyworth-blue hover:bg-blue-50";

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noreferrer" 
      className={`block text-center text-xs font-semibold border px-2 py-1 rounded transition ${colors}`}
    >
      📄 {label}
    </a>
  );
};

export default function AdminPanel() {
  const [activeSection, setActiveSection] = useState<'DASHBOARD' | 'CODES' | 'MANUAL' | 'PARTICIPANTS' | 'TICKET_CHECK' | 'RAFFLE' | 'CONFIG'>('DASHBOARD');
  
  // States Dashboard
  const [stats, setStats] = useState({ participants: 0, tickets: 0, codes: 0 });
  const [chartData, setChartData] = useState<{date: string, count: number}[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [health, setHealth] = useState({ whatsapp: false, email: false, webhook: false });
  const [analytics, setAnalytics] = useState<{ cityCount: any, modelCount: any } | null>(null);
  
  // States para Códigos
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [codesList, setCodesList] = useState<TVCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeFilter, setCodeFilter] = useState<'ALL' | 'USED' | 'AVAILABLE'>('ALL');
  const [codeSearch, setCodeSearch] = useState('');
  const [lastCodeDoc, setLastCodeDoc] = useState<string | null>(null);
  
  // States para Manual Register
  const [manualForm, setManualForm] = useState({ code: '', firstName: '', lastName: '', email: '', phone: '', ci: '' });
  const [manualLoading, setManualLoading] = useState(false);
  
  // States para Config
  const [waConfig, setWaConfig] = useState({ whatsappToken: '', whatsappPhoneId: '' });
  const [emailConfig, setEmailConfig] = useState({ apiKey: '', fromEmail: '' });
  const [webhookConfig, setWebhookConfig] = useState({ webhookUrl: '' });
  const [generalConfig, setGeneralConfig] = useState({ raffleDate: '' });

  // States para Participantes
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingPart, setLoadingPart] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastDoc, setLastDoc] = useState<any>(null); // Para paginación
  const [page, setPage] = useState(1);

  // States para Ticket Check
  const [checkTicketId, setCheckTicketId] = useState('');
  const [foundTicket, setFoundTicket] = useState<any | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);

  // States para Raffle
  const [raffleWinner, setRaffleWinner] = useState<any | null>(null);
  const [isRaffling, setIsRaffling] = useState(false);

  // --- Helpers ---
  const fetchStats = async () => {
      setStatsError(null);
      let errorCount = 0;

      // 1. Contadores Rápidos
      try {
        const snapshotP = await getCountFromServer(collection(db, "participants"));
        setStats(prev => ({ ...prev, participants: snapshotP.data().count }));
        
        const snapshotT = await getCountFromServer(collection(db, "tickets"));
        setStats(prev => ({ ...prev, tickets: snapshotT.data().count }));
        
        const snapshotC = await getCountFromServer(query(collection(db, "tv_codes"), where("used", "==", true)));
        setStats(prev => ({ ...prev, codes: snapshotC.data().count }));
      } catch (e: any) {
        if (e.code === 'permission-denied') errorCount++;
      }

      // 2. Health Check
      try {
        const healthFn = httpsCallable(functions, 'getSystemHealth');
        const hRes = await healthFn();
        setHealth(hRes.data as any);
      } catch(e) { console.error(e); }

      // 3. Analytics (Ciudades y Modelos)
      try {
         const analyticsFn = httpsCallable(functions, 'getCampaignAnalytics');
         const aRes = await analyticsFn();
         setAnalytics(aRes.data as any);
      } catch(e) { console.error(e); }

      // 4. Actividad (Chart) - Últimos 7 días
      try {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const qRecent = query(collection(db, "participants"), where("createdAt", ">=", sevenDaysAgo));
          const snapRecent = await getDocs(qRecent);
          const counts: {[key: string]: number} = {};
          for(let i=6; i>=0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const k = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
              counts[k] = 0;
          }
          snapRecent.forEach(doc => {
              const data = doc.data();
              if (data.createdAt && data.createdAt.seconds) {
                  const date = new Date(data.createdAt.seconds * 1000);
                  const key = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                  if (counts[key] !== undefined) counts[key]++;
              }
          });
          setChartData(Object.keys(counts).map(key => ({ date: key, count: counts[key] })));
      } catch (e) { console.error("Error fetching chart data", e); }

      if (errorCount > 0) setStatsError("Permisos insuficientes.");
  };

  useEffect(() => {
      if (activeSection === 'DASHBOARD') fetchStats();
      if (activeSection === 'PARTICIPANTS') fetchParticipants(true); 
      if (activeSection === 'CODES') fetchCodes(true);
      if (activeSection === 'CONFIG') fetchGeneralConfig();
  }, [activeSection]);

  const fetchGeneralConfig = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'campaign_config', 'general'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGeneralConfig({ raffleDate: data.raffleDate || '' });
      }
    } catch (e) {
      console.error("Error fetching general config", e);
    }
  };

  // --- Handlers Códigos ---
  const fetchCodes = async (reset = false) => {
    setCodesLoading(true);
    try {
        const adminGetCodesFn = httpsCallable(functions, 'adminGetCodes');
        const res = await adminGetCodesFn({
            pageSize: 20,
            lastCode: reset ? null : lastCodeDoc,
            filter: codeFilter,
            search: codeSearch
        });
        
        const data = res.data as { codes: TVCode[], lastCode: string | null };
        
        if (reset) {
            setCodesList(data.codes);
        } else {
            setCodesList(prev => [...prev, ...data.codes]);
        }
        setLastCodeDoc(data.lastCode);
    } catch (e) {
        console.error("Error fetching codes", e);
    } finally {
        setCodesLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "code,tvModel,inches,ticketMultiplier\nSKY1001,55SUE9500,55,\nSKY1002,32STD6500,32,1";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_codigos_skyworth.csv";
    link.click();
  };

  const handleUploadCodes = async () => {
    if (!csvFile) return;
    setUploadStatus('Leyendo archivo...');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      setUploadStatus('Enviando al servidor... Esto puede tardar si son muchos códigos.');
      const adminUploadCodes = httpsCallable(functions, 'adminUploadCodes');
      try {
        const res = await adminUploadCodes({ csvContent: text });
        setUploadStatus(`Resultado: ${(res.data as any).message}`);
        fetchCodes(true); 
      } catch (err: any) {
        setUploadStatus(`Error: ${err.message}`);
      }
    };
    reader.readAsText(csvFile);
  };

  const handleSeedTestCodes = async () => {
    if(!confirm("¿Generar códigos de prueba (TEST-XX-XXX)?")) return;
    setUploadStatus('Generando...');
    try {
      const seedFn = httpsCallable(functions, 'seedTestCodes');
      const res = await seedFn();
      setUploadStatus((res.data as any).message);
      fetchCodes(true);
      fetchStats(); 
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message}`);
    }
  };

  // --- Manual Registration ---
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!confirm('¿Confirmas el registro manual? El usuario recibirá notificaciones inmediatamente.')) return;
    
    setManualLoading(true);
    try {
        const regFn = httpsCallable(functions, 'adminManualRegistration');
        const res = await regFn(manualForm);
        alert(`Registro Exitoso.\nTickets generados: ${(res.data as any).tickets.join(', ')}`);
        setManualForm({ code: '', firstName: '', lastName: '', email: '', phone: '', ci: '' });
    } catch (e: any) {
        alert(`Error: ${e.message}`);
    } finally {
        setManualLoading(false);
    }
  };

  // --- Handlers Config ---
  const handleSaveWaConfig = async () => {
    try {
      await httpsCallable(functions, 'setWhatsappConfig')({ phoneNumberId: waConfig.whatsappPhoneId, accessToken: waConfig.whatsappToken });
      alert('Configuración WhatsApp guardada.');
    } catch (err) { alert('Error al guardar.'); }
  };

  const handleSaveEmailConfig = async () => {
    try {
      await httpsCallable(functions, 'setEmailConfig')({ ...emailConfig, provider: 'sendgrid' });
      alert('Configuración Email guardada.');
    } catch (err) { alert('Error al guardar.'); }
  };

  const handleSaveWebhookConfig = async () => {
    try {
      await httpsCallable(functions, 'setWebhookConfig')({ webhookUrl: webhookConfig.webhookUrl, provider: 'Pabbly' });
      alert('Webhook configurado exitosamente.');
    } catch (err) { alert('Error al guardar webhook.'); }
  };

  const handleSaveGeneralConfig = async () => {
    try {
      await httpsCallable(functions, 'setGeneralConfig')({ raffleDate: generalConfig.raffleDate });
      alert('Fecha del sorteo guardada.');
    } catch (err) { alert('Error al guardar fecha.'); }
  };

  // --- Handlers Participantes ---
  const fetchParticipants = async (reset = false) => {
    setLoadingPart(true);
    try {
      let q;
      const PAGE_SIZE = 50;
      
      if (searchTerm) {
        const term = searchTerm.trim();
        if (term.includes('@')) {
           q = query(collection(db, 'participants'), where('email', '==', term));
        } else if (term.length > 5 && !term.startsWith('SKY-')) {
           q = query(collection(db, 'participants'), where('code', '==', term.toUpperCase()));
        } else {
           alert("Búsqueda solo por Email o Código TV exacto.");
           setLoadingPart(false);
           return;
        }
      } else {
         if (reset) {
            q = query(collection(db, 'participants'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
            setPage(1);
         } else if (lastDoc) {
            q = query(collection(db, 'participants'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
            setPage(prev => prev + 1);
         } else {
            setLoadingPart(false);
            return;
         }
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => doc.data() as Participant);
      
      if (reset || searchTerm) {
        setParticipants(data);
      } else {
        setParticipants(prev => [...prev, ...data]);
      }

      if (!searchTerm && snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      } else if (!searchTerm) {
        setLastDoc(null);
      }

    } catch (error) {
      console.error("Error fetching participants:", error);
    } finally {
      setLoadingPart(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
        const q = query(collection(db, 'participants'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            alert("No hay datos para exportar.");
            setExporting(false);
            return;
        }

        const allData = snapshot.docs.map(doc => doc.data() as Participant);
        const headers = ["ID", "Fecha", "Campaña", "Nombre", "Email", "Teléfono", "Ciudad", "Código TV", "Tickets", "Notif Email", "Notif WA"];
        const rows = allData.map(p => [
            p.participantId,
            p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toISOString() : '',
            p.campaignType,
            `"${p.fullName}"`,
            p.email,
            p.phone,
            p.city,
            p.code,
            p.ticketsCount,
            p.notified.email ? "YES" : "NO",
            p.notified.whatsapp ? "YES" : "NO"
        ]);

        const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `skyworth_FULL_DB_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    } catch (error: any) {
        alert(`Error: ${error.message}`);
    } finally {
        setExporting(false);
    }
  };

  const handleRetryNotification = async (participantId: string) => {
    if (!confirm('¿Reintentar envío de notificaciones?')) return;
    try {
      const retry = httpsCallable(functions, 'retryNotification');
      await retry({ participantId });
      alert('Encolado para reintento.');
      fetchParticipants(true); 
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // --- Handler Ticket Check ---
  const handleCheckTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkTicketId) return;
    
    setTicketLoading(true);
    setFoundTicket(null);
    try {
      const ticketRef = doc(db, 'tickets', checkTicketId.trim().toUpperCase());
      const ticketSnap = await getDoc(ticketRef);
      
      if (ticketSnap.exists()) {
        const ticketData = ticketSnap.data() as Ticket;
        const partRef = doc(db, 'participants', ticketData.participantId);
        const partSnap = await getDoc(partRef);
        
        setFoundTicket({
          ...ticketData,
          participant: partSnap.exists() ? partSnap.data() : null
        });
      } else {
        alert("Ticket no encontrado.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al buscar ticket.");
    } finally {
      setTicketLoading(false);
    }
  };

  // --- Handler Raffle ---
  const handlePickWinner = async () => {
    if (!confirm('¿Estás seguro de sortear un ganador ahora?')) return;
    
    setIsRaffling(true);
    setRaffleWinner(null);
    
    try {
      await new Promise(r => setTimeout(r, 2000));
      
      const pickWinnerFn = httpsCallable(functions, 'pickWinner');
      const result = await pickWinnerFn();
      
      await new Promise(r => setTimeout(r, 500));
      setRaffleWinner(result.data);
    } catch (err: any) {
      alert(`Error en el sorteo: ${err.message}`);
    } finally {
      setIsRaffling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-skyworth-dark text-white flex flex-col fixed h-full z-10 shadow-2xl">
        <div className="p-6 font-sport text-3xl tracking-wider border-b border-white/10 flex items-center gap-2">
            <span className="text-skyworth-accent">⚡</span> ZONA DT
        </div>
        <nav className="flex-1 py-4 space-y-1">
          <button onClick={() => setActiveSection('DASHBOARD')} className={`w-full text-left px-6 py-4 hover:bg-skyworth-blue transition flex items-center gap-3 ${activeSection === 'DASHBOARD' ? 'bg-skyworth-blue border-r-4 border-skyworth-accent text-white' : 'text-gray-400'}`}>
            <span>📊</span> Tablero
          </button>
          <button onClick={() => setActiveSection('CODES')} className={`w-full text-left px-6 py-4 hover:bg-skyworth-blue transition flex items-center gap-3 ${activeSection === 'CODES' ? 'bg-skyworth-blue border-r-4 border-skyworth-accent text-white' : 'text-gray-400'}`}>
            <span>🏷️</span> Cargar Series
          </button>
           <button onClick={() => setActiveSection('MANUAL')} className={`w-full text-left px-6 py-4 hover:bg-skyworth-blue transition flex items-center gap-3 ${activeSection === 'MANUAL' ? 'bg-skyworth-blue border-r-4 border-skyworth-accent text-white' : 'text-gray-400'}`}>
            <span>📝</span> Reg. Manual
          </button>
          <button onClick={() => setActiveSection('PARTICIPANTS')} className={`w-full text-left px-6 py-4 hover:bg-skyworth-blue transition flex items-center gap-3 ${activeSection === 'PARTICIPANTS' ? 'bg-skyworth-blue border-r-4 border-skyworth-accent text-white' : 'text-gray-400'}`}>
            <span>👥</span> Jugadores
          </button>
          <button onClick={() => setActiveSection('TICKET_CHECK')} className={`w-full text-left px-6 py-4 hover:bg-skyworth-blue transition flex items-center gap-3 ${activeSection === 'TICKET_CHECK' ? 'bg-skyworth-blue border-r-4 border-skyworth-accent text-white' : 'text-gray-400'}`}>
            <span>🎟️</span> VAR (Verificar)
          </button>
          <button onClick={() => setActiveSection('RAFFLE')} className={`w-full text-left px-6 py-4 hover:bg-skyworth-blue transition flex items-center gap-3 ${activeSection === 'RAFFLE' ? 'bg-skyworth-blue border-r-4 border-skyworth-accent text-white' : 'text-gray-400'}`}>
            <span>🏆</span> Copa (Sorteo)
          </button>
          <button onClick={() => setActiveSection('CONFIG')} className={`w-full text-left px-6 py-4 hover:bg-skyworth-blue transition flex items-center gap-3 ${activeSection === 'CONFIG' ? 'bg-skyworth-blue border-r-4 border-skyworth-accent text-white' : 'text-gray-400'}`}>
            <span>⚙️</span> Ajustes
          </button>
        </nav>
        <div className="p-4 border-t border-white/10 bg-black/20">
            <div className="text-xs text-gray-400 mb-2 truncate">DT: {auth.currentUser?.email}</div>
            <button onClick={() => auth.signOut()} className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold transition">Finalizar Partido</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
            <h1 className="text-4xl font-sport text-skyworth-dark uppercase">
            {activeSection === 'DASHBOARD' && 'Estadísticas del Torneo'}
            {activeSection === 'CODES' && 'Alineación de Productos'}
            {activeSection === 'MANUAL' && 'Registro Técnico (Manual)'}
            {activeSection === 'PARTICIPANTS' && 'Fichajes Registrados'}
            {activeSection === 'TICKET_CHECK' && 'Arbitraje (Validar)'}
            {activeSection === 'RAFFLE' && 'La Gran Final'}
            {activeSection === 'CONFIG' && 'Reglamento Técnico'}
            </h1>
            <div className="text-sm font-bold text-gray-400 bg-white px-3 py-1 rounded shadow-sm">📅 {new Date().toLocaleDateString()}</div>
        </header>

        {statsError && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm animate-pulse flex justify-between items-center">
             <div>
               <p className="font-bold">Tarjeta Roja: Error de Permisos</p>
               <p className="text-sm">Tu usuario no tiene permisos de lectura en la base de datos.</p>
             </div>
             <button onClick={fetchStats} className="px-3 py-1 bg-red-200 hover:bg-red-300 rounded text-sm font-bold">Reintentar</button>
          </div>
        )}

        {/* --- SECCIÓN DASHBOARD --- */}
        {activeSection === 'DASHBOARD' && (
            <div className="space-y-8 animate-fade-in">
                {/* Health Check Alert */}
                {(!health.email && !health.whatsapp && !health.webhook) && (
                   <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded text-yellow-800 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="font-bold">⚠️ Configuración Incompleta</p>
                        <p className="text-sm">El sistema no tiene métodos de notificación configurados. Ve a "Ajustes" para conectar Email, WhatsApp o Pabbly.</p>
                      </div>
                      <button onClick={() => setActiveSection('CONFIG')} className="bg-white border border-yellow-300 px-3 py-1 rounded font-bold text-sm hover:bg-yellow-100">Configurar</button>
                   </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-skyworth-blue">
                        <div className="text-gray-400 text-sm font-bold uppercase tracking-widest">Jugadores Inscritos</div>
                        <div className="text-5xl font-sport text-skyworth-dark mt-2">{stats.participants}</div>
                        <div className="text-xs text-green-600 font-bold mt-2 bg-green-50 inline-block px-2 py-1 rounded">▲ Activos</div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-skyworth-accent">
                        <div className="text-gray-400 text-sm font-bold uppercase tracking-widest">Tickets en Juego</div>
                        <div className="text-5xl font-sport text-skyworth-dark mt-2">{stats.tickets}</div>
                        <div className="text-xs text-yellow-600 font-bold mt-2 bg-yellow-50 inline-block px-2 py-1 rounded">● Oportunidades</div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-skyworth-grass">
                        <div className="text-gray-400 text-sm font-bold uppercase tracking-widest">Series Canjeadas</div>
                        <div className="text-5xl font-sport text-skyworth-dark mt-2">{stats.codes}</div>
                        <div className="text-xs text-blue-600 font-bold mt-2 bg-blue-50 inline-block px-2 py-1 rounded">■ Productos</div>
                    </div>
                </div>

                {/* BUSINESS ANALYTICS CHARTS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* TOP MODELS CHART */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="text-lg font-bold text-skyworth-dark mb-4 border-b pb-2">🏆 MODELOS ESTRELLA</h3>
                        <div className="space-y-3">
                           {analytics && Object.entries(analytics.modelCount).sort((a:any,b:any) => b[1]-a[1]).slice(0,5).map(([model, count]: any, idx) => (
                             <div key={idx} className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-gray-500 w-24 truncate" title={model}>{model}</span>
                                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-skyworth-blue" style={{ width: `${(count / Math.max(...Object.values(analytics.modelCount) as number[])) * 100}%` }}></div>
                                </div>
                                <span className="text-xs font-bold">{count}</span>
                             </div>
                           ))}
                           {!analytics && <div className="text-center text-gray-400 text-xs py-4">Cargando datos del mercado...</div>}
                        </div>
                    </div>

                    {/* TOP CITIES CHART */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="text-lg font-bold text-skyworth-dark mb-4 border-b pb-2">📍 MAPA DE CALOR</h3>
                        <div className="space-y-3">
                           {analytics && Object.entries(analytics.cityCount).sort((a:any,b:any) => b[1]-a[1]).slice(0,5).map(([city, count]: any, idx) => (
                             <div key={idx} className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-gray-500 w-24 truncate" title={city}>{city}</span>
                                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-skyworth-grass" style={{ width: `${(count / Math.max(...Object.values(analytics.cityCount) as number[])) * 100}%` }}></div>
                                </div>
                                <span className="text-xs font-bold">{count}</span>
                             </div>
                           ))}
                            {!analytics && <div className="text-center text-gray-400 text-xs py-4">Escaneando territorio...</div>}
                        </div>
                    </div>
                </div>

                {/* Activity Chart CSS */}
                <div className="bg-white p-8 rounded-xl shadow-lg">
                    <h3 className="text-xl font-sport text-skyworth-dark mb-6 border-b pb-2">RITMO DE JUEGO (ÚLTIMOS 7 DÍAS)</h3>
                    {chartData.length > 0 ? (
                        <div className="flex items-end justify-between h-64 gap-2">
                            {chartData.map((d, i) => {
                                const max = Math.max(...chartData.map(c => c.count), 1);
                                const height = (d.count / max) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                                        <div className="w-full bg-blue-50 rounded-t-lg relative overflow-hidden flex items-end justify-center transition-all duration-500 hover:bg-blue-100" style={{ height: '100%' }}>
                                            <div 
                                                className="w-full bg-skyworth-blue hover:bg-skyworth-light transition-all duration-500 relative"
                                                style={{ height: `${height}%` }}
                                            >
                                                {/* Tooltip on hover */}
                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none transition-opacity">
                                                    {d.count} Registros
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 font-bold mt-2">{d.date}</div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-400">
                            No hay datos recientes de actividad.
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* ... (RESTO DE LAS SECCIONES CODES, MANUAL, PARTICIPANTS, ETC. SE MANTIENEN IGUAL) ... */}
        {/* Simplemente renderizamos el resto de secciones que ya existían sin cambios */}
        {activeSection === 'CODES' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-full border border-gray-100 flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-skyworth-dark">Importar Plantilla Táctica</h3>
                  <button onClick={handleDownloadTemplate} className="text-sm text-skyworth-blue underline hover:text-skyworth-dark font-bold">⬇ Descargar CSV</button>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3 rounded mb-4 text-xs text-gray-600">
                    <p className="font-bold mb-1">Formato: code,tvModel,inches,ticketMultiplier</p>
                    <p className="text-[10px] text-gray-400">Si ticketMultiplier está vacío, se calcula: 32" (1), 50-60" (2), 65"+ (3)</p>
                </div>
                <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files ? e.target.files[0] : null)} className="block w-full text-xs text-slate-500 mb-4 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-skyworth-blue file:text-white hover:file:bg-skyworth-dark cursor-pointer" />
                <div className="flex gap-2">
                    <button onClick={handleUploadCodes} disabled={!csvFile} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 disabled:opacity-50 font-bold transition flex-1 text-sm">SUBIR</button>
                    <button onClick={handleSeedTestCodes} className="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 font-bold transition text-sm">DEMO</button>
                </div>
                {uploadStatus && <div className="mt-4 p-2 bg-gray-100 rounded border font-mono text-xs whitespace-pre-wrap">{uploadStatus}</div>}
              </div>
              <div className="flex-1 border-l pl-8">
                 <h3 className="font-bold text-lg text-skyworth-dark mb-4">Buscar en la Plantilla</h3>
                 <div className="flex gap-2 mb-4">
                    <input type="text" placeholder="Buscar Código..." value={codeSearch} onChange={e => setCodeSearch(e.target.value)} className="flex-1 p-2 border rounded text-sm uppercase" />
                    <button onClick={() => fetchCodes(true)} className="bg-skyworth-blue text-white px-3 rounded font-bold text-sm">🔍</button>
                 </div>
                 <div className="flex gap-2 text-sm">
                    <button onClick={() => { setCodeFilter('ALL'); setTimeout(() => fetchCodes(true), 100); }} className={`px-3 py-1 rounded border ${codeFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-white'}`}>Todos</button>
                    <button onClick={() => { setCodeFilter('USED'); setTimeout(() => fetchCodes(true), 100); }} className={`px-3 py-1 rounded border ${codeFilter === 'USED' ? 'bg-red-600 text-white' : 'bg-white text-red-600'}`}>Usados</button>
                    <button onClick={() => { setCodeFilter('AVAILABLE'); setTimeout(() => fetchCodes(true), 100); }} className={`px-3 py-1 rounded border ${codeFilter === 'AVAILABLE' ? 'bg-green-600 text-white' : 'bg-white text-green-600'}`}>Libres</button>
                 </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
               <table className="w-full text-sm text-left text-gray-500">
                 <thead className="text-xs text-white uppercase bg-skyworth-dark">
                    <tr>
                       <th className="px-6 py-3">Serie (Código)</th>
                       <th className="px-6 py-3">Modelo</th>
                       <th className="px-6 py-3">Pulgadas</th>
                       <th className="px-6 py-3">Multiplicador</th>
                       <th className="px-6 py-3 text-center">Estado</th>
                    </tr>
                 </thead>
                 <tbody>
                    {codesLoading ? (<tr><td colSpan={5} className="text-center py-8">Cargando alineación...</td></tr>) : codesList.map((code) => (
                        <tr key={code.code} className="border-b hover:bg-gray-50">
                           <td className="px-6 py-3 font-mono font-bold text-gray-700">{code.code}</td>
                           <td className="px-6 py-3">{code.tvModel}</td>
                           <td className="px-6 py-3">{code.inches}"</td>
                           <td className="px-6 py-3">x{code.ticketMultiplier}</td>
                           <td className="px-6 py-3 text-center">
                              {code.used ? (<span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">🔴 USADO</span>) : (<span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">🟢 LIBRE</span>)}
                           </td>
                        </tr>
                    ))}
                    {!codesLoading && codesList.length === 0 && (<tr><td colSpan={5} className="text-center py-8 text-gray-400">No se encontraron códigos.</td></tr>)}
                 </tbody>
               </table>
               {lastCodeDoc && (<div className="p-2 text-center border-t"><button onClick={() => fetchCodes(false)} className="text-skyworth-blue text-sm font-bold hover:underline">Cargar más...</button></div>)}
            </div>
          </div>
        )}

        {activeSection === 'MANUAL' && (
           <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border-t-4 border-orange-500">
             <h2 className="text-2xl font-bold text-gray-800 mb-2">Registro de Soporte (Manual)</h2>
             <p className="text-sm text-gray-500 mb-6">Utiliza este formulario si un cliente no puede registrarse por la web.</p>
             <form onSubmit={handleManualSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 uppercase">Nombre</label><input required className="w-full border p-2 rounded" value={manualForm.firstName} onChange={e => setManualForm({...manualForm, firstName: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase">Apellido</label><input required className="w-full border p-2 rounded" value={manualForm.lastName} onChange={e => setManualForm({...manualForm, lastName: e.target.value})} /></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 uppercase">CI</label><input required className="w-full border p-2 rounded" value={manualForm.ci} onChange={e => setManualForm({...manualForm, ci: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase">Teléfono</label><input required className="w-full border p-2 rounded" value={manualForm.phone} onChange={e => setManualForm({...manualForm, phone: e.target.value})} /></div>
               </div>
               <div><label className="block text-xs font-bold text-gray-500 uppercase">Email</label><input required type="email" className="w-full border p-2 rounded" value={manualForm.email} onChange={e => setManualForm({...manualForm, email: e.target.value})} /></div>
               <div className="bg-gray-100 p-4 rounded"><label className="block text-xs font-bold text-skyworth-blue uppercase mb-1">Código del TV</label><input required className="w-full border-2 border-skyworth-blue p-2 rounded font-mono uppercase font-bold" value={manualForm.code} onChange={e => setManualForm({...manualForm, code: e.target.value})} placeholder="SKY..." /></div>
               <button disabled={manualLoading} type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded shadow transition">{manualLoading ? 'Procesando...' : 'REGISTRAR MANUALMENTE'}</button>
             </form>
           </div>
        )}

        {activeSection === 'PARTICIPANTS' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2 w-full md:w-auto">
                    <input type="text" placeholder="Buscar Email o TV..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 md:w-64 p-2 border rounded focus:ring-2 focus:ring-skyworth-blue outline-none" />
                    <button onClick={() => fetchParticipants(true)} className="bg-skyworth-blue text-white px-4 py-2 rounded hover:bg-skyworth-dark whitespace-nowrap font-bold text-sm">FILTRAR</button>
                </div>
                <button onClick={handleExportCSV} disabled={exporting} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow-sm transition font-bold text-sm disabled:opacity-50">{exporting ? 'GENERANDO...' : 'EXPORTAR REPORTE'}</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-white uppercase bg-skyworth-dark">
                        <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Jugador</th><th className="px-6 py-4">Campaña</th><th className="px-6 py-4">Equipo (TV)</th><th className="px-6 py-4 text-center">Tickets</th><th className="px-6 py-4">Docs</th><th className="px-6 py-4">Notificaciones</th><th className="px-6 py-4">Acciones</th></tr>
                    </thead>
                    <tbody>
                        {loadingPart ? (<tr><td colSpan={8} className="text-center py-12">Cargando...</td></tr>) : participants.map((p) => (
                            <tr key={p.participantId} className="bg-white border-b hover:bg-blue-50 transition">
                                <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">{p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : '-'}</td>
                                <td className="px-6 py-4"><div className="font-bold text-gray-900">{p.fullName}</div><div className="text-xs text-gray-500">{p.email}</div><div className="text-xs text-gray-400">{p.phone}</div></td>
                                <td className="px-6 py-4">{p.campaignType === 'NEW_PURCHASE' ? (<span className="bg-skyworth-accent text-skyworth-dark px-2 py-1 rounded text-xs font-bold">NUEVO FICHAJE</span>) : (<span className="bg-skyworth-blue text-white px-2 py-1 rounded text-xs font-bold">VETERANO</span>)}</td>
                                <td className="px-6 py-4"><span className="font-mono font-bold text-gray-700">{p.code}</span><div className="text-xs text-gray-500">{p.city}</div></td>
                                <td className="px-6 py-4 text-center"><span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-bold border border-gray-300">{p.ticketsCount}</span></td>
                                <td className="px-6 py-4"><div className="flex gap-1 flex-wrap"><SecureFileLink path={p.files.ciFrontPath} label="CI" />{p.files.invoicePath && <SecureFileLink path={p.files.invoicePath} label="FACT" color="yellow" />}</div></td>
                                <td className="px-6 py-4"><div className="flex flex-col gap-1 text-[10px] font-bold"><span className={p.notified.email ? "text-green-600" : "text-red-500"} title={p.notified.errors?.email || ""}>EMAIL: {p.notified.email ? "✓" : "✗"}</span><span className={p.notified.whatsapp ? "text-green-600" : "text-gray-400"} title={p.notified.errors?.whatsapp || ""}>WA: {p.notified.whatsapp ? "✓" : (p.notified.errors?.whatsapp ? "✗" : "-")}</span><span className={p.notified.webhook ? "text-purple-600" : "text-gray-400"} title={p.notified.errors?.webhook || ""}>HOOK: {p.notified.webhook ? "✓" : (p.notified.errors?.webhook ? "✗" : "-")}</span></div></td>
                                <td className="px-6 py-4"><button onClick={() => handleRetryNotification(p.participantId)} className="text-blue-600 hover:text-blue-900 font-bold text-[10px] border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 uppercase">REINTENTAR</button></td>
                            </tr>
                        ))}
                        {!loadingPart && participants.length === 0 && (<tr><td colSpan={8} className="text-center py-12 text-gray-400">Sin registros en la tabla.</td></tr>)}
                    </tbody>
                </table>
            </div>
            {!searchTerm && participants.length > 0 && (<div className="p-4 border-t bg-gray-50 flex justify-between items-center"><span className="text-xs text-gray-500">Página {page}</span><button onClick={() => fetchParticipants(false)} disabled={!lastDoc} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-bold hover:bg-gray-100 disabled:opacity-50">{lastDoc ? 'SIGUIENTE PÁGINA' : 'FINAL DEL JUEGO'}</button></div>)}
          </div>
        )}

        {activeSection === 'TICKET_CHECK' && (
           <div className="max-w-xl mx-auto">
             <div className="bg-white p-8 rounded-lg shadow-lg border-t-4 border-skyworth-blue">
                <h2 className="text-3xl font-sport text-center text-skyworth-dark mb-6">SALA VAR</h2>
                <form onSubmit={handleCheckTicket} className="flex gap-2 mb-6">
                    <input type="text" value={checkTicketId} onChange={e => setCheckTicketId(e.target.value.toUpperCase())} placeholder="TICKET ID (SKY-...)" className="flex-1 p-3 border-2 border-gray-200 focus:border-skyworth-blue rounded text-lg font-mono text-center uppercase tracking-wider outline-none" />
                    <button type="submit" disabled={ticketLoading} className="bg-skyworth-dark text-white px-6 rounded font-bold hover:bg-black transition">{ticketLoading ? '...' : 'REVISAR'}</button>
                </form>
                {foundTicket && (
                    <div className="bg-green-50 border-2 border-green-500 rounded p-6 animate-fade-in relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-2 py-1 font-bold rounded-bl">GOL VALIDADO</div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-700 mt-2">
                            <div><p className="font-bold text-green-800 uppercase text-xs">Jugador</p><p className="text-lg font-bold">{foundTicket.participant?.fullName}</p></div>
                            <div><p className="font-bold text-green-800 uppercase text-xs">Ubicación</p><p>{foundTicket.participant?.city}</p></div>
                            <div><p className="font-bold text-green-800 uppercase text-xs">Equipo (TV)</p><p className="font-mono">{foundTicket.tvCode} ({foundTicket.inches}")</p></div>
                            <div><p className="font-bold text-green-800 uppercase text-xs">Contacto</p><p>{foundTicket.participant?.phone}</p></div>
                        </div>
                    </div>
                )}
             </div>
           </div>
        )}

        {activeSection === 'RAFFLE' && (
            <div className="max-w-3xl mx-auto text-center">
                <div className="bg-white p-12 rounded-2xl shadow-2xl border-4 border-skyworth-accent relative overflow-hidden">
                    <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="relative z-10 mb-8">
                        <div className="text-6xl mb-4 animate-bounce">🏆</div>
                        <h2 className="text-5xl font-sport text-skyworth-dark uppercase tracking-wide">LA GRAN FINAL</h2>
                        <p className="text-gray-500 mt-2 font-bold">Sistema de Sorteo Certificado</p>
                    </div>
                    {!raffleWinner && !isRaffling && (<button onClick={handlePickWinner} className="bg-gradient-to-r from-skyworth-accent to-yellow-500 text-skyworth-dark text-2xl font-sport tracking-widest px-12 py-6 rounded-full shadow-xl hover:scale-105 transition transform relative z-10">INICIAR SORTEO</button>)}
                    {isRaffling && (<div className="flex flex-col items-center"><div className="w-20 h-20 border-8 border-gray-200 border-t-skyworth-accent rounded-full animate-spin mb-6"></div><p className="text-2xl font-sport text-skyworth-blue animate-pulse">BUSCANDO AL CAMPEÓN...</p></div>)}
                    {raffleWinner && !isRaffling && (
                        <div className="mt-8 animate-fade-in relative z-10">
                            <div className="bg-skyworth-dark text-white p-8 rounded-xl shadow-2xl border-2 border-skyworth-accent">
                                <p className="text-skyworth-accent font-sport text-2xl mb-2">¡TENEMOS CAMPEÓN!</p>
                                <div className="text-5xl font-mono font-bold text-white mb-6 tracking-wider border-b border-white/20 pb-4">{raffleWinner.ticket.codeString}</div>
                                <div className="grid grid-cols-2 gap-6 text-left">
                                    <div><p className="text-gray-400 text-xs uppercase font-bold">Nombre</p><p className="text-2xl font-bold">{raffleWinner.participant.fullName}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase font-bold">Ciudad</p><p className="text-xl">{raffleWinner.participant.city}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase font-bold">TV Registrado</p><p className="text-xl font-mono text-skyworth-accent">{raffleWinner.ticket.tvCode}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase font-bold">Teléfono</p><p className="text-lg">{raffleWinner.participant.phone}</p></div>
                                </div>
                                <div className="mt-8 flex gap-4 justify-center">
                                    <button onClick={() => setRaffleWinner(null)} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded font-bold transition">Reiniciar</button>
                                    <div className="bg-skyworth-blue px-4 py-2 rounded"><SecureFileLink path={raffleWinner.participant.files.ciFrontPath} label="VER DOCUMENTO" color="yellow" /></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeSection === 'CONFIG' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded shadow border-l-4 border-yellow-500">
               <h3 className="font-bold mb-4 text-yellow-700 flex items-center gap-2"><span>📅</span> Configuración General</h3>
               <p className="text-xs text-gray-500 mb-4">Define la fecha del sorteo que aparecerá en la cuenta regresiva.</p>
               <div className="flex gap-4">
                  <input type="datetime-local" value={generalConfig.raffleDate} onChange={e => setGeneralConfig({ raffleDate: e.target.value })} className="flex-1 border p-3 rounded text-sm" />
                  <button onClick={handleSaveGeneralConfig} className="bg-yellow-600 text-white px-6 py-2 rounded hover:bg-yellow-700 font-bold">Guardar Fecha</button>
               </div>
            </div>
            <div className="bg-white p-6 rounded shadow border-l-4 border-purple-500">
              <h3 className="font-bold mb-4 text-purple-700 flex items-center gap-2"><span>🔗</span> Automatización</h3>
              <p className="text-xs text-gray-500 mb-4">Configura aquí la URL del Webhook de Pabbly Connect o Zapier.</p>
              <div className="flex gap-4"><input type="text" value={webhookConfig.webhookUrl} onChange={e => setWebhookConfig({...webhookConfig, webhookUrl: e.target.value})} className="flex-1 border p-3 rounded font-mono text-sm" placeholder="https://connect.pabbly.com/..." /><button onClick={handleSaveWebhookConfig} className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 font-bold">Guardar</button></div>
            </div>
            <div className="bg-white p-6 rounded shadow border-l-4 border-green-500 opacity-75">
              <h3 className="font-bold mb-4 text-green-700">Conexión Directa WhatsApp (Opcional)</h3>
              <div className="space-y-4"><input type="text" value={waConfig.whatsappPhoneId} onChange={e => setWaConfig({...waConfig, whatsappPhoneId: e.target.value})} className="w-full border p-2 rounded" placeholder="Phone ID" /><input type="password" value={waConfig.whatsappToken} onChange={e => setWaConfig({...waConfig, whatsappToken: e.target.value})} className="w-full border p-2 rounded" placeholder="Access Token" /><button onClick={handleSaveWaConfig} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full font-bold">Guardar</button></div>
            </div>
            <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500 opacity-75">
              <h3 className="font-bold mb-4 text-blue-700">Conexión Directa Email (Opcional)</h3>
              <div className="space-y-4"><input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} className="w-full border p-2 rounded" placeholder="API Key" /><input type="email" value={emailConfig.fromEmail} onChange={e => setEmailConfig({...emailConfig, fromEmail: e.target.value})} className="w-full border p-2 rounded" placeholder="Remitente (From)" /><button onClick={handleSaveEmailConfig} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full font-bold">Guardar</button></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}