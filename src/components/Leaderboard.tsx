
import React, { useEffect, useState } from 'react';
import { Trophy, Star, Shield, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface InvestigatorProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  reputation: number;
  role: string;
  investigator_status?: string;
  cases_solved: number;
  success_rate: number;
}

export const Leaderboard: React.FC = () => {
  const [investigators, setInvestigators] = useState<InvestigatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvestigators();
  }, []);

  const fetchInvestigators = async () => {
    try {
      // Fetch approved investigators with their profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'investigator')
        .eq('investigator_status', 'approved');

      if (profileError) throw profileError;

      // Fetch reputation data for each investigator
      const investigatorIds = profiles?.map(p => p.id) || [];
      const { data: reputationData, error: repError } = await supabase
        .from('reputation')
        .select('user_id, total_points, cases_resolved')
        .in('user_id', investigatorIds);

      if (repError) {
        console.error('Reputation fetch error:', repError);
      }

      // Combine profile and reputation data
      const combined = profiles?.map(profile => {
        const rep = reputationData?.find(r => r.user_id === profile.id);
        const casesSolved = rep?.cases_resolved || 0;
        const reputation = rep?.total_points || 0;
        
        return {
          ...profile,
          reputation,
          cases_solved: casesSolved,
          success_rate: casesSolved > 0 ? 100 : 0 // Can be calculated from resolved vs disputed
        };
      }) || [];

      // Sort by reputation
      combined.sort((a, b) => b.reputation - a.reputation);

      setInvestigators(combined);
    } catch (error) {
      console.error('Error fetching investigators:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center text-gray-400">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4 flex justify-center items-center gap-3">
          <Trophy className="text-yellow-400 w-10 h-10" /> Top Investigators
        </h1>
        <p className="text-xl text-gray-400">
          Recognizing the dedication and expertise of our top researchers.
        </p>
      </div>

      <div className="bg-mystery-800 rounded-xl border border-mystery-700 overflow-hidden shadow-2xl">
        {/* Desktop Header - Hidden on mobile */}
        <div className="hidden md:grid grid-cols-12 bg-mystery-900 p-4 border-b border-mystery-700 text-sm font-bold text-gray-400 uppercase tracking-wider">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-5">Investigator</div>
          <div className="col-span-2 text-center">Reputation</div>
          <div className="col-span-2 text-center">Cases Solved</div>
          <div className="col-span-2 text-center">Badges</div>
        </div>

        {investigators.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No investigators found yet. Be the first to become an investigator!
          </div>
        ) : (
          investigators.map((inv, index) => (
          <div key={inv.id} className="border-b border-mystery-700 hover:bg-mystery-700/30 transition-colors">
            {/* Mobile Layout */}
            <div className="md:hidden p-4 space-y-3">
              <div className="flex items-start gap-3">
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                  {index === 0 ? (
                    <div className="w-10 h-10 rounded-full bg-yellow-500 text-black flex items-center justify-center font-bold text-lg">1</div>
                  ) : index === 1 ? (
                    <div className="w-10 h-10 rounded-full bg-gray-400 text-black flex items-center justify-center font-bold text-lg">2</div>
                  ) : index === 2 ? (
                    <div className="w-10 h-10 rounded-full bg-orange-700 text-white flex items-center justify-center font-bold text-lg">3</div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-mystery-700 text-gray-400 flex items-center justify-center font-bold">#{index + 1}</div>
                  )}
                </div>

                {/* Profile Info */}
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => navigate(`/profile/${inv.username}`)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <img 
                      src={inv.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(inv.full_name || inv.username)}&background=1e293b&color=fff`} 
                      className="w-12 h-12 rounded-full border-2 border-mystery-600" 
                      alt={inv.full_name || inv.username}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-base truncate">{inv.full_name || inv.username}</span>
                        {inv.investigator_status === 'approved' && <Shield className="w-4 h-4 text-blue-400 fill-blue-400/20 flex-shrink-0" />}
                      </div>
                      <span className="text-xs text-mystery-400">
                        {inv.cases_solved} {inv.cases_solved === 1 ? 'case' : 'cases'} solved
                      </span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-700">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="font-bold text-sm">{inv.reputation}</span>
                    </div>
                    
                    {/* Badges */}
                    <div className="flex gap-1">
                      {inv.cases_solved >= 10 && (
                        <div title="Expert - 10+ cases" className="p-1 bg-mystery-900 rounded border border-yellow-600 text-yellow-400">
                          <Award className="w-4 h-4" />
                        </div>
                      )}
                      {inv.cases_solved >= 25 && (
                        <div title="Master - 25+ cases" className="p-1 bg-mystery-900 rounded border border-blue-600 text-blue-400">
                          <Trophy className="w-4 h-4" />
                        </div>
                      )}
                      {inv.reputation >= 500 && (
                        <div title="Legend - 500+ reputation" className="p-1 bg-mystery-900 rounded border border-purple-600 text-purple-400">
                          <Star className="w-4 h-4 fill-current" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:grid grid-cols-12 p-4 items-center">
              <div className="col-span-1 flex justify-center">
                {index === 0 ? (
                  <div className="w-8 h-8 rounded-full bg-yellow-500 text-black flex items-center justify-center font-bold">1</div>
                ) : index === 1 ? (
                  <div className="w-8 h-8 rounded-full bg-gray-400 text-black flex items-center justify-center font-bold">2</div>
                ) : index === 2 ? (
                  <div className="w-8 h-8 rounded-full bg-orange-700 text-white flex items-center justify-center font-bold">3</div>
                ) : (
                  <span className="text-gray-500 font-bold text-lg">#{index + 1}</span>
                )}
              </div>
              
              <div 
                className="col-span-5 flex items-center gap-4 cursor-pointer hover:bg-mystery-600/20 rounded-lg p-2 -m-2 transition-colors"
                onClick={() => navigate(`/profile/${inv.username}`)}
              >
                <img 
                  src={inv.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(inv.full_name || inv.username)}&background=1e293b&color=fff`} 
                  className="w-12 h-12 rounded-full border-2 border-mystery-600" 
                  alt={inv.full_name || inv.username}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-lg hover:text-blue-400 transition-colors">{inv.full_name || inv.username}</span>
                    {inv.investigator_status === 'approved' && <Shield className="w-4 h-4 text-blue-400 fill-blue-400/20" />}
                  </div>
                  <span className="text-xs text-mystery-400">
                    {inv.cases_solved} {inv.cases_solved === 1 ? 'case' : 'cases'} solved
                  </span>
                </div>
              </div>

              <div className="col-span-2 text-center">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-700">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-bold">{inv.reputation}</span>
                </div>
              </div>

              <div className="col-span-2 text-center">
                <span className="text-white font-bold text-lg">{inv.cases_solved}</span>
              </div>

                <div className="col-span-2 flex justify-center gap-1">
                {inv.cases_solved >= 10 && (
                  <div title="Expert - 10+ cases" className="p-1.5 bg-mystery-900 rounded border border-yellow-600 text-yellow-400 hover:text-yellow-300 hover:border-yellow-400 transition-colors cursor-help">
                    <Award className="w-4 h-4" />
                  </div>
                )}
                {inv.cases_solved >= 25 && (
                  <div title="Master - 25+ cases" className="p-1.5 bg-mystery-900 rounded border border-blue-600 text-blue-400 hover:text-blue-300 hover:border-blue-400 transition-colors cursor-help">
                    <Trophy className="w-4 h-4" />
                  </div>
                )}
                {inv.reputation >= 500 && (
                  <div title="Legend - 500+ reputation" className="p-1.5 bg-mystery-900 rounded border border-purple-600 text-purple-400 hover:text-purple-300 hover:border-purple-400 transition-colors cursor-help">
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )))}
      </div>
    </div>
  );
};
