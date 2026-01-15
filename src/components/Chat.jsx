import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Image as ImageIcon, X, Send, Loader2, Trash2, Edit3, Check } from 'lucide-react';

export function Chat({ chatId, userId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [previews, setPreviews] = useState([]); 
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [isUploading, setIsUploading] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const scrollRef = useRef(null);

  // --- LOGIQUE NOTIFICATION ---
  const sendPushNotification = async (content) => {
    try {
      // 1. On récupère les IDs des autres membres du chat
      const { data: members } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', userId);

      if (!members || members.length === 0) return;
      const recipientIds = members.map(m => m.user_id);

      // 2. Envoi à l'API OneSignal
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": "os_v2_app_n5ummw4xyjf43fs6sbntxlwur4aw6qfemnrurbu2qvrqu3o52tf7wij4lloidwyat5lgvadx4rfqgcgabbeheh66ges5gfr4owsv7vi" // <--- METS TA CLÉ REST ICI
        },
        body: JSON.stringify({
          app_id: "6f68c65b-97c2-4bcd-965e-905b3baed48f", // <--- METS TON APP ID ICI
          include_external_user_ids: recipientIds,
          headings: { "fr": "Nouveau message" },
          contents: { "fr": content.startsWith('http') ? "📷 Image reçue" : content },
          url: window.location.origin
        })
      });
    } catch (err) {
      console.error("Erreur notification:", err);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select(`*, author:profiles!sender_id(username, avatar_url)`)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`chat:${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, 
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        } else {
          fetchMessages();
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [chatId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleDelete = async (id) => {
    if (confirm("Supprimer ce message ?")) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      await supabase.from('messages').delete().eq('id', id);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && selectedFiles.length === 0) return;
    setIsUploading(true);

    try {
      if (editingMsgId) {
        await supabase.from('messages').update({ content: text }).eq('id', editingMsgId);
        setEditingMsgId(null);
      } else {
        // Envoi des images
        for (const file of selectedFiles) {
          const fileName = `${Date.now()}-${file.name}`;
          await supabase.storage.from('chat-media').upload(`${chatId}/${fileName}`, file);
          const { data } = supabase.storage.from('chat-media').getPublicUrl(`${chatId}/${fileName}`);
          
          await supabase.from('messages').insert([{ content: data.publicUrl, chat_id: chatId, sender_id: userId }]);
          sendPushNotification(data.publicUrl); // Notification pour l'image
        }

        // Envoi du texte
        if (text.trim()) {
          await supabase.from('messages').insert([{ content: text, chat_id: chatId, sender_id: userId }]);
          sendPushNotification(text); // Notification pour le texte
        }
      }
      setText(''); setPreviews([]); setSelectedFiles([]);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setIsUploading(false); 
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#313338]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((m) => {
          const isMe = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
              <img 
                src={m.author?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${m.sender_id}`} 
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 mb-1" 
              />
              <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-bold text-gray-300">{m.author?.username}</span>
                  <span className="text-[10px] text-gray-500">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className={`p-3 rounded-2xl shadow-sm ${
                  isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-[#383a40] text-gray-200 rounded-bl-none'
                }`}>
                  {m.content.includes('supabase.co/storage') || m.content.startsWith('http') ? (
                    <img src={m.content} className="rounded-lg max-h-64 object-contain" alt="Media" />
                  ) : (
                    <p className="text-sm break-words">{m.content}</p>
                  )}
                </div>

                {isMe && (
                  <div className="flex gap-3 mt-1 px-2">
                    {!m.content.includes('supabase.co/storage') && (
                      <button onClick={() => { setEditingMsgId(m.id); setText(m.content); }} className="text-[10px] text-gray-500 hover:text-indigo-400 font-bold uppercase tracking-wider">Modifier</button>
                    )}
                    <button onClick={() => handleDelete(m.id)} className="text-[10px] text-gray-500 hover:text-red-400 font-bold uppercase tracking-wider">Supprimer</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4">
        <form onSubmit={handleSend} className="flex items-center gap-3 bg-[#383a40] rounded-xl px-4 py-2 shadow-inner">
          <label className={`cursor-pointer text-gray-400 hover:text-white transition ${editingMsgId ? 'opacity-20' : ''}`}>
            <ImageIcon size={22} />
            <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => {
              const files = Array.from(e.target.files);
              setSelectedFiles(prev => [...prev, ...files]);
              setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
            }} disabled={!!editingMsgId} />
          </label>
          
          <div className="flex-1 flex flex-col">
            {editingMsgId && <span className="text-[10px] text-indigo-400 font-bold mb-1">MODIFICATION EN COURS</span>}
            <input className="bg-transparent outline-none text-white text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un message..." />
          </div>

          <button disabled={isUploading} type="submit" className="text-indigo-400 hover:scale-110 transition-transform">
            {isUploading ? <Loader2 className="animate-spin" size={22} /> : editingMsgId ? <Check size={22} /> : <Send size={22} />}
          </button>
          {editingMsgId && <button onClick={() => { setEditingMsgId(null); setText(''); }} className="text-red-400 ml-1"><X size={20} /></button>}
        </form>
      </div>
    </div>
  );
}