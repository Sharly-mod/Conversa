import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useMessages(chatId) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!chatId) return;

    // Charger les messages existants
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    };
    fetchMessages();

    // S'abonner aux nouveaux messages
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((current) => [...current, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  return messages;
}