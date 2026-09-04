import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Sparkles, X, Send, Bot, User, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AiCopilotModal: React.FC = () => {
  const { currentUser, currentOrg } = useAuth();
  const { selectedOrgId, isAiModalOpen, setIsAiModalOpen } = useApp();
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: `Hello ${currentUser?.name}! I am your **PNGee CyberGuard SOC AI Copilot** (PNGee IT Solutions).\n\nI have live visibility into the security posture, correlated telemetry, active incidents, and compliance indicators for **${currentOrg?.name || 'your assigned organization'}**.\n\nHow can I assist your security team today?`,
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isAiModalOpen) return null;

  const quickPrompts = [
    "What are the top 3 highest risk security issues across our assets right now?",
    "Summarize active incidents and recommend containment actions.",
    "Why was our security posture score deducted?",
    "What is the status of our backup jobs and SSL certificates?"
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const targetOrg = selectedOrgId === 'all' ? (currentOrg?.id || 'org-apex-logistics') : selectedOrgId;
      const res = await api.queryAssistant(query, targetOrg);
      
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: res.response,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ Error querying security model: ${err.message || 'Unable to connect to AI SOC engine.'}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col h-[650px] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-cyan-600/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  PNGee CyberGuard SOC AI Copilot
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Gemini 3.7 Flash Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Context-bound to: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentOrg?.name || 'Apex Logistics'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAiModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Message History */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m) => {
            const isBot = m.sender === 'assistant';
            return (
              <div key={m.id} className={`flex gap-3 ${isBot ? 'justify-start' : 'justify-end'}`}>
                {isBot && (
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-500 flex items-center justify-center shrink-0 mt-1 border border-blue-500/30">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl p-4 text-xs leading-relaxed whitespace-pre-line ${
                    isBot
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      : 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  }`}
                >
                  <p>{m.text}</p>
                  <div className={`mt-2 text-[10px] ${isBot ? 'text-slate-400' : 'text-blue-200'} text-right`}>
                    {m.timestamp}
                  </div>
                </div>
                {!isBot && (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-slate-500 dark:text-slate-400 italic">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-500 flex items-center justify-center shrink-0 animate-spin">
                <RefreshCw className="w-4 h-4" />
              </div>
              <span>SOC Copilot is analyzing telemetry and crafting response...</span>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="px-6 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto text-[11px]">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => handleSend(qp)}
              className="shrink-0 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask SOC AI Copilot about alerts, vulnerabilities, incidents, posture..."
            disabled={isLoading}
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputQuery.trim()}
            className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
