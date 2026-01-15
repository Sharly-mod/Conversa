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

export const Chat = ({ chatId, userId }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages', 
        filter: `chat_id=eq.${chatId}` 
      }, () => fetchMessages())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(username, avatar_url)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    
    if (!error && data) setMessages(data);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendNotification = async (messageContent) => {
    try {
      const { data: members } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', userId);

      if (!members || members.length === 0) return;

      const recipientIds = members.map(m => m.user_id);

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": "Basic YOUR_REST_API_KEY" 
        },
        body: JSON.stringify({
          app_id: "6f68c65b-97c2-4bcd-965e-905b3baed48f",
          include_external_user_ids: recipientIds,
          headings: { "fr": "Nouveau message" },
          contents: { "fr": messageContent },
          url: window.location.origin
        })
      });
    } catch (err) {
      console.error("Erreur push notification:", err);
    }
  };

const handleSend = async (e) => {
  e.preventDefault();
  // On vérifie qu'il y a soit du texte, soit des images
  if (!text.trim() && selectedFiles.length === 0) return;

  setIsUploading(true);

  try {
    if (editingMsgId) {
      // --- MODE EDITION ---
      await supabase
        .from('messages')
        .update({ content: text, is_edited: true })
        .eq('id', editingMsgId);
      setEditingMsgId(null);
    } else {
      // --- MODE ENVOI (Le point critique) ---
      let imageUrls = [];

      // 1. On attend que TOUTES les images soient uploadées avant de continuer
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
          const { data, error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(fileName, file);

          if (uploadError) {
            console.error("Erreur upload:", uploadError.message);
          } else if (data) {
            const { data: urlData } = supabase.storage
              .from('chat-media')
              .getPublicUrl(fileName);
            imageUrls.push(urlData.publicUrl);
          }
        }
      }

      // 2. On insère dans la base de données UNIQUEMENT après l'upload
      // On s'assure que imageUrls est bien un tableau envoyé dans la colonne 'images'
      const { error: insertError } = await supabase.from('messages').insert([{
        chat_id: chatId,
        user_id: userId,
        content: text.trim(), // Le texte reste du texte
        images: imageUrls    // Les URLs vont STRICTEMENT dans la colonne images
      }]);

      if (!insertError) {
        sendNotification(text || "📷 Image reçue");
      } else {
        console.error("Erreur insertion message:", insertError.message);
      }
    }

    // 3. Reset complet de l'interface
    setText('');
    setSelectedFiles([]);
    setPreviews([]);
  } catch (err) {
    console.error("Erreur globale:", err);
  } finally {
    setIsUploading(false);
  }
};

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer ce message ?")) {
      await supabase.from('messages').delete().eq('id', id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#313338] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.user_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 rounded-xl shadow-sm ${
              msg.user_id === userId ? 'bg-indigo-600 text-white' : 'bg-[#383a40] text-gray-100'
            }`}>
              <div className="flex justify-between items-center gap-4 mb-1">
                <span className="text-[10px] font-bold text-indigo-300">{msg.profiles?.username}</span>
                {msg.user_id === userId && (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingMsgId(msg.id); setText(msg.content); }}><Edit2 size={12}/></button>
                    <button onClick={() => handleDelete(msg.id)}><Trash2 size={12} className="text-red-400"/></button>
                  </div>
                )}
              </div>

              {msg.content && <p className="text-sm break-words">{msg.content}</p>}
              
              {/* AFFICHAGE DES IMAGES */}
              {msg.images && msg.images.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.images.map((img, i) => (
                    <img 
                      key={i} 
                      src={img} 
                      className="rounded-lg max-h-64 w-full object-cover border border-black/20" 
                      alt="" 
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  ))}
                </div>
              )}
              
              <div className="text-[9px] opacity-40 mt-1 text-right">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.is_edited && " (modifié)"}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Prévisualisation avant envoi */}
      {previews.length > 0 && (
        <div className="flex gap-3 p-3 bg-[#2b2d31] border-t border-white/5 overflow-x-auto">
          {previews.map((url, index) => (
            <div key={index} className="relative flex-shrink-0">
              <img src={url} className="w-20 h-20 object-cover rounded-lg ring-2 ring-indigo-500" alt="" />
              <button 
                onClick={() => {
                  setPreviews(p => p.filter((_, i) => i !== index));
                  setSelectedFiles(f => f.filter((_, i) => i !== index));
                }}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white"
              ><X size={12}/></button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-[#313338]">
        <form onSubmit={handleSend} className="flex items-center gap-3 bg-[#383a40] rounded-2xl px-4 py-2.5">
          <label className={`hover:text-white transition cursor-pointer ${editingMsgId ? 'text-gray-600' : 'text-gray-400'}`}>
            <ImageIcon size={22} />
            <input 
              type="file" multiple className="hidden" accept="image/*" 
              disabled={!!editingMsgId}
              onChange={(e) => {
                const files = Array.from(e.target.files);
                setSelectedFiles(prev => [...prev, ...files]);
                setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
              }} 
            />
          </label>
          
          <div className="flex-1">
            {editingMsgId && <p className="text-[9px] text-indigo-400 font-bold mb-0.5 uppercase">Mode édition</p>}
            <input 
              className="bg-transparent w-full outline-none text-white text-sm" 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              placeholder="Envoyer un message..." 
            />
          </div>

          <button disabled={isUploading} type="submit" className="text-indigo-400">
            {isUploading ? <Loader2 className="animate-spin" size={20} /> : editingMsgId ? <Check size={22} /> : <Send size={22} />}
          </button>
          
          {editingMsgId && (
            <button onClick={() => { setEditingMsgId(null); setText(''); }} className="text-gray-400"><X size={20}/></button>
          )}
        </form>
      </div>
    </div>
  );
};