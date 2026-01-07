import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, getDocs, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'; 
import { auth, functions, uploadFile, db } from '../firebase';
import { Sale, Seller } from '../types';

const CITIES = ['La Paz', 'Cochabamba', 'Santa Cruz', 'El Alto', 'Oruro', 'Potosi', 'Tarija', 'Sucre', 'Beni', 'Pando'];

// Simple Icon Component for Refresh
const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

export default function SellerPortal() {
  const [user, setUser] = useState(auth.currentUser);
  const [userProfile, setUserProfile] = useState<Seller | null>(null);
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'LEADERBOARD' | 'HISTORY'>('REGISTER');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Auth State
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [regForm, setRegForm] = useState({ fullName: '', ci: '', phone: '', city: 'La Paz', leaderCi: '' });

  // Sale Register State
  const [saleForm, setSaleForm] = useState({ model: '', invoice: '', city: 'La Paz' });
  const [saleFile, setSaleFile] = useState<File | null>(null);
  const [saleMsg, setSaleMsg] = useState({ type: '', text: '' });
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [history, setHistory] = useState<Sale[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
        setUser(u);
        if (u) {
            try {
                const docRef = doc(db, 'sellers', u.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) setUserProfile(docSnap.data() as Seller);
            } catch (e) { console.error("Profile Fetch Error", e); }
        }
    });
    return unsub;
  }, []);

  useEffect(() => {
      if (user && activeTab === 'LEADERBOARD') fetchLeaderboard();
      if (user && activeTab === 'HISTORY') fetchHistory();
  }, [user, activeTab]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        // Attempt to create profile
        try {
            await setDoc(doc(db, 'sellers', uid), {
            uid,
            email,
            fullName: regForm.fullName,
            ci: regForm.ci,
            phone: regForm.phone,
            city: regForm.city,
            leaderCi: regForm.leaderCi || null,
            totalSales: 0,
            isCertified: false,
            createdAt: serverTimestamp()
            });
        } catch (profileErr: any) {
            console.error("Error creando perfil:", profileErr);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      console.error(e);
      let msg = e.message;
      if (e.code === 'auth/email-already-in-use') {
          msg = 'Este correo ya está registrado.';
      } else if (e.code === 'auth/wrong-password') {
          msg = 'Contraseña incorrecta.';
      } else if (e.code === 'auth/user-not-found') {
          msg = 'Usuario no encontrado.';
      }
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleMsg({ type: '', text: '' });
    setLoading(true);
    try {
      if (!saleFile) throw new Error("Sube la foto de la factura.");
      const invoicePath = await uploadFile(saleFile, 'seller_invoices');
      const regSale = httpsCallable(functions, 'registerSellerSale');
      await regSale({ tvModel: saleForm.model, invoiceNumber: saleForm.invoice, city: saleForm.city, invoicePath });
      setShowSuccessModal(true);
      setSaleForm({ model: '', invoice: '', city: saleForm.city });
      setSaleFile(null);
      setTimeout(() => setShowSuccessModal(false), 3000);
    } catch (e: any) {
      setSaleMsg({ type: 'error', text: e.message || 'Error desconocido.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    setRefreshing(true);
    try {
      const getLb = httpsCallable(functions, 'getLeaderboard');
      const res = await getLb();
      setLeaderboard(res.data);
    } catch (e: any) { 
        console.error("Leaderboard Error", e);
        setLeaderboard({ error: true });
    } finally {
      setRefreshing(false);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    setRefreshing(true);
    setHistoryError(null);
    try {
        const q = query(collection(db, 'seller_sales'), where('sellerId', '==', user.uid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setHistory(snap.docs.map(d => d.data() as Sale));
    } catch (e: any) {
        console.error("Error fetching history:", e);
        if (e.message.includes('index')) {
            setHistoryError("El sistema está construyendo los índices de búsqueda. Intenta nuevamente en unos minutos.");
        } else {
            setHistoryError("No se pudo cargar el historial.");
        }
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full animate-fade-in">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{isRegistering ? 'Registro Vendedor' : 'Acceso Vendedores'}</h2>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <>
                <div><label className="block text-xs font-bold text-gray-500 uppercase">Nombre</label><input required className="w-full p-3 border rounded" value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase">C.I.</label><input required className="w-full p-3 border rounded" value={regForm.ci} onChange={e => setRegForm({...regForm, ci: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase">Celular</label><input required className="w-full p-3 border rounded" value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} /></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase">Ciudad</label><select className="w-full p-3 border rounded" value={regForm.city} onChange={e => setRegForm({...regForm, city: e.target.value})}>{CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Código de Líder (Opcional)</label>
                    <input className="w-full p-2 border border-yellow-300 rounded text-sm" placeholder="Ingresa CI de quien te invitó" value={regForm.leaderCi} onChange={e => setRegForm({...regForm, leaderCi: e.target.value})} />
                </div>
              </>
            )}
            <div><label className="block text-xs font-bold text-gray-500 uppercase">Email</label><input type="email" required className="w-full p-3 border rounded" value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase">Password</label><input type="password" required className="w-full p-3 border rounded" value={password} onChange={e=>setPassword(e.target.value)} /></div>
            {loginError && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
                    <p className="font-bold">{loginError}</p>
                    {loginError.includes('registrado') && (
                        <button type="button" onClick={() => { setIsRegistering(false); setLoginError(''); }} className="mt-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded border border-red-300 hover:bg-red-200">
                            Ir a Iniciar Sesión
                        </button>
                    )}
                </div>
            )}
            <button disabled={loading} className="w-full bg-skyworth-blue text-white py-3 rounded font-bold">{loading ? '...' : (isRegistering ? 'REGISTRARME' : 'ENTRAR')}</button>
          </form>
          <div className="mt-4 text-center border-t pt-4"><button type="button" onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); }} className="text-skyworth-blue text-sm font-bold">{isRegistering ? '¿Ya tienes cuenta?' : '¿Nuevo usuario?'}</button></div>
          <button onClick={() => window.location.hash = ''} className="mt-2 text-xs text-center w-full text-gray-400 hover:text-gray-600">Volver al inicio</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col relative">
      {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
              <div className="bg-green-600 text-white px-8 py-6 rounded-2xl shadow-2xl animate-bounce flex flex-col items-center">
                  <span className="text-5xl mb-2">⚽ GOOOOL!</span>
                  <span className="font-bold text-xl uppercase tracking-widest">Venta Registrada</span>
              </div>
          </div>
      )}
      <header className="bg-skyworth-dark text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="font-sport text-xl tracking-widest">SKYWORTH <span className="text-skyworth-accent">SALES CONTEST</span></h1>
          <button onClick={() => signOut(auth)} className="text-xs bg-white/10 px-3 py-1 rounded hover:bg-white/20">Cerrar Sesión</button>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 pb-24">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
          {['REGISTER', 'HISTORY', 'LEADERBOARD'].map((t: any) => (
             <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 min-w-[100px] py-3 px-4 rounded-lg font-bold shadow-sm whitespace-nowrap transition text-xs ${activeTab === t ? 'bg-skyworth-blue text-white' : 'bg-white text-gray-600'}`}>
                 {t === 'REGISTER' ? '📝 Registrar' : t === 'HISTORY' ? '📋 Historial' : '🏆 Ranking'}
             </button>
          ))}
        </div>

        {activeTab === 'REGISTER' && (
          <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-skyworth-grass animate-fade-in">
            <h2 className="text-xl font-bold text-gray-800 mb-4 uppercase">Nueva Venta</h2>
            {saleMsg.text && !showSuccessModal && <div className={`p-4 mb-4 rounded text-sm font-bold ${saleMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{saleMsg.text}</div>}
            <form onSubmit={handleRegisterSale} className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-500 uppercase">Modelo TV</label><input required className="w-full p-3 border rounded" value={saleForm.model} onChange={e => setSaleForm({...saleForm, model: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase">Factura</label><input required className="w-full p-3 border rounded" value={saleForm.invoice} onChange={e => setSaleForm({...saleForm, invoice: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase">Ciudad</label><select className="w-full p-3 border rounded" value={saleForm.city} onChange={e => setSaleForm({...saleForm, city: e.target.value})}>{CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <input required type="file" accept="image/*" className="w-full p-2 border rounded text-sm" onChange={e => setSaleFile(e.target.files ? e.target.files[0] : null)} />
              <button disabled={loading} className="w-full bg-gradient-to-r from-skyworth-grass to-green-700 text-white font-bold py-4 rounded-lg shadow-lg uppercase">{loading ? '...' : 'REGISTRAR GOL ⚽'}</button>
            </form>
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden animate-fade-in">
             <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-700 uppercase text-sm">Tus Ventas</h3>
                 <button onClick={fetchHistory} className="text-skyworth-blue hover:text-skyworth-dark p-1 rounded-full hover:bg-blue-50 transition" title="Actualizar">
                    <RefreshIcon spinning={refreshing} />
                 </button>
             </div>
             {historyError ? (
                <div className="p-8 text-center">
                    <div className="text-4xl mb-2">🚧</div>
                    <p className="text-sm text-gray-600">{historyError}</p>
                </div>
             ) : (
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-100"><tr><th className="px-4 py-3">Modelo</th><th className="px-4 py-3">Estado</th></tr></thead>
                    <tbody>
                    {history.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-gray-400">Sin registros aún.</td></tr>}
                    {history.map((sale, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{sale.tvModel}</td>
                        <td className="px-4 py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${sale.status === 'APPROVED' ? 'bg-green-100 text-green-800' : sale.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {sale.status === 'APPROVED' ? 'Aprobado' : sale.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                            </span>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
             )}
          </div>
        )}
        
        {activeTab === 'LEADERBOARD' && (
          <div className="space-y-6 animate-fade-in">
             <div className="flex justify-end mb-2">
                 <button onClick={fetchLeaderboard} className="flex items-center gap-2 text-xs font-bold text-skyworth-blue bg-white px-3 py-1 rounded shadow-sm hover:bg-gray-50">
                     <RefreshIcon spinning={refreshing} /> Actualizar Ranking
                 </button>
             </div>
             {(!leaderboard || leaderboard.error) && (
                <div className="p-4 bg-yellow-50 text-yellow-700 text-sm rounded border border-yellow-100 text-center">
                    Calculando posiciones... (Si persiste, se están generando los índices)
                </div>
             )}
             {leaderboard && !leaderboard.error && ['La Paz', 'Cochabamba', 'Santa Cruz'].map(city => (
                <div key={city} className="bg-white rounded-xl shadow p-4 mb-4">
                  <h3 className="font-bold text-gray-700 border-b pb-2 mb-2">{city}</h3>
                  {leaderboard[city]?.length === 0 && <p className="text-xs text-gray-400 italic">Sin datos</p>}
                  {leaderboard[city]?.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between py-2 border-b last:border-0">
                          <span className="text-sm">#{i+1} {s.name}</span>
                          <span className="font-bold text-skyworth-blue">{s.sales}</span>
                      </div>
                  ))}
                </div>
             ))}
          </div>
        )}
      </main>
    </div>
  );
}