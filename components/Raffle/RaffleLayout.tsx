import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, History, Ticket, Award, Gift } from 'lucide-react';
import ParticipantManager from './ParticipantManager';
import RaffleDrum from './RaffleDrum';
import RaffleHistory from './RaffleHistory';

export default function RaffleLayout() {
  const [activeTab, setActiveTab] = useState<'PARTICIPANTS' | 'DRUM' | 'HISTORY'>('DRUM');

  return (
    <div className="h-full flex flex-col bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      {/* Header Tabs */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Gift className="text-skyworth-accent" />
          Sistema de Sorteo Profesional
        </h2>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('PARTICIPANTS')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'PARTICIPANTS'
                ? 'bg-white text-skyworth-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} /> Participantes
          </button>
          <button
            onClick={() => setActiveTab('DRUM')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'DRUM'
                ? 'bg-white text-skyworth-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Ticket size={16} /> Sorteo en Vivo
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-white text-skyworth-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History size={16} /> Historial
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'PARTICIPANTS' && (
            <motion.div
              key="participants"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-y-auto p-6"
            >
              <ParticipantManager />
            </motion.div>
          )}
          {activeTab === 'DRUM' && (
            <motion.div
              key="drum"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-y-auto"
            >
              <RaffleDrum />
            </motion.div>
          )}
          {activeTab === 'HISTORY' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-y-auto p-6"
            >
              <RaffleHistory />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
