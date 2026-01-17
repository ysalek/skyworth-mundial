import React from 'react';

interface Props {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans selection:bg-skyworth-blue selection:text-white flex flex-col">
      {/* Fixed Header */}
      <nav className="fixed w-full z-50 border-b border-white/5 bg-[#0B0F19]/90 backdrop-blur-md h-[var(--header-h)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="text-2xl font-sport text-white tracking-widest">SKYWORTH</div>
              <span className="bg-skyworth-blue text-[10px] px-2 py-0.5 rounded text-white font-bold tracking-wider uppercase">
                Mundial 2026
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                <a href="#inicio" className="hover:text-skyworth-accent transition-colors">Inicio</a>
                <a href="#registrar-compra" className="hover:text-skyworth-accent transition-colors">Registrar Compra</a>
                <a href="#premios" className="hover:text-skyworth-accent transition-colors">Premios</a>
                <a href="#ganadores" className="hover:text-skyworth-accent transition-colors">Ganadores</a>
                <button
                    onClick={() => window.location.hash = 'seller'}
                    className="border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 hover:border-skyworth-grass hover:text-skyworth-grass transition-all"
                >
                    Soy Vendedor
                </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content with Padding */}
      <main className="flex-1 w-full pt-[var(--header-h)]">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#05080f] text-gray-500 py-8 text-center text-xs border-t border-white/10 relative z-10">
        <p className="mb-2">&copy; 2025 Skyworth Bolivia. Todos los derechos reservados.</p>
        <p className="mb-4 text-[10px] opacity-50">El Sueño del Hincha - Repechaje Rumbo a México 2026</p>
        <button
          onClick={(e) => { e.preventDefault(); window.location.hash = 'admin'; }}
          className="text-gray-700 hover:text-gray-500 transition underline bg-transparent border-0 cursor-pointer"
        >
          Acceso Administrativo
        </button>
      </footer>
    </div>
  );
}
