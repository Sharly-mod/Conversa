import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // Pour l'inscription
  const [isSignUp, setIsSignUp] = useState(false); // Bascule entre Login et Register

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      // INSCRIPTION
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username }, // On stocke le pseudo dans les métadonnées
        },
      });
      if (error) alert(error.message);
      else alert("Vérifie tes emails pour confirmer l'inscription !");
    } else {
      // CONNEXION
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1f22] text-white">
      <div className="w-full max-w-[480px] p-8 bg-[#313338] rounded-lg shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">
            {isSignUp ? 'Créer un compte' : 'De retour parmi nous !'}
          </h2>
          <p className="text-gray-400">
            {isSignUp ? 'Rejoignez la communauté' : "Nous sommes ravis de vous revoir !"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {/* Champ Username affiché uniquement si on s'inscrit */}
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Nom d'utilisateur</label>
              <input
                type="text"
                className="w-full p-3 bg-[#1e1f22] border-none rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-2">E-mail</label>
            <input
              type="email"
              className="w-full p-3 bg-[#1e1f22] border-none rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Mot de passe</label>
            <input
              type="password"
              className="w-full p-3 bg-[#1e1f22] border-none rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            disabled={loading}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded font-medium transition-colors duration-200"
          >
            {loading ? 'Traitement...' : isSignUp ? "S'inscrire" : 'Se connecter'}
          </button>

          <div className="text-sm mt-4">
            <span className="text-gray-400">
              {isSignUp ? 'Déjà un compte ?' : "Besoin d'un compte ?"}
            </span>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-2 text-indigo-400 hover:underline"
            >
              {isSignUp ? 'Se connecter' : "S'inscrire"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}