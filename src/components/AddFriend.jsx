import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Search } from 'lucide-react';

export function AddFriend({ currentUserId }) {
  const [searchName, setSearchName] = useState('');
  const [message, setMessage] = useState('');

  const sendRequest = async () => {
    // 1. Trouver l'ID de l'utilisateur par son nom
    const { data: targetUser, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', searchName)
      .single();

    if (findError || !targetUser) {
      setMessage("Utilisateur introuvable");
      return;
    }

    if (targetUser.id === currentUserId) {
      setMessage("C'est vous !");
      return;
    }

    // 2. Créer la demande
    const { error: requestError } = await supabase
      .from('friends')
      .insert([{ user_id: currentUserId, friend_id: targetUser.id, status: 'pending' }]);

    if (requestError) setMessage("Déjà envoyé ou erreur");
    else setMessage("Demande envoyée !");
  };

  return (
    <div className="p-4 bg-[#232428] m-2 rounded-lg">
      <p className="text-xs font-bold text-gray-400 uppercase mb-2">Ajouter un ami</p>
      <div className="flex gap-2">
        <input 
          className="bg-[#1e1f22] text-sm p-2 rounded flex-1 outline-none" 
          placeholder="Pseudo exact..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />
        <button onClick={sendRequest} className="bg-indigo-500 p-2 rounded hover:bg-indigo-600">
          <UserPlus size={18} />
        </button>
      </div>
      {message && <p className="text-[10px] mt-2 text-indigo-400">{message}</p>}
    </div>
  );
}