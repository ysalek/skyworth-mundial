import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import PublicLanding from './components/PublicLanding';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';

// Navegación simple basada en estado para SPA
enum View {
  LANDING = 'LANDING',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}

// UID de respaldo para acceso administrativo inmediato
const SUPER_ADMIN_UID = 'LTNwDZDCH6cZwqhVH7Ol1guYBuJ2';

// --- COMPONENTE LOADER TEMÁTICO ---
const StadiumLoader = () => (
  <div className="h-screen w-full bg-skyworth-dark flex flex-col items-center justify-center relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#005BBB_0%,_#001A3D_100%)]"></div>
    <div className="relative z-10 flex flex-col items-center">
        <div className="text-6xl animate-bounce mb-4">⚽</div>
        <h2 className="text-3xl font-sport text-white tracking-widest mb-2">SKYWORTH</h2>
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-skyworth-accent rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-skyworth-accent rounded-full animate-pulse delay-75"></div>
            <div className="w-2 h-2 bg-skyworth-accent rounded-full animate-pulse delay-150"></div>
        </div>
        <p className="text-skyworth-accent text-xs mt-4 font-mono uppercase tracking-widest opacity-80">Conectando al estadio...</p>
    </div>
  </div>
);

export default function App() {
  const [currentView, setCurrentView] = useState<View>(View.LANDING);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Función para re-verificar permisos manualmente
  const checkAdminStatus = async (currentUser: User) => {
    try {
      // FORCE REFRESH: true obliga a bajar el token nuevo con los claims actualizados
      const tokenResult = await currentUser.getIdTokenResult(true);
      
      // Permitir acceso si tiene claim admin O si coincide con el UID del Super Admin
      const hasAdmin = !!tokenResult.claims.admin || currentUser.uid === SUPER_ADMIN_UID;
      
      setIsAdmin(hasAdmin);
      return hasAdmin;
    } catch (e) {
      console.error("Error checking admin status:", e);
      setIsAdmin(false);
      return false;
    }
  };

  useEffect(() => {
    // Detectar URL hash para navegación simple
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#admin') {
        setCurrentView(user ? View.ADMIN_DASHBOARD : View.ADMIN_LOGIN);
      } else {
        setCurrentView(View.LANDING);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkAdminStatus(currentUser);
        if (window.location.hash === '#admin') {
          setCurrentView(View.ADMIN_DASHBOARD);
        }
      } else {
        setIsAdmin(false);
        if (window.location.hash === '#admin') {
          setCurrentView(View.ADMIN_LOGIN);
        }
      }
      // Simulamos un pequeño delay extra para que se aprecie la marca
      setTimeout(() => setLoading(false), 800);
    });

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      unsubscribe();
    };
  }, [user]);

  if (loading) return <StadiumLoader />;

  return (
    <>
      {currentView === View.LANDING && <PublicLanding />}
      {currentView === View.ADMIN_LOGIN && <AdminLogin onLogin={() => setCurrentView(View.ADMIN_DASHBOARD)} />}
      {currentView === View.ADMIN_DASHBOARD && (
        isAdmin ? 
        <AdminPanel /> : 
        <AdminLogin 
          error="Tu ficha técnica no tiene permisos de DT (Admin)." 
          onRetry={async () => {
            if (user) {
              setLoading(true);
              await checkAdminStatus(user);
              setLoading(false);
            }
          }}
        />
      )}
    </>
  );
}