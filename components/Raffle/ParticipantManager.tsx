import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';
import { Download, Search, CheckCircle, XCircle } from 'lucide-react';
import { Client } from '../../types';

export default function ParticipantManager() {
  const [participants, setParticipants] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      // Basic fetch - in a real app with >1000 users, we'd paginate properly
      // Here we fetch last 50 for preview
      const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      setParticipants(snap.docs.map(d => d.data() as Client));

      // Get total count (approximation or separate counter would be better)
      // Since 'count()' is available in newer SDKs but maybe not enabled here, we skip precise count for now or implement if needed.
    } catch (error) {
      console.error("Error fetching participants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      // Fetch all participants for export (up to 2000 for safety, or implement pagination for more)
      const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'), limit(2000));
      const snap = await getDocs(q);
      const allParticipants = snap.docs.map(d => d.data() as Client);

      const headers = ['Ticket ID', 'Nombre', 'CI', 'Ciudad', 'Email', 'Teléfono', 'Modelo TV', 'Fecha Registro'];
      const rows = allParticipants.map(p => [
        p.ticketId,
        `"${p.fullName}"`,
        p.ci,
        p.city,
        p.email,
        p.phone,
        p.tvModel,
        p.createdAt?.toDate ? new Date(p.createdAt.toDate()).toLocaleDateString() : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'participantes_skyworth_completo.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting:", error);
      alert("Error al exportar datos.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = participants.filter(p =>
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ci.includes(searchTerm)
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h3 className="font-bold text-gray-700">Lista de Participantes</h3>
            <p className="text-xs text-gray-500">Usuarios registrados con código validado</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, ticket o CI..."
                    className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full md:w-64 focus:ring-2 focus:ring-skyworth-blue outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-100 border border-green-200 transition-colors"
            >
                <Download size={16} /> Exportar CSV
            </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                    <th className="px-6 py-3">Ticket ID</th>
                    <th className="px-6 py-3">Participante</th>
                    <th className="px-6 py-3">Contacto</th>
                    <th className="px-6 py-3">Detalles TV</th>
                    <th className="px-6 py-3">Estado</th>
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <tr><td colSpan={5} className="text-center py-8">Cargando participantes...</td></tr>
                ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No se encontraron resultados</td></tr>
                ) : (
                    filtered.map((p) => (
                        <tr key={p.clientId} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-mono font-medium text-skyworth-blue">{p.ticketId}</td>
                            <td className="px-6 py-4">
                                <div className="font-bold text-gray-800">{p.fullName}</div>
                                <div className="text-xs text-gray-500">CI: {p.ci}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div>{p.phone}</div>
                                <div className="text-xs text-gray-400">{p.email}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-medium">{p.tvModel}</div>
                                <div className="text-xs text-gray-500">{p.city}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                    <CheckCircle size={12} /> VERIFICADO
                                </span>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
      <div className="p-4 text-center text-xs text-gray-400 border-t">
        Mostrando {filtered.length} participantes recientes. Para ver todo, utiliza la exportación.
      </div>
    </div>
  );
}
