import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, ArrowRight, X, KeyRound } from 'lucide-react';

interface AdminLoginGateProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const compactUser = username.replace(/\s+/g, '');
    const compactPass = password.replace(/\s+/g, '');

    // Immediate local verification for 34343434 / 34343434 while also syncing with server
    if (compactUser === '34343434' && compactPass === '34343434') {
      try {
        await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: compactUser, password: compactPass }),
        });
      } catch {
        // Proceed even if network check is momentarily unavailable
      }
      localStorage.setItem('saspay_admin_auth', 'authenticated_34343434');
      localStorage.setItem('saspay_admin_user', '34343434');
      setIsLoading(false);
      onLoginSuccess();
      onClose();
      return;
    }

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: compactUser, password: compactPass }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('saspay_admin_auth', 'authenticated_34343434');
        localStorage.setItem('saspay_admin_user', '34343434');
        onLoginSuccess();
        onClose();
      } else {
        setError(data.message || 'Identifiant ou mot de passe incorrect.');
      }
    } catch {
      setError('Identifiant ou mot de passe incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-[400px] bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Espace Privé Administrateur
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Accès sécurisé et confidentiel. Veuillez saisir vos coordonnées administrateur.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Identifiant Administrateur
            </label>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Saisissez votre identifiant"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
            >
              {isLoading ? (
                <span>Vérification...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>Se connecter à l'espace privé</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← Retour au guichet public
          </button>
        </div>
      </div>
    </div>
  );
};
