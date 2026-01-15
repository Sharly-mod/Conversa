import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './pages/Auth';
import { Layout } from './components/Layout';
import { Chat } from './components/Chat';
import OneSignal from 'react-onesignal';

function App() {
  const [session, setSession] = useState(null);
  const [activeChatId, setActiveChatId] = useState(() => {
    return localStorage.getItem('activeChatId') || null;
  });

  // --- INITIALISATION ONESIGNAL (Version corrigée) ---
  useEffect(() => {
    const initOneSignal = async () => {
      // Utilisation du flag interne de OneSignal pour éviter le crash
      if (OneSignal.initialized) return; 

      try {
        await OneSignal.init({ 
          appId: "6f68c65b-97c2-4bcd-965e-905b3baed48f",
          allowLocalhostAsSecureOrigin: true,
          // Affiche la cloche de notification pour faciliter tes tests
          notifyButton: {
            enable: true,
          },
        });
        console.log("✅ OneSignal initialisé");
      } catch (err) {
        // Si l'erreur est "already initialized", on l'ignore simplement
        if (!err.message?.includes("already initialized")) {
          console.error("❌ Erreur d'initialisation OneSignal:", err);
        }
      }
    };

    initOneSignal();
  }, []);

  // --- GESTION DE LA SESSION ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchGeneralChat();
        // Identifier l'utilisateur sur OneSignal dès la connexion
        OneSignal.login(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchGeneralChat();
        OneSignal.login(session.user.id);
      } else {
        OneSignal.logout();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchGeneralChat = async () => {
    const { data } = await supabase
      .from('chats')
      .select('id')
      .eq('name', 'General')
      .eq('type', 'group')
      .maybeSingle(); 

    if (data && !activeChatId) {
      setActiveChatId(data.id);
      localStorage.setItem('activeChatId', data.id);
    }
  };

  const handleSelectChat = (id) => {
    setActiveChatId(id);
    localStorage.setItem('activeChatId', id);
  };

  if (!session) return <Auth />;

  return (
    <Layout onSelectChat={handleSelectChat} userId={session.user.id}>
      {activeChatId ? (
        <Chat key={activeChatId} chatId={activeChatId} userId={session.user.id} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-[#313338]">
          <p>Sélectionnez une discussion pour commencer.</p>
        </div>
      )}
    </Layout>
  );
}

export default App;