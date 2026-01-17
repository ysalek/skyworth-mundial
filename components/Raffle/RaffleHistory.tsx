import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Winner } from '../../types';
import { Trophy, Calendar, MapPin } from 'lucide-react';

export default function RaffleHistory() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
        const q = query(collection(db, 'winners'), orderBy('wonAt', 'desc'));
        const snap = await getDocs(q);
        setWinners(snap.docs.map(d => d.data() as Winner));
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div className="text-center p-10 text-gray-500">Cargando historial...</div>;

  return (
    <div className="max-w-4xl mx-auto">
        <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Trophy className="text-yellow-500" /> Galería de Ganadores
        </h3>

        {winners.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-dashed border-gray-300">
                <p className="text-gray-400">Aún no se han realizado sorteos.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {winners.map((winner, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-gradient-to-r from-skyworth-blue to-skyworth-dark p-4 flex justify-between items-center">
                             <span className="text-white font-mono text-sm opacity-80">#{winner.ticketId}</span>
                             <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">GANADOR</span>
                        </div>
                        <div className="p-6">
                            <h4 className="text-xl font-bold text-gray-800 mb-1">{winner.fullName}</h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                <MapPin size={14} /> {winner.city}
                            </div>

                            <div className="space-y-2 text-sm bg-gray-50 p-3 rounded">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Premio:</span>
                                    <span className="font-medium text-gray-900">TV {winner.tvModel}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Fecha:</span>
                                    <span className="font-medium text-gray-900">
                                        {winner.wonAt?.toDate ? new Date(winner.wonAt.toDate()).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Cédula:</span>
                                    <span className="font-medium text-gray-900">{winner.ci}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
}
