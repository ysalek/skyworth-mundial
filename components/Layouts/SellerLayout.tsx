import React from 'react';

interface Props {
  children: React.ReactNode;
}

export default function SellerLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans flex flex-col">
      {/* Seller Header */}
      <nav className="fixed w-full z-50 bg-white border-b border-gray-200 shadow-sm h-[var(--header-h)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.hash = 'seller'}>
              <div className="text-2xl font-sport text-skyworth-blue tracking-widest">SKYWORTH</div>
              <span className="bg-skyworth-grass text-[10px] px-2 py-0.5 rounded text-white font-bold tracking-wider uppercase">
                VENDEDORES
              </span>
            </div>

            <div className="flex items-center gap-4">
               <button onClick={() => window.location.hash = ''} className="text-xs text-gray-500 hover:text-skyworth-blue">
                 ← Volver al sitio público
               </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full pt-[var(--header-h)] p-6">
        {children}
      </main>
    </div>
  );
}
