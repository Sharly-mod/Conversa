import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserList } from './UserList';
import { Hash, LogOut, Settings, User, X, Upload, Loader2 } from 'lucide-react';
import OneSignal from 'react-onesignal'; // <--- AJOUTE CETTE LIGNE

export function Layout({ children, onSelectChat, userId }) {
  const [chats, setChats] = useState([]);
  const [friendDMs, setFriendDMs] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [myProfile, setMyProfile] = useState({ username: '', avatar_url: '' });
  const [isUploading, setIsUploading] = useState(false); // État pour le chargement de l'image

  const fetchData = async () => {
    if (!userId) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileData) setMyProfile(profileData);

    const { data: membership } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', userId);

    const chatIds = membership?.map(m => m.chat_id) || [];

    const { data: chatsData } = await supabase
      .from('chats')
      .select('*')
      .or(`type.eq.group,id.in.(${chatIds.length > 0 ? chatIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .order('created_at', { ascending: true });

    const { data: friendsData } = await supabase
      .from('friends')
      .select(`
        id,
        status,
        user:profiles!user_id(id, username, avatar_url),
        friend:profiles!friend_id(id, username, avatar_url)
      `)
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (chatsData) {
      const uniqueGroups = chatsData
        .filter(c => c.type === 'group')
        .reduce((acc, current) => {
          const isDuplicate = acc.find(c => c.name.toLowerCase() === current.name.toLowerCase());
          if (!isDuplicate) acc.push(current);
          return acc;
        }, []);
      setChats(uniqueGroups);
    }

    if (friendsData) {
      const formattedFriends = friendsData.map(f => {
        const p = f.user.id === userId ? f.friend : f.user;
        return { id: p.id, name: p.username, avatar: p.avatar_url };
      });
      setFriendDMs(formattedFriends);
    }
  };

useEffect(() => {
  if (userId) {
    fetchData();

    // On attend que OneSignal soit prêt avant de se connecter
    const setupOneSignal = async () => {
      if (OneSignal.initialized) {
        try {
          await OneSignal.login(userId);
          console.log("OneSignal: Utilisateur identifié", userId);
        } catch (err) {
          console.error("Erreur login OneSignal:", err);
        }
      }
    };

    setupOneSignal();
  }
}, [userId]);

  // NOUVELLE FONCTION : Upload de l'image de profil
  const handleUploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      
      // Mise à jour immédiate de la prévisualisation
      setMyProfile(prev => ({ ...prev, avatar_url: data.publicUrl }));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de l'image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartDM = async (friend) => {
    const dmKey = [userId, friend.id].sort().join('--');
    const { data: chat } = await supabase
      .from('chats')
      .upsert({ name: friend.name, dm_key: dmKey, type: 'dm' }, { onConflict: 'dm_key' })
      .select().single();

    if (chat) {
      await supabase.from('chat_members').upsert({ chat_id: chat.id, user_id: userId });
      onSelectChat(chat.id);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('profiles')
      .update({ 
        username: myProfile.username, 
        avatar_url: myProfile.avatar_url 
      })
      .eq('id', userId);

    if (!error) {
      setShowProfileModal(false);
      fetchData();
    }
  };

  return (
    <div className="flex h-screen bg-[#313338] text-white overflow-hidden font-sans">
      <div className="w-64 bg-[#2b2d31] flex flex-col border-r border-[#1e1f22]">
        <div className="p-4 font-bold border-b border-[#1e1f22] shadow-sm">Serveur Chat</div>
        
        <div className="flex-1 overflow-y-auto pt-4 custom-scrollbar">
          <div className="px-2 mb-4">
            <h3 className="px-2 text-xs font-semibold text-gray-400 uppercase mb-2">Salons textuels</h3>
            {chats.map(chat => (
              <div key={chat.id} onClick={() => onSelectChat(chat.id)} className="group p-2 hover:bg-[#35373c] rounded cursor-pointer text-gray-400 hover:text-white flex items-center gap-2 mb-1">
                <Hash size={20} className="text-gray-500" />
                <span className="truncate">{chat.name.toLowerCase()}</span>
              </div>
            ))}
          </div>

          <div className="px-2 mb-4">
            <h3 className="px-2 text-xs font-semibold text-gray-400 uppercase mb-2">Messages directs</h3>
            {friendDMs.map(friend => (
              <div key={friend.id} onClick={() => handleStartDM(friend)} className="p-2 hover:bg-[#35373c] rounded cursor-pointer text-gray-400 hover:text-white flex items-center gap-2 mb-1">
                <img 
                  src={friend.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.id}`} 
                  className="w-6 h-6 rounded-full object-cover" 
                />
                <span className="truncate font-medium">{friend.name}</span>
              </div>
            ))}
          </div>

          <UserList currentUserId={userId} onSelectChat={onSelectChat} />
        </div>

        <div className="bg-[#232428] p-2 flex items-center justify-between">
          <div className="flex items-center gap-2 px-1">
            <img 
              src={myProfile.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`} 
              className="w-8 h-8 rounded-full border border-gray-700 object-cover" 
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate w-20">{myProfile.username || 'Utilisateur'}</span>
              <span className="text-[10px] text-gray-400 leading-none">En ligne</span>
            </div>
          </div>
          <div className="flex items-center">
            <button onClick={() => setShowProfileModal(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#35373c] rounded transition">
              <Settings size={18} />
            </button>
            <button onClick={() => supabase.auth.signOut()} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#35373c] rounded transition">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#313338] relative">{children}</div>

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#313338] w-full max-w-md rounded-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#1e1f22] flex justify-between items-center bg-[#2b2d31]">
              <h2 className="text-lg font-bold">Paramètres du profil</h2>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-5">
              <div className="flex flex-col items-center mb-4 gap-3">
                <div className="relative group">
                  <img 
                    src={myProfile.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`} 
                    className="w-24 h-24 rounded-full border-4 border-[#1e1f22] object-cover shadow-xl"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <Loader2 className="animate-spin text-white" />
                    </div>
                  )}
                </div>
                
                {/* BOUTON UPLOAD FICHIER */}
                <label className="cursor-pointer bg-[#4e5058] hover:bg-[#6d6f78] text-white px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2">
                  <Upload size={16} />
                  Changer l'image
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} disabled={isUploading} />
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Nom d'utilisateur</label>
                <input 
                  type="text"
                  value={myProfile.username}
                  onChange={(e) => setMyProfile({...myProfile, username: e.target.value})}
                  className="w-full bg-[#1e1f22] text-gray-200 mt-2 p-2 rounded border border-transparent focus:border-indigo-500 outline-none transition"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowProfileModal(false)} className="flex-1 py-2 text-sm font-medium hover:underline">Annuler</button>
                <button type="submit" disabled={isUploading} className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white py-2 rounded font-bold transition shadow-lg">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}