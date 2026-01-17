import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, where, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { auth, functions, db } from '../firebase';
import { NotificationConfig, Winner, Product } from '../types';

export default function AdminPanel() {
  const [section, setSection] = useState<'CLIENTS' | 'SELLERS' | 'SALES' | 'INVENTORY' | 'RAFFLE' | 'CONFIG' | 'PRODUCTS'>('CLIENTS');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalClients: 0, totalSellers: 0, totalCodes: 0 });
  
  // Config States
  const [raffleDate, setRaffleDate] = useState('');
  const [notifConfig, setNotifConfig] = useState<NotificationConfig>({
      whatsapp: { enabled: false, token: '', phoneId: '', templateName: '' },
      email: { enabled: false, provider: 'SMTP', host: '', port: '', user: '', pass: '' }
  });
  
  // Raffle State
  const [winner, setWinner] = useState<Winner | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  // Inventory State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Products State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditingProduct, setIsEditingProduct] = useState(false);

  useEffect(() => {
    if (section === 'CONFIG') {
        fetchConfig();
        fetchNotifConfig();
    } else if (section === 'RAFFLE') {
        fetchLastWinner();
    } else if (section !== 'INVENTORY') { 
        fetchStats(); 
        fetchData(); 
    }
  }, [section]);

  const fetchStats = async () => {
    try {
      const getStats = httpsCallable(functions, 'adminGetStats');
      const res = await getStats();
      setStats(res.data as any);
    } catch (e) { console.error(e); }
  };

  const fetchConfig = async () => {
    try {
      const d = await getDoc(doc(db, 'campaign_config', 'general'));
      if (d.exists()) setRaffleDate(d.data().raffleDate || '');
    } catch (e) { console.error(e); }
  };

  const fetchNotifConfig = async () => {
      try {
          const fn = httpsCallable(functions, 'getNotificationConfig');
          const res = await fn();
          const d = res.data as any;
          if (d.whatsapp || d.email) {
              setNotifConfig({
                  whatsapp: { ...notifConfig.whatsapp, ...d.whatsapp },
                  email: { ...notifConfig.email, ...d.email }
              });
          }
      } catch (e) { console.error(e); }
  };

  const fetchLastWinner = async () => {
      try {
          const q = query(collection(db, 'winners'), orderBy('wonAt', 'desc'), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) setWinner(snap.docs[0].data() as Winner);
      } catch (e) { console.error(e); }
  };

  const saveConfig = async () => {
    try {
      const setConf = httpsCallable(functions, 'setGeneralConfig');
      await setConf({ raffleDate });
      
      const saveNotif = httpsCallable(functions, 'saveNotificationConfig');
      await saveNotif(notifConfig);

      alert('Configuración guardada correctamente.');
    } catch (e: any) { alert(e.message); }
  };

  const testConfig = async (type: 'whatsapp' | 'email') => {
      try {
          await saveConfig(); 
          const fn = httpsCallable(functions, 'sendTestNotification');
          const res = await fn({ type });
          alert((res.data as any).message);
      } catch(e: any) {
          alert('Error probando conexión: ' + e.message);
      }
  };

  const handleUploadCsv = async () => {
      if (!csvFile) return alert("Selecciona un archivo CSV");
      setLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
          const text = e.target?.result as string;
          const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
          // Simple Parse: "SERIAL,MODEL" or just "SERIAL"
          const codes = rows.slice(1).map(row => { // Skip header
              const cols = row.split(',');
              return { code: cols[0], model: cols[1] || 'Unknown' };
          });
          
          if (codes.length === 0) { setLoading(false); return alert("Archivo vacío o formato incorrecto"); }

          // Chunking to avoid timeout (send 400 at a time)
          const CHUNK_SIZE = 400;
          let successCount = 0;
          try {
              const fn = httpsCallable(functions, 'importCodes');
              for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
                  const chunk = codes.slice(i, i + CHUNK_SIZE);
                  const res = await fn({ codes: chunk });
                  successCount += (res.data as any).count;
              }
              alert(`Importados ${successCount} códigos correctamente.`);
              setCsvFile(null);
          } catch(err: any) {
              alert("Error al importar: " + err.message);
          } finally {
              setLoading(false);
          }
      };
      reader.readAsText(csvFile);
  };

  const handlePickWinner = async () => {
      if (!window.confirm("¿Estás seguro de realizar el sorteo AHORA? Esta acción seleccionará un ganador de la base de datos.")) return;
      setIsRolling(true);
      setWinner(null);
      try {
          // Simulate tension
          await new Promise(r => setTimeout(r, 2000));
          const fn = httpsCallable(functions, 'pickWinner');
          const res = await fn();
          setWinner((res.data as any).winner);
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setIsRolling(false);
      }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let q;
      if (section === 'CLIENTS') q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'), limit(50));
      else if (section === 'SELLERS') q = query(collection(db, 'sellers'), orderBy('totalSales', 'desc'), limit(50));
      else if (section === 'PRODUCTS') q = query(collection(db, 'products'));
      else q = query(collection(db, 'seller_sales'), orderBy('createdAt', 'desc'), limit(50));
      
      const snap = await getDocs(q);
      setData(snap.docs.map(d => ({...d.data(), id: d.id})));
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProduct) return;

      try {
          if (editingProduct.id === 'new') {
              const { id, ...data } = editingProduct;
              await addDoc(collection(db, 'products'), data);
          } else {
             const { id, ...data } = editingProduct;
             await updateDoc(doc(db, 'products', id), data);
          }
          setIsEditingProduct(false);
          setEditingProduct(null);
          fetchData();
      } catch (e: any) { alert("Error guardando producto: " + e.message); }
  };

  const handleDeleteProduct = async (id: string) => {
      if (!window.confirm("¿Eliminar este producto?")) return;
      try {
          await deleteDoc(doc(db, 'products', id));
          fetchData();
      } catch (e: any) { alert("Error eliminando: " + e.message); }
  };

  const handleReviewSale = async (saleId: string, action: 'APPROVE' | 'REJECT') => {
    if (!window.confirm(`¿Seguro que deseas ${action === 'APPROVE' ? 'APROBAR' : 'RECHAZAR'} esta venta?`)) return;
    try {
        const fn = httpsCallable(functions, 'reviewSale');
        await fn({ saleId, action });
        setData(prev => prev.map(d => d.saleId === saleId ? { ...d, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' } : d));
    } catch (e: any) { alert("Error: " + e.message); }
  };

  const handleViewInvoice = async (path: string) => {
    if (!path) return alert("No hay ruta de archivo.");
    try {
      const storage = getStorage();
      const url = await getDownloadURL(ref(storage, path));
      setViewingImage(url);
    } catch (e: any) { alert("Error al abrir imagen: " + e.message); }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex relative">
      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4" onClick={() => setViewingImage(null)}>
          <div className="relative max-w-4xl max-h-full">
            <img src={viewingImage} alt="Comprobante" className="max-w-full max-h-[90vh] rounded shadow-lg" />
            <button className="absolute top-[-40px] right-0 text-white text-xl font-bold">CERRAR ✕</button>
          </div>
        </div>
      )}

      {isEditingProduct && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden animate-fade-in">
               <div className="bg-skyworth-dark text-white p-6 flex justify-between items-center">
                   <h3 className="text-xl font-sport tracking-wide">
                       {editingProduct.id === 'new' ? 'NUEVO PRODUCTO' : 'EDITAR PRODUCTO'}
                   </h3>
                   <button onClick={() => setIsEditingProduct(false)} className="text-white hover:text-gray-300 text-2xl">&times;</button>
               </div>

               <form onSubmit={handleSaveProduct} className="p-6 space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                       <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modelo</label>
                           <input required className="w-full p-2 border rounded" value={editingProduct.model} onChange={e => setEditingProduct({...editingProduct, model: e.target.value})} />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción</label>
                           <input className="w-full p-2 border rounded" placeholder="Ej: 55 Pulgadas" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                       </div>
                   </div>

                   <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tier / Categoría</label>
                       <select className="w-full p-2 border rounded" value={editingProduct.tier} onChange={e => setEditingProduct({...editingProduct, tier: e.target.value})}>
                           <option value="GOLD">GOLD</option>
                           <option value="SILVER">SILVER</option>
                           <option value="BRONZE">BRONZE</option>
                       </select>
                   </div>

                   <div className="border-t border-gray-100 my-4"></div>

                   <div className="grid grid-cols-2 gap-4">
                       <div>
                           <label className="block text-xs font-bold text-skyworth-blue uppercase mb-1">Configuración de Cupones</label>
                           <p className="text-[10px] text-gray-400 mb-2">Nro de Cupones (Comprador)</p>
                           <input type="number" min="0" className="w-full p-2 border rounded font-mono font-bold text-center text-lg" value={editingProduct.couponsBuyer} onChange={e => setEditingProduct({...editingProduct, couponsBuyer: parseInt(e.target.value) || 0})} />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-green-600 uppercase mb-1">Incentivos Vendedor</label>
                           <p className="text-[10px] text-gray-400 mb-2">Puntos Vendedor</p>
                           <input type="number" min="0" className="w-full p-2 border rounded font-mono font-bold text-center text-lg bg-green-50 border-green-200" value={editingProduct.pointsSeller} onChange={e => setEditingProduct({...editingProduct, pointsSeller: parseInt(e.target.value) || 0})} />
                       </div>
                   </div>

                   <div className="flex justify-end gap-3 pt-4 border-t">
                       <button type="button" onClick={() => setIsEditingProduct(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold text-sm">CANCELAR</button>
                       <button type="submit" className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded shadow">GUARDAR CAMBIOS</button>
                   </div>
               </form>
           </div>
        </div>
      )}

      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-10 overflow-y-auto border-r border-gray-800">
        <div className="p-6 font-sport text-2xl border-b border-gray-800 tracking-wider">SKYWORTH ADMIN</div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setSection('CLIENTS')} className={`w-full text-left px-4 py-3 rounded transition-colors ${section === 'CLIENTS' ? 'bg-skyworth-blue text-white shadow' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>👥 Clientes</button>
          <button onClick={() => setSection('SELLERS')} className={`w-full text-left px-4 py-3 rounded transition-colors ${section === 'SELLERS' ? 'bg-skyworth-blue text-white shadow' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>💼 Vendedores</button>
          <button onClick={() => setSection('PRODUCTS')} className={`w-full text-left px-4 py-3 rounded transition-colors ${section === 'PRODUCTS' ? 'bg-skyworth-blue text-white shadow' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>🏷️ Productos</button>
          <button onClick={() => setSection('SALES')} className={`w-full text-left px-4 py-3 rounded transition-colors ${section === 'SALES' ? 'bg-skyworth-blue text-white shadow' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>🧾 Validar Ventas</button>
          <div className="border-t border-gray-800 my-2 pt-2 opacity-50"></div>
          <button onClick={() => setSection('INVENTORY')} className={`w-full text-left px-4 py-3 rounded transition-colors ${section === 'INVENTORY' ? 'bg-skyworth-blue text-white shadow' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>📦 Inventario Códigos</button>
          <button onClick={() => setSection('RAFFLE')} className={`w-full text-left px-4 py-3 rounded transition-colors ${section === 'RAFFLE' ? 'bg-skyworth-blue text-white shadow' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>🎰 Sorteo</button>
          <div className="border-t border-gray-800 my-2 pt-2 opacity-50"></div>
          <button onClick={() => setSection('CONFIG')} className={`w-full text-left px-4 py-3 rounded transition-colors ${section === 'CONFIG' ? 'bg-skyworth-blue text-white shadow' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>⚙️ Configuración</button>
        </nav>
        <div className="p-4 border-t border-gray-800"><button onClick={() => auth.signOut()} className="text-sm text-red-400 hover:text-red-300 transition-colors w-full text-left px-2">Cerrar Sesión</button></div>
      </aside>

      <main className="ml-64 flex-1 p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">{section}</h1>
        
        {section === 'PRODUCTS' ? (
            <div>
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-700">Catálogo de Productos</h2>
                  <button onClick={() => { setEditingProduct({ id: 'new', model: '', description: '', tier: 'SILVER', couponsBuyer: 1, pointsSeller: 10, status: 'ACTIVE' }); setIsEditingProduct(true); }} className="bg-skyworth-blue text-white px-4 py-2 rounded font-bold hover:bg-skyworth-dark transition">
                      + NUEVO PRODUCTO
                  </button>
               </div>

               <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
                   <table className="w-full text-sm text-left text-gray-500">
                       <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                           <tr>
                               <th className="px-6 py-3">Modelo / ID</th>
                               <th className="px-6 py-3">Descripción</th>
                               <th className="px-6 py-3">Tier</th>
                               <th className="px-6 py-3">Incentivos</th>
                               <th className="px-6 py-3">Estado</th>
                               <th className="px-6 py-3 text-right">Acciones</th>
                           </tr>
                       </thead>
                       <tbody>
                           {loading ? <tr><td colSpan={6} className="p-8 text-center">Cargando...</td></tr> : data.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay productos registrados.</td></tr> : data.map((item: any) => (
                               <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                                   <td className="px-6 py-4 font-bold text-skyworth-dark">{item.model}</td>
                                   <td className="px-6 py-4">{item.description}</td>
                                   <td className="px-6 py-4"><span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded font-bold border border-gray-200">{item.tier}</span></td>
                                   <td className="px-6 py-4">
                                       <div className="flex gap-2">
                                           <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold border border-blue-200" title="Cupones Comprador">🎟️ {item.couponsBuyer}x</span>
                                           <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold border border-green-200" title="Puntos Vendedor">⭐ {item.pointsSeller} pts</span>
                                       </div>
                                   </td>
                                   <td className="px-6 py-4">
                                       <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${item.status === 'ACTIVE' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                           {item.status === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}
                                       </span>
                                   </td>
                                   <td className="px-6 py-4 text-right">
                                       <button onClick={() => { setEditingProduct(item); setIsEditingProduct(true); }} className="text-blue-600 hover:text-blue-800 font-bold mr-3 text-xs uppercase">Editar</button>
                                       <button onClick={() => handleDeleteProduct(item.id)} className="text-red-400 hover:text-red-600 font-bold text-xs uppercase">Borrar</button>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
            </div>
        ) : section === 'CONFIG' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
            {/* General Settings */}
            <div className="bg-white p-6 rounded shadow">
                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2 uppercase">General</h3>
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-500 mb-1">Fecha del Sorteo</label>
                    <input type="date" value={raffleDate} onChange={e => setRaffleDate(e.target.value)} className="w-full border p-2 rounded"/>
                </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-white p-6 rounded shadow md:col-span-2">
                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2 uppercase">Notificaciones Automáticas</h3>
                {/* WhatsApp */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={notifConfig.whatsapp.enabled} onChange={e => setNotifConfig({...notifConfig, whatsapp: {...notifConfig.whatsapp, enabled: e.target.checked}})} />
                            <span className="font-bold text-green-600">WhatsApp Cloud API</span>
                        </div>
                        {notifConfig.whatsapp.enabled && <button onClick={() => testConfig('whatsapp')} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded border border-green-200 hover:bg-green-200 font-bold">PROBAR CONEXIÓN</button>}
                    </div>
                    {notifConfig.whatsapp.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-green-50 p-4 rounded border border-green-200">
                            <div><label className="block text-xs font-bold text-gray-500">Phone ID</label><input className="w-full p-2 border rounded text-sm" value={notifConfig.whatsapp.phoneId} onChange={e => setNotifConfig({...notifConfig, whatsapp: {...notifConfig.whatsapp, phoneId: e.target.value}})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500">Template</label><input className="w-full p-2 border rounded text-sm" value={notifConfig.whatsapp.templateName} onChange={e => setNotifConfig({...notifConfig, whatsapp: {...notifConfig.whatsapp, templateName: e.target.value}})} /></div>
                            <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500">Token</label><input type="password" className="w-full p-2 border rounded text-sm" value={notifConfig.whatsapp.token} onChange={e => setNotifConfig({...notifConfig, whatsapp: {...notifConfig.whatsapp, token: e.target.value}})} /></div>
                        </div>
                    )}
                </div>
                {/* Email */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={notifConfig.email.enabled} onChange={e => setNotifConfig({...notifConfig, email: {...notifConfig.email, enabled: e.target.checked}})} />
                            <span className="font-bold text-blue-600">Email (SMTP)</span>
                        </div>
                        {notifConfig.email.enabled && <button onClick={() => testConfig('email')} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded border border-blue-200 hover:bg-blue-200 font-bold">PROBAR CONEXIÓN</button>}
                    </div>
                    {notifConfig.email.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded border border-blue-200">
                            <div><label className="block text-xs font-bold text-gray-500">Host</label><input className="w-full p-2 border rounded text-sm" value={notifConfig.email.host} onChange={e => setNotifConfig({...notifConfig, email: {...notifConfig.email, host: e.target.value}})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500">Port</label><input className="w-full p-2 border rounded text-sm" value={notifConfig.email.port} onChange={e => setNotifConfig({...notifConfig, email: {...notifConfig.email, port: e.target.value}})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500">User</label><input className="w-full p-2 border rounded text-sm" value={notifConfig.email.user} onChange={e => setNotifConfig({...notifConfig, email: {...notifConfig.email, user: e.target.value}})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500">Pass</label><input type="password" className="w-full p-2 border rounded text-sm" value={notifConfig.email.pass} onChange={e => setNotifConfig({...notifConfig, email: {...notifConfig.email, pass: e.target.value}})} /></div>
                        </div>
                    )}
                </div>
                <button onClick={saveConfig} className="bg-skyworth-blue text-white px-8 py-3 rounded font-bold shadow hover:bg-skyworth-dark transition">GUARDAR TODO</button>
            </div>
          </div>
        ) : section === 'INVENTORY' ? (
            <div className="max-w-4xl bg-white p-8 rounded shadow">
                <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500 mb-6">
                    <h3 className="font-bold text-blue-800">ℹ️ Carga Masiva de Seriales</h3>
                    <p className="text-sm text-blue-700">Sube un archivo CSV para validar los números de serie permitidos. Esto activa automáticamente la validación estricta.</p>
                    <p className="text-xs text-gray-500 mt-2 font-mono">Formato requerido: code,model (ej: SKY12345,55SUE9500)</p>
                </div>
                <div className="flex items-center gap-4 mb-8">
                    <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files ? e.target.files[0] : null)} className="border p-2 rounded w-full" />
                    <button onClick={handleUploadCsv} disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded font-bold whitespace-nowrap disabled:opacity-50">
                        {loading ? 'CARGANDO...' : 'IMPORTAR CSV'}
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded text-center">
                        <span className="block text-4xl font-bold text-gray-700">{stats.totalCodes}</span>
                        <span className="text-xs uppercase font-bold text-gray-400">Total Seriales Cargados</span>
                    </div>
                </div>
            </div>
        ) : section === 'RAFFLE' ? (
            <div className="max-w-4xl">
                {isRolling ? (
                    <div className="bg-white p-12 rounded shadow text-center animate-pulse">
                        <div className="text-6xl mb-4">🎰</div>
                        <h2 className="text-3xl font-sport text-skyworth-blue">SELECCIONANDO GANADOR...</h2>
                        <p className="text-gray-400">Consultando base de datos segura...</p>
                    </div>
                ) : winner ? (
                    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-4 border-skyworth-accent relative">
                        <div className="bg-skyworth-blue p-6 text-center text-white relative overflow-hidden">
                            <div className="absolute inset-0 bg-pattern-soccer opacity-10"></div>
                            <h2 className="text-4xl font-sport relative z-10">¡TENEMOS GANADOR!</h2>
                            <p className="text-sm opacity-80 relative z-10">Sorteo Certificado</p>
                        </div>
                        <div className="p-8 text-center">
                            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner">🏆</div>
                            <h3 className="text-3xl font-bold text-gray-800 mb-2">{winner.fullName}</h3>
                            <div className="inline-block bg-gray-100 px-4 py-1 rounded-full text-gray-600 font-mono text-lg mb-6">{winner.ticketId}</div>
                            
                            <div className="grid grid-cols-2 gap-4 text-left max-w-sm mx-auto bg-gray-50 p-6 rounded-lg border border-gray-200">
                                <div><p className="text-xs text-gray-400 uppercase">Cédula</p><p className="font-bold">{winner.ci}</p></div>
                                <div><p className="text-xs text-gray-400 uppercase">Ciudad</p><p className="font-bold">{winner.city}</p></div>
                                <div><p className="text-xs text-gray-400 uppercase">Celular</p><p className="font-bold">{winner.phone}</p></div>
                                <div><p className="text-xs text-gray-400 uppercase">Modelo TV</p><p className="font-bold">{winner.tvModel}</p></div>
                            </div>

                            <button onClick={() => setWinner(null)} className="mt-8 text-gray-400 underline hover:text-gray-600 text-sm">Realizar otro sorteo (Pruebas)</button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded shadow text-center">
                        <div className="text-6xl mb-4">🎲</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Sistema de Sorteo Aleatorio</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto">Al presionar el botón, el sistema seleccionará aleatoriamente un registro de la colección de clientes y lo marcará como ganador oficial.</p>
                        <button onClick={handlePickWinner} className="bg-gradient-to-r from-skyworth-accent to-yellow-500 text-black font-sport text-2xl px-12 py-4 rounded-full shadow-lg hover:scale-105 transition transform">
                            REALIZAR SORTEO
                        </button>
                    </div>
                )}
            </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                   <tr>
                     {section === 'SALES' ? (
                        <><th>Modelo</th><th>Estado</th><th>Evidencia</th><th>Acciones</th></>
                     ) : (
                        <><th>Nombre</th><th>Info</th></>
                     )}
                   </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={4} className="p-4 text-center">Cargando datos...</td></tr> : data.map((item: any, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                        {section === 'SALES' ? (
                           <>
                             <td className="px-6 py-4 font-bold">{item.tvModel}</td>
                             <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${item.status === 'APPROVED' ? 'bg-green-100 text-green-800' : item.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{item.status}</span></td>
                             <td className="px-6 py-4"><button onClick={() => handleViewInvoice(item.invoicePath)} className="text-blue-600 underline">Ver Foto</button></td>
                             <td className="px-6 py-4 flex gap-2">
                                {item.status === 'PENDING' && (
                                    <>
                                        <button onClick={() => handleReviewSale(item.saleId, 'APPROVE')} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">✓</button>
                                        <button onClick={() => handleReviewSale(item.saleId, 'REJECT')} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">✕</button>
                                    </>
                                )}
                             </td>
                           </>
                        ) : (
                           <>
                             <td className="px-6 py-4 font-bold">{item.fullName}</td>
                             <td className="px-6 py-4">{section === 'CLIENTS' ? (item.ticketId || item.ticketIds?.join(', ') || 'Sin Cupón') : (item.totalPoints ? item.totalPoints + ' Puntos' : item.totalSales + ' Ventas')}</td>
                           </>
                        )}
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}