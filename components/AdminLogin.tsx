import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface Props {
  onLogin?: () => void;
  onRetry?: () => void;
  error?: string;
}

export default function AdminLogin({ onLogin, onRetry, error: propError }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(propError || '');
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    signOut(auth);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      if (onLogin) onLogin();
    } catch (err: any) {
      console.error("Auth Error:", err);
      let msg = 'Error de conexión.';
      switch (err.code) {
        case 'auth/invalid-email': msg = 'Formato de correo inválido.'; break;
        case 'auth/user-disabled': msg = 'Usuario inhabilitado por el DT.'; break;
        case 'auth/user-not-found': msg = 'No existe este usuario en la plantilla.'; break;
        case 'auth/wrong-password': msg = 'Contraseña incorrecta.'; break;
        case 'auth/email-already-in-use': msg = 'Este correo ya está fichado.'; break;
        case 'auth/weak-password': msg = 'La contraseña es muy débil (mín 6).'; break;
        default: msg = err.message || 'Error desconocido.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de "Sin Permisos" (Banquillo)
  if (auth.currentUser && propError) {
    return (
        <div className="min-h-screen bg-skyworth-dark flex items-center justify-center p-4 relative overflow-hidden">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center relative z-10 border-t-8 border-red-600">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🟥</span>
            </div>
            <h2 className="text-2xl font-sport text-gray-800 mb-2 tracking-wide">ACCESO DENEGADO</h2>
            <div className="bg-red-50 text-red-800 p-3 rounded mb-4 text-sm font-bold border border-red-200">
                {propError}
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
                El usuario <span className="font-mono bg-gray-100 px-1 rounded">{auth.currentUser.email}</span> no forma parte del cuerpo técnico (Admin).
            </p>
            <p className="text-[10px] text-gray-400 mb-6 font-mono border-t pt-2">
                ID Ficha: {auth.currentUser.uid}
            </p>

            <div className="space-y-3">
                {onRetry && (
                    <button 
                        onClick={onRetry}
                        className="w-full bg-skyworth-blue text-white py-3 rounded font-bold font-sport text-lg hover:bg-skyworth-dark transition shadow-lg"
                    >
                        ↻ SOLICITAR VAR (REINTENTAR)
                    </button>
                )}
                
                <button 
                    onClick={handleLogout}
                    className="w-full border-2 border-gray-300 text-gray-600 py-2 rounded font-bold hover:bg-gray-100 transition uppercase text-xs tracking-widest"
                >
                    Abandonar Campo
                </button>
            </div>
        </div>
        </div>
    );
  }

  // Pantalla de Login (Tunel de Vestuarios)
  return (
    <div className="min-h-screen bg-stadium-gradient flex items-center justify-center p-4 relative">
      {/* Pattern overlay */}
      <div className="absolute inset-0 bg-pattern-soccer opacity-10"></div>
      
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full relative z-10 border-t-8 border-skyworth-accent animate-fade-in">
        <div className="text-center mb-6">
            <div className="text-4xl mb-2">⚡</div>
            <h2 className="text-3xl font-sport text-skyworth-dark uppercase tracking-widest">
            {isRegistering ? 'NUEVO FICHAJE' : 'ZONA TÉCNICA'}
            </h2>
            <p className="text-xs text-gray-400 font-bold tracking-wider uppercase">Acceso Restringido - Solo Personal</p>
        </div>
        
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded mb-4 text-sm font-bold animate-pulse">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-skyworth-blue mb-1 uppercase tracking-wide">Credencial (Email)</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full p-3 border-2 border-gray-200 rounded focus:border-skyworth-accent outline-none transition font-semibold"
              placeholder="dt@skyworth.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-skyworth-blue mb-1 uppercase tracking-wide">Clave de Acceso</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full p-3 border-2 border-gray-200 rounded focus:border-skyworth-accent outline-none transition font-semibold"
              placeholder="••••••"
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-skyworth-grass text-white py-4 rounded font-sport text-2xl hover:bg-skyworth-pitch transition disabled:opacity-50 shadow-lg tracking-wider"
          >
            {loading ? 'VERIFICANDO...' : (isRegistering ? 'FIRMAR CONTRATO' : 'ENTRAR AL CAMPO')}
          </button>
        </form>
        
        <div className="mt-6 text-center border-t border-gray-100 pt-4">
           <button 
             type="button"
             onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
             className="text-skyworth-blue text-xs font-bold hover:underline uppercase tracking-wide"
           >
             {isRegistering ? '¿Ya tienes credencial? Ingresa aquí' : '¿Nuevo DT? Solicita acceso'}
           </button>
        </div>

        <button onClick={() => window.location.hash = ''} className="w-full mt-6 text-gray-400 text-xs hover:text-gray-600 font-bold uppercase flex items-center justify-center gap-1">
          <span>←</span> Volver a la Tribuna
        </button>
      </div>
    </div>
  );
}