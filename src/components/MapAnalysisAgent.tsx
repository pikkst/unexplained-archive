
import React, { useState } from 'react';
import { Case } from '../types';
import { Bot, Send, X, Map as MapIcon, Sparkles } from 'lucide-react';

interface MapAnalysisAgentProps {
  visibleCases: Case[];
  onClose: () => void;
}

export const MapAnalysisAgent: React.FC<MapAnalysisAgentProps> = ({ visibleCases, onClose }) => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'I am tracking the current map data. Ask me about patterns, clusters, or anomalies in the visible region.' }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const handleAsk = () => {
    if (!query.trim()) return;

    // Add user query
    const newHistory = [...history, { role: 'user' as const, text: query }];
    setHistory(newHistory);
    setQuery('');
    setIsThinking(true);

    // SIMULATION of Gemini API Call with Google Maps Tool
    // In a real implementation:
    // const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // const model = ai.getGenerativeModel({ model: "gemini-2.5-flash", tools: [{ googleMaps: {} }] });
    // ... pass the case coordinates and categories as context ...

    setTimeout(() => {
      let responseText = '';
      const q = query.toLowerCase();

      if (q.includes('cluster') || q.includes('hotspot')) {
        responseText = `Analyzing spatial data... I have detected a significant cluster of ${visibleCases.filter(c => c.category === 'UFO').length} UFO sightings near the 35th parallel. This density is 40% higher than the global average.`;
      } else if (q.includes('pattern') || q.includes('trend')) {
        responseText = `Temporal analysis indicates that 60% of the visible cases occurred between 2:00 AM and 4:00 AM local time. There is a linear correlation between the 'Lights over Mojave' case and the 'Phoenix Lights' historical data points.`;
      } else if (q.includes('location') || q.includes('where')) {
         responseText = `Based on the active map view, there are ${visibleCases.length} incidents. The most anomalous activity is centered around coordinates 35.13N, -116.05W.`;
      } else {
        responseText = `I've analyzed the ${visibleCases.length} cases currently on your map. I can help identify geographical clusters, correlate sighting times with location, or compare these coordinates against known military test sites. What would you like to know?`;
      }

      setHistory([...newHistory, { role: 'model', text: responseText }]);
      setIsThinking(false);
    }, 1500);
  };

  return (
    <div className="absolute bottom-4 right-4 w-96 bg-mystery-900/95 backdrop-blur-xl border border-mystery-500 rounded-xl shadow-2xl flex flex-col z-[1000] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-mystery-800 to-mystery-900 p-4 border-b border-mystery-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-mystery-500 rounded-lg">
             <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Geo-Spatial Analyst</h3>
            <div className="flex items-center gap-1 text-[10px] text-green-400">
               <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
               Gemini 2.5 Flash Active
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Area */}
      <div className="h-64 overflow-y-auto p-4 space-y-4 bg-black/20">
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-mystery-600 text-white rounded-br-none' 
                : 'bg-mystery-800 border border-mystery-700 text-gray-200 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
             <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-3 rounded-bl-none flex items-center gap-2 text-xs text-mystery-400">
               <Sparkles className="w-3 h-3 animate-spin" /> Analyzing map vector data...
             </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-mystery-800 border-t border-mystery-700">
        <div className="relative">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="Ask about patterns on the map..."
            className="w-full bg-mystery-900 border border-mystery-600 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white focus:ring-1 focus:ring-mystery-500 outline-none"
          />
          <button 
            onClick={handleAsk}
            disabled={!query.trim() || isThinking}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-mystery-400 hover:text-white disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
