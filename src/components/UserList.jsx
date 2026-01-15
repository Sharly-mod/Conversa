import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, Check, X, Users, Bell } from 'lucide-react';
import { AddFriend } from './AddFriend';

export function UserList({ currentUserId, onSelectChat }) {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeTab, setActiveTab] = useState('friends');

  const fetchData = async () => {
    if (!currentUserId) return;

    // 1. Récupération des amis acceptés
    const { data: acceptedData } = await supabase
      .from('friends')
      .select('*, user:profiles!user_id(id, username), friend:profiles!friend_id(id, username)')
      .eq('status', 'accepted')
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

    // 2. Récupération des demandes en attente (reçues par moi)
    const { data: pendingData } = await supabase
      .from('friends')
      .select('id, user:profiles!user_id(id, username)')
      .eq('friend_id', currentUserId)
      .eq('status', 'pending');

    // Nettoyage des données pour éviter les profils null et les doublons
    const cleanFriends = (acceptedData || [])
      .map(f => (f.user_id === currentUserId ? f.friend : f.user))
      .filter((profile, index, self) => 
        profile !== null && self.findIndex(p => p.id === profile.id) === index
      );

    setFriends(cleanFriends);
    setPending(pendingData || []);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('friends-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => fetchData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUserId]);

  const handleAction = async (id, status) => {
    if (status === 'accepted') {
      await supabase.from('friends').update({ status }).eq('id', id);
    } else {
      await supabase.from('friends').delete().eq('id', id);
    }
    fetchData();
  };

  const startPrivateChat = async (friend) => {
    const dmKey = [currentUserId, friend.id].sort().join('--');
    const { data: chat } = await supabase
      .from('chats')
      .upsert({ name: friend.username, dm_key: dmKey, type: 'dm' }, { onConflict: 'dm_key' })
      .select().single();
    
    if (chat) onSelectChat(chat.id);
  };

  return (
    <div className="flex flex-col h-full border-t border-[#1e1f22] mt-4 pt-2 overflow-hidden">
      <div className="flex px-4 gap-4 mb-4">
        <button onClick={() => setActiveTab('friends')} className={`text-xs font-bold uppercase ${activeTab === 'friends' ? 'text-white' : 'text-gray-500'}`}>
          Amis ({friends.length})
        </button>
        <button onClick={() => setActiveTab('requests')} className={`text-xs font-bold uppercase relative ${activeTab === 'requests' ? 'text-white' : 'text-gray-500'}`}>
          Demandes {pending.length > 0 && <span className="ml-1 bg-red-500 text-[10px] px-1 rounded-full">{pending.length}</span>}
        </button>
      </div>

      <AddFriend currentUserId={currentUserId} />

      <div className="flex-1 overflow-y-auto px-2">
        {activeTab === 'friends' ? (
          friends.map(f => (
            <div key={f.id} className="flex items-center justify-between p-2 hover:bg-[#35373c] rounded-md group">
              <div className="flex items-center gap-3">
                <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${f.id}`} className="w-8 h-8 rounded-full" alt="" />
                <span className="text-sm text-gray-300">{f.username}</span>
              </div>
              <button onClick={() => startPrivateChat(f)} className="opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-white">
                <MessageSquare size={18} />
              </button>
            </div>
          ))
        ) : (
          pending.map(p => (
            <div key={p.id} className="flex items-center justify-between p-2 bg-[#2b2d31] rounded-md mb-2">
              <span className="text-sm text-white">{p.user?.username}</span>
              <div className="flex gap-2">
                <button onClick={() => handleAction(p.id, 'accepted')} className="text-green-500"><Check size={18} /></button>
                <button onClick={() => handleAction(p.id, 'rejected')} className="text-red-500"><X size={18} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}