import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Send, 
  Image as ImageIcon, 
  X, 
  Loader2, 
  Check, 
  Trash2, 
  Edit2 
} from 'lucide-react';
import OneSignal from 'react-onesignal';

export const Chat = ({ chatId, userId }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const messagesEndRef = useRef(null);

  // 1. Charger les messages et s'abonner aux changements
  useEffect(() => {
    fetchMessages();
    const subscription = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, 
      () => fetchMessages())
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(username, avatar_url)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // 2. Fonction pour envoyer une notification Push via OneSignal
  const sendNotification = async (messageText) => {
    try {
      // On récupère les membres du chat (sauf nous-mêmes)
      const { data: members } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', userId);

      if (!members || members.length === 0) return;

      const recipientIds = members.map(m => m.user_id);

      // Appel à l'API OneSignal
      // Note : Dans un vrai projet, utilisez une Edge Function pour cacher la clé API
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": "Basic YOUR_REST_API_KEY" // REMPLACE PAR TA CLE REST API ONESIGNAL
        },
        body: JSON.stringify({
          app_id: "6f68c65b-97c2-4bcd-965e-905b3baed48f",
          include_external_user_ids: recipientIds,
          headings: { "en": "Nouveau message", "fr": "Nouveau message" },
          contents: { "en": messageText, "fr": messageText },
          url: window.location.origin
        })
      });
    } catch (err) {
      console.error("Erreur notification:", err);
    }
  };

  // 3. Envoyer ou Modifier un message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      if (editingMsgId) {
        // Mode Edition
        await supabase.from('messages').update({ content: text, is_edited: true }).eq('id', editingMsgId);
        setEditingMsgId(null);
      } else {
        // Mode Envoi
        let imageUrls = [];

        // Upload des images si présentes
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const { data } = await supabase.storage.from('chat-attachments').upload(fileName, file);
          if (data) {
            const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(fileName);
            imageUrls.push(urlData.publicUrl);
          }
        }

        const { error } = await supabase.from('messages').insert([{
          chat_id: chatId,
          user_id: userId,
          content: text,
          images: imageUrls
        }]);

        if (!error) {
          sendNotification(text || "📷 Image envoyée");
        }
      }

      setText('');
      setSelectedFiles([]);
      setPreviews([]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#313338]">
      {/* Liste des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.user_id === userId ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl ${
              msg.user_id === userId ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#383a40] text-gray-200 rounded-tl-none'
            }`}>
              <p className="text-xs font-bold mb-1 text-indigo-300">{msg.profiles?.username}</p>
              {msg.content && <p className="text-sm">{msg.content}</p>}
              
              {msg.images?.map((img, i) => (
                <img key={i} src={img} alt="attachment" className="mt-2 rounded-lg max-h-60 w-full object-cover" />
              ))}
              
              <div className="flex items-center justify-end gap-2 mt-1">
                <span className="text-[10px] opacity-50">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.user_id === userId && (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingMsgId(msg.id); setText(msg.content); }} className="hover:text-white">
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* --- Zone de Prévisualisation des images --- */}
      {previews.length > 0 && (
        <div className="flex gap-2 p-2 bg-[#2b2d31] overflow-x-auto border-t border-[#1e1f22]">
          {previews.map((url, index) => (
            <div key={index} className="relative flex-shrink-0">
              <img src={url} className="w-20 h-20 object-cover rounded-lg border border-indigo-500" alt="Preview" />
              <button 
                onClick={() => {
                  setPreviews(prev => prev.filter((_, i) => i !== index));
                  setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                }}
                className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1 text-white shadow-lg"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* --- Input de message --- */}
      <div className="p-4 bg-[#313338]">
        <form onSubmit={handleSend} className="flex items-center gap-3 bg-[#383a40] rounded-xl px-4 py-2 shadow-inner">
          <label className={`cursor-pointer text-gray-400 hover:text-white transition ${editingMsgId ? 'opacity-20' : ''}`}>
            <ImageIcon size={22} />
            <input 
              type="file" 
              multiple 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => {
                const files = Array.from(e.target.files);
                setSelectedFiles(prev => [...prev, ...files]);
                setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
              }} 
              disabled={!!editingMsgId} 
            />
          </label>
          
          <div className="flex-1 flex flex-col">
            {editingMsgId && <span className="text-[10px] text-indigo-400 font-bold mb-1 uppercase tracking-wider">Modification...</span>}
            <input 
              className="bg-transparent outline-none text-white text-sm py-1" 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              placeholder="Écrire un message..." 
            />
          </div>

          <button disabled={isUploading} type="submit" className="text-indigo-400 hover:scale-110 transition-transform">
            {isUploading ? <Loader2 className="animate-spin" size={22} /> : editingMsgId ? <Check size={22} /> : <Send size={22} />}
          </button>

          {editingMsgId && (
            <button onClick={() => { setEditingMsgId(null); setText(''); }} className="text-red-400 ml-1">
              <X size={20} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};