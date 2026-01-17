import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { Product } from '../../../types';
import { Save, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Product | null>(null);

  // New product initial state
  const [newProduct, setNewProduct] = useState<Product>({
    model_name: '',
    model_key: '',
    description: '',
    ticket_multiplier: 1,
    is_active: true
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const getProds = httpsCallable(functions, 'getProducts');
      const res = await getProds();
      setProducts((res.data as any).products);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!window.confirm("¿Estás seguro de REINICIAR/CARGAR los productos oficiales? Esto puede duplicar si no se limpia.")) return;
    setLoading(true);
    try {
      const seedFn = httpsCallable(functions, 'seedOfficialProducts');
      await seedFn();
      await fetchProducts();
      alert("Productos cargados correctamente.");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (product: Product) => {
    setLoading(true);
    try {
      const saveFn = httpsCallable(functions, 'saveProduct');
      await saveFn({ product });
      setIsEditing(null);
      setEditForm(null);
      setNewProduct({
        model_name: '',
        model_key: '',
        description: '',
        ticket_multiplier: 1,
        is_active: true
      });
      await fetchProducts();
    } catch (e: any) {
        alert("Error guardando: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("¿Eliminar producto?")) return;
      try {
          const delFn = httpsCallable(functions, 'deleteProduct');
          await delFn({ id });
          setProducts(prev => prev.filter(p => p.id !== id));
      } catch(e: any) {
          alert("Error: " + e.message);
      }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Gestión de Productos y Tickets</h2>
        <button onClick={handleSeed} className="flex items-center gap-2 text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded hover:bg-yellow-200 border border-yellow-300">
            <RefreshCw size={14} /> Cargar Oficiales (Seed)
        </button>
      </div>

      {/* New Product Form */}
      <div className="bg-gray-50 p-4 rounded mb-8 border border-gray-200">
          <h4 className="font-bold text-sm text-gray-600 mb-3 uppercase">Agregar Nuevo</h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500">Modelo (Display)</label>
                  <input className="w-full p-2 border rounded text-sm" placeholder="Ej: Q7500G" value={newProduct.model_name} onChange={e => setNewProduct({...newProduct, model_name: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500">Key (Único)</label>
                  <input className="w-full p-2 border rounded text-sm" placeholder="Ej: Q7500G_65_75" value={newProduct.model_key} onChange={e => setNewProduct({...newProduct, model_key: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500">Descripción</label>
                  <input className="w-full p-2 border rounded text-sm" placeholder="Ej: 65, 75 pulgadas" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500">Tickets</label>
                  <input type="number" min="1" max="10" className="w-full p-2 border rounded text-sm" value={newProduct.ticket_multiplier} onChange={e => setNewProduct({...newProduct, ticket_multiplier: parseInt(e.target.value)})} />
              </div>
              <div>
                  <button onClick={() => handleSave(newProduct)} disabled={loading} className="w-full bg-skyworth-blue text-white p-2 rounded font-bold text-sm flex justify-center items-center gap-2">
                      <Plus size={16} /> AGREGAR
                  </button>
              </div>
          </div>
      </div>

      {/* List */}
      <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                  <tr>
                      <th className="px-4 py-3">Modelo</th>
                      <th className="px-4 py-3">Key Interno</th>
                      <th className="px-4 py-3">Descripción</th>
                      <th className="px-4 py-3 text-center">Nro. Tickets</th>
                      <th className="px-4 py-3 text-center">Activo</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
              </thead>
              <tbody>
                  {loading && products.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center">Cargando...</td></tr>
                  ) : products.map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                          {isEditing === p.id && editForm ? (
                              <>
                                <td className="px-4 py-2"><input className="w-full border rounded p-1" value={editForm.model_name} onChange={e => setEditForm({...editForm, model_name: e.target.value})} /></td>
                                <td className="px-4 py-2"><input className="w-full border rounded p-1 bg-gray-100" readOnly value={editForm.model_key} /></td>
                                <td className="px-4 py-2"><input className="w-full border rounded p-1" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} /></td>
                                <td className="px-4 py-2"><input type="number" className="w-16 border rounded p-1 text-center mx-auto block" value={editForm.ticket_multiplier} onChange={e => setEditForm({...editForm, ticket_multiplier: parseInt(e.target.value)})} /></td>
                                <td className="px-4 py-2 text-center"><input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm({...editForm, is_active: e.target.checked})} /></td>
                                <td className="px-4 py-2 text-right">
                                    <button onClick={() => handleSave(editForm)} className="text-green-600 hover:text-green-800 mr-2"><Save size={18}/></button>
                                    <button onClick={() => { setIsEditing(null); setEditForm(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
                                </td>
                              </>
                          ) : (
                              <>
                                <td className="px-4 py-3 font-bold">{p.model_name}</td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.model_key}</td>
                                <td className="px-4 py-3">{p.description}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="bg-skyworth-accent text-black font-bold px-2 py-1 rounded-full text-xs">{p.ticket_multiplier}x</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {p.is_active ? <span className="text-green-500">●</span> : <span className="text-red-300">●</span>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => { setIsEditing(p.id!); setEditForm(p); }} className="text-blue-600 hover:text-blue-800 mr-3 text-xs font-bold underline">EDITAR</button>
                                    <button onClick={() => handleDelete(p.id!)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                </td>
                              </>
                          )}
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
}
