import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Case } from '../types';
import { useCases } from '../hooks/useCases';
import { Search, MapPin, Calendar, Filter, Eye, Map as MapIcon, List, Bot, Zap } from 'lucide-react';
import { CaseMap } from './CaseMap';
import { MapAnalysisAgent } from './MapAnalysisAgent';
import { boostService } from '../services/boostService';

export const ExploreCases: React.FC = () => {
  const navigate = useNavigate();
  const { cases, loading, error } = useCases();
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  const [showAgent, setShowAgent] = useState(false);
  const [boostedCases, setBoostedCases] = useState<any[]>([]);
  
  const [filter, setFilter] = useState({
    search: '',
    category: 'ALL',
    status: 'ALL'
  });

  // Load boosted cases
  useEffect(() => {
    loadBoostedCases();
  }, []);

  const loadBoostedCases = async () => {
    const boosted = await boostService.getActiveBoostedCases();
    setBoostedCases(boosted);
  };

  // Combine and sort cases: boosted first, then regular
  const sortedCases = () => {
    const boostedIds = new Set((boostedCases || []).map(b => b.case_id));
    const regularCases = (cases || []).filter(c => !boostedIds.has(c.id));
    const boostedCasesFull = (cases || []).filter(c => boostedIds.has(c.id));
    
    return [...boostedCasesFull, ...regularCases];
  };

  const filteredCases = sortedCases().filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(filter.search.toLowerCase()) || 
                          c.location.toLowerCase().includes(filter.search.toLowerCase());
    const matchesCategory = filter.category === 'ALL' || c.category === filter.category;
    const matchesStatus = filter.status === 'ALL' || 
                          (filter.status === 'RESOLVED' && c.status === 'RESOLVED') ||
                          (filter.status === 'OPEN' && (c.status === 'OPEN' || c.status === 'INVESTIGATING'));
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const isBoosted = (caseId: string) => {
    return boostedCases.some(b => b.case_id === caseId);
  };

  const handleCaseClick = async (caseId: string) => {
    // Track click if boosted
    if (isBoosted(caseId)) {
      await boostService.trackClick(caseId);
    }
    navigate(`/cases/${caseId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mystery-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading cases...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mystery-900">
        <div className="text-center p-8 bg-mystery-800 rounded-lg border border-mystery-700">
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Cases</h2>
          <p className="text-gray-400">{error.message || 'Failed to load cases'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header & Controls */}
      <div className="bg-mystery-900 p-4 border-b border-mystery-800 z-10">
         <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row gap-4 justify-between items-center">
           <div>
             <h1 className="text-2xl font-bold text-white">Explore the Archive</h1>
             <p className="text-gray-400 text-sm">Global incident tracker.</p>
           </div>
           
           <div className="flex items-center gap-2 bg-mystery-800 p-1 rounded-lg border border-mystery-700">
             <button 
               onClick={() => setViewMode('LIST')}
               className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${
                 viewMode === 'LIST' ? 'bg-mystery-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
               }`}
             >
               <List className="w-4 h-4" /> List
             </button>
             <button 
               onClick={() => setViewMode('MAP')}
               className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${
                 viewMode === 'MAP' ? 'bg-mystery-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
               }`}
             >
               <MapIcon className="w-4 h-4" /> Map
             </button>
           </div>
         </div>
         
         {/* Filters Bar */}
         <div className="max-w-7xl mx-auto w-full mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search phenomena, location..." 
                  value={filter.search}
                  onChange={(e) => setFilter({...filter, search: e.target.value})}
                  className="w-full bg-mystery-800 border border-mystery-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-mystery-500"
                />
             </div>
             <div>
               <select 
                  value={filter.category}
                  onChange={(e) => setFilter({...filter, category: e.target.value})}
                  className="w-full bg-mystery-800 border border-mystery-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-mystery-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="UFO">UFO</option>
                  <option value="CRYPTID">Cryptids</option>
                  <option value="PARANORMAL">Paranormal</option>
                  <option value="SUPERNATURAL">Supernatural</option>
                </select>
             </div>
             <div>
               <select 
                  value={filter.status}
                  onChange={(e) => setFilter({...filter, status: e.target.value})}
                  className="w-full bg-mystery-800 border border-mystery-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-mystery-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
             </div>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === 'MAP' ? (
          <>
            <CaseMap cases={filteredCases} onCaseClick={handleCaseClick} />
            
            {/* AI Agent Toggle (For Investigators - Simulated visibility) */}
            <div className="absolute bottom-6 right-6 z-[999]">
              {!showAgent ? (
                <button 
                  onClick={() => setShowAgent(true)}
                  className="w-14 h-14 bg-mystery-500 hover:bg-mystery-400 text-white rounded-full shadow-2xl shadow-mystery-500/50 flex items-center justify-center border-2 border-white/20 transition-transform hover:scale-110"
                  title="Open AI Analyst"
                >
                  <Bot className="w-8 h-8" />
                </button>
              ) : (
                <MapAnalysisAgent visibleCases={filteredCases} onClose={() => setShowAgent(false)} />
              )}
            </div>
          </>
        ) : (
          <div className="h-full overflow-y-auto p-4 sm:p-8 bg-mystery-900">
            {filteredCases.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <p className="text-xl">No cases found in the archive matching your criteria.</p>
                </div>
              ) : (
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                  {filteredCases.map(c => {
                    const boosted = isBoosted(c.id);
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => handleCaseClick(c.id)}
                        className={`bg-mystery-800 rounded-xl overflow-hidden border transition-all hover:shadow-2xl hover:-translate-y-1 cursor-pointer group ${
                          boosted 
                            ? 'border-yellow-500 ring-2 ring-yellow-500/30 shadow-lg shadow-yellow-500/20' 
                            : 'border-mystery-700 hover:border-mystery-500'
                        }`}
                      >
                        <div className="relative h-48 bg-gray-900">
                          <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          
                          {/* Boost Badge */}
                          {boosted && (
                            <div className="absolute top-2 left-2 px-3 py-1.5 bg-yellow-500 text-black rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg animate-pulse">
                              <Zap className="w-3.5 h-3.5 fill-current" />
                              Featured
                            </div>
                          )}
                          
                          <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs font-bold text-white uppercase tracking-wider">
                            {c.category}
                          </div>
                          <div className={`absolute ${boosted ? 'top-12' : 'top-2'} left-2 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                            c.status === 'RESOLVED' ? 'bg-green-600/90 text-white' : 
                            c.status === 'INVESTIGATING' ? 'bg-blue-600/90 text-white' : 'bg-yellow-600/90 text-white'
                          }`}>
                            {c.status}
                          </div>
                        </div>
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{c.title}</h3>
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2 h-10">{c.description}</p>
                        
                        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-mystery-700 text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" /> {c.location}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> {new Date(c.incidentDate).toLocaleDateString()}
                          </div>
                          {c.assignedInvestigator && (
                            <div className="flex items-center gap-2 mt-1 text-mystery-400">
                              <Eye className="w-3 h-3" /> Investigated by {c.assignedInvestigator.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
