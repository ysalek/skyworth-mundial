import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { functions, db } from '../../firebase';
import { Winner } from '../../types';
import confetti from 'canvas-confetti';
import { Trophy, Shuffle, Loader2 } from 'lucide-react';

export default function RaffleDrum() {
  const [status, setStatus] = useState<'IDLE' | 'ROLLING' | 'WINNER'>('IDLE');
  const [winner, setWinner] = useState<Winner | null>(null);
  const [displayNames, setDisplayNames] = useState<string[]>([]);
  const [currentNameIndex, setCurrentNameIndex] = useState(0);
  const controls = useAnimation();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load a batch of names for the animation visual effect
  useEffect(() => {
    const loadNames = async () => {
      try {
        const q = query(collection(db, 'clients'), limit(100));
        const snap = await getDocs(q);
        const names = snap.docs.map(d => d.data().fullName);
        // Shuffle them
        setDisplayNames(names.sort(() => Math.random() - 0.5));
      } catch (e) {
        console.error("Error loading names for visualizer", e);
        setDisplayNames(["Participante 1", "Participante 2", "Participante 3"]); // Fallback
      }
    };
    loadNames();
  }, []);

  const fireConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const startRaffle = async () => {
    if (status === 'ROLLING') return;
    if (!confirm("¿Iniciar sorteo aleatorio oficial?")) return;

    setStatus('ROLLING');
    setWinner(null);

    // Start visual shuffle effect
    let speed = 100;
    const shuffle = () => {
       setCurrentNameIndex(prev => (prev + 1) % displayNames.length);
    };
    intervalRef.current = setInterval(shuffle, speed);

    // Call Cloud Function to pick winner securely
    try {
        const pickWinnerFn = httpsCallable(functions, 'pickWinner');
        // Add artificial delay for suspense (min 3 seconds)
        const [result] = await Promise.all([
            pickWinnerFn(),
            new Promise(r => setTimeout(r, 4000))
        ]);

        const winnerData = (result.data as any).winner as Winner;

        // Slow down effect
        if (intervalRef.current) clearInterval(intervalRef.current);

        // Final rapid flicker before stop
        let count = 0;
        const finalFlicker = setInterval(() => {
            setCurrentNameIndex(prev => (prev + 1) % displayNames.length);
            count++;
            if (count > 10) {
                clearInterval(finalFlicker);
                setWinner(winnerData);
                setStatus('WINNER');
                fireConfetti();
            }
        }, 150);

    } catch (error: any) {
        console.error("Error picking winner:", error);
        alert("Error al realizar el sorteo: " + error.message);
        setStatus('IDLE');
        if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const resetRaffle = () => {
      setStatus('IDLE');
      setWinner(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-8 bg-gradient-to-br from-gray-900 via-skyworth-dark to-black text-white rounded-xl shadow-2xl relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('/img/pattern.png')] opacity-10 mix-blend-overlay"></div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">

        <h1 className="text-4xl md:text-5xl font-sport mb-12 text-center text-transparent bg-clip-text bg-gradient-to-r from-skyworth-accent to-white drop-shadow-lg">
            GRAN SORTEO MUNDIAL
        </h1>

        <div className="w-full h-64 md:h-80 bg-white/10 backdrop-blur-md rounded-3xl border-4 border-white/20 flex items-center justify-center relative overflow-hidden shadow-[0_0_50px_rgba(0,169,224,0.3)]">

            {status === 'IDLE' && (
                <div className="text-center p-8 animate-pulse">
                    <Trophy size={80} className="mx-auto text-yellow-400 mb-4 opacity-80" />
                    <h3 className="text-2xl font-bold text-gray-300">¿Listo para conocer al ganador?</h3>
                    <p className="text-gray-400 mt-2">Sistema aleatorio certificado</p>
                </div>
            )}

            {status === 'ROLLING' && (
                <div className="text-center w-full">
                    <motion.div
                        key={currentNameIndex}
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="text-4xl md:text-6xl font-bold text-white font-mono tracking-wider"
                    >
                        {displayNames[currentNameIndex] || "CARGANDO..."}
                    </motion.div>
                    <p className="mt-4 text-skyworth-accent font-bold animate-pulse">BUSCANDO GANADOR...</p>
                </div>
            )}

            {status === 'WINNER' && winner && (
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="text-center p-6 w-full h-full flex flex-col justify-center items-center bg-gradient-to-b from-transparent to-black/40"
                >
                    <div className="text-yellow-400 text-6xl mb-2">👑</div>
                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-2 font-sport">{winner.fullName}</h2>
                    <div className="flex gap-4 text-xl text-skyworth-accent mt-4 bg-black/50 px-6 py-2 rounded-full">
                        <span>{winner.ticketId}</span>
                        <span>•</span>
                        <span>{winner.city}</span>
                    </div>
                    <p className="mt-6 text-gray-300">¡Felicidades! Se lleva un TV {winner.tvModel}</p>
                </motion.div>
            )}
        </div>

        <div className="mt-12">
            {status === 'IDLE' && (
                <button
                    onClick={startRaffle}
                    className="group relative px-12 py-4 bg-skyworth-accent text-black font-sport text-2xl rounded-full shadow-[0_0_20px_rgba(0,169,224,0.6)] hover:shadow-[0_0_40px_rgba(0,169,224,0.9)] transition-all transform hover:scale-105 active:scale-95"
                >
                    <span className="flex items-center gap-3">
                        <Shuffle size={32} className="group-hover:rotate-180 transition-transform duration-500" />
                        SORTEAR AHORA
                    </span>
                </button>
            )}

            {status === 'ROLLING' && (
                <button disabled className="px-12 py-4 bg-gray-700 text-gray-400 font-bold rounded-full cursor-wait flex items-center gap-3">
                    <Loader2 className="animate-spin" /> PROCESANDO...
                </button>
            )}

            {status === 'WINNER' && (
                <button
                    onClick={resetRaffle}
                    className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-full transition-all text-sm font-bold uppercase tracking-widest"
                >
                    Nuevo Sorteo
                </button>
            )}
        </div>

      </div>
    </div>
  );
}
