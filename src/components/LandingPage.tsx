import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, Shield, Users, Activity, FileText, Star, Map as MapIcon, TrendingUp, Award, MessageCircle, Zap, Facebook } from 'lucide-react';
import { useCases } from '../hooks/useCases';
import { CaseMap } from './CaseMap';
import { supabase } from '../lib/supabase';
import { boostService } from '../services/boostService';

export const LandingPage: React.FC = () => {
  const { cases, loading } = useCases({ limit: 10 });
  const [boostedCases, setBoostedCases] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCases: 0,
    totalInvestigators: 0,
    totalCountries: 0,
    totalUsers: 0
  });

  // Load boosted cases for featured section
  useEffect(() => {
    loadBoostedCases();
  }, []);

  const loadBoostedCases = async () => {
    const boosted = await boostService.getActiveBoostedCases();
    setBoostedCases(boosted.slice(0, 3)); // Show top 3 boosted cases
  };

  // Use boosted cases as featured, fallback to regular cases
  const featuredCases = boostedCases.length > 0 
    ? (cases || []).filter(c => boostedCases.some(b => b.case_id === c.id)).slice(0, 3)
    : (cases || []).slice(0, 3);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get total cases
        const { count: casesCount } = await supabase
          .from('cases')
          .select('*', { count: 'exact', head: true });

        // Get total investigators
        const { count: investigatorsCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'investigator');

        // Get unique countries from cases
        const { data: countries } = await supabase
          .from('cases')
          .select('location');
        const uniqueCountries = new Set(countries?.map(c => c.location.split(',').pop()?.trim()));

        // Get total users
        const { count: usersCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        setStats({
          totalCases: casesCount || 0,
          totalInvestigators: investigatorsCount || 0,
          totalCountries: uniqueCountries.size || 0,
          totalUsers: usersCount || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-mystery-900 overflow-hidden">
        <div className="absolute inset-0">
          <img
            className="w-full h-full object-cover opacity-20"
            src="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920"
            alt="Mystery Background"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-mystery-900 via-mystery-900/80 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight mb-6">
            Share the <span className="text-transparent bg-clip-text bg-gradient-to-r from-mystery-400 to-mystery-accent">Unknown</span>.
            <br />
            Discover the <span className="text-transparent bg-clip-text bg-gradient-to-r from-mystery-400 to-mystery-accent">Truth</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-xl text-gray-300">
            A global platform to document, investigate, and explore unexplained phenomena. From UFO sightings to paranormal encounters, share your experience and connect with verified investigators.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/explore"
              className="bg-mystery-500 hover:bg-mystery-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors shadow-lg shadow-mystery-500/30 flex items-center gap-2"
            >
              Explore Cases <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/submit-case"
              className="bg-mystery-800 hover:bg-mystery-700 border border-mystery-500 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors flex items-center gap-2"
            >
              <FileText className="w-5 h-5" /> Submit Your Case
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-16 bg-mystery-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Our platform combines community-driven reporting with professional investigation to document unexplained phenomena.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-mystery-800 p-6 rounded-lg border border-mystery-700 hover:border-mystery-500 transition-colors">
              <div className="w-12 h-12 bg-mystery-500/20 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-mystery-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Share Your Story</h3>
              <p className="text-gray-400">
                Document your encounter with photos, videos, or AI-generated illustrations. Every detail matters.
              </p>
            </div>

            <div className="bg-mystery-800 p-6 rounded-lg border border-mystery-700 hover:border-mystery-500 transition-colors">
              <div className="w-12 h-12 bg-mystery-500/20 rounded-lg flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-mystery-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Expert Investigation</h3>
              <p className="text-gray-400">
                Verified investigators can claim cases, conduct research, and share findings with the community.
              </p>
            </div>

            <div className="bg-mystery-800 p-6 rounded-lg border border-mystery-700 hover:border-mystery-500 transition-colors">
              <div className="w-12 h-12 bg-mystery-500/20 rounded-lg flex items-center justify-center mb-4">
                <MapIcon className="w-6 h-6 text-mystery-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Global Map</h3>
              <p className="text-gray-400">
                Explore sightings worldwide on an interactive map. Discover patterns and hotspots of activity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="py-16 bg-mystery-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-mystery-400 mb-2">{stats.totalCases.toLocaleString()}</div>
              <div className="text-gray-400">Cases Documented</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-mystery-400 mb-2">{stats.totalInvestigators}</div>
              <div className="text-gray-400">Active Investigators</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-mystery-400 mb-2">{stats.totalCountries}</div>
              <div className="text-gray-400">Countries</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-mystery-400 mb-2">{stats.totalUsers >= 1000 ? `${(stats.totalUsers / 1000).toFixed(1)}k` : stats.totalUsers}</div>
              <div className="text-gray-400">Community Members</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-16 bg-mystery-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Document the Unknown?
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Join our community of truth-seekers, researchers, and witnesses.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/submit-case"
              className="bg-mystery-500 hover:bg-mystery-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors shadow-lg shadow-mystery-500/30"
            >
              Submit a Case
            </Link>
            <Link
              to="/about"
              className="bg-mystery-800 hover:bg-mystery-700 border border-mystery-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* Featured Cases */}
      <div className="py-16 bg-mystery-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Featured Cases</h2>
              <p className="text-gray-400">Explore the latest unexplained phenomena</p>
            </div>
            <Link
              to="/explore"
              className="text-mystery-400 hover:text-mystery-300 flex items-center gap-2 font-medium"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading cases...</p>
            </div>
          ) : featuredCases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredCases.map((caseItem: any) => {
                const isBoosted = boostedCases.some(b => b.case_id === caseItem.id);
                return (
                  <Link
                    key={caseItem.id}
                    to={`/cases/${caseItem.id}`}
                    className={`bg-mystery-800 rounded-lg border transition-all overflow-hidden group ${
                      isBoosted 
                        ? 'border-yellow-500 ring-2 ring-yellow-500/30 shadow-lg shadow-yellow-500/20' 
                        : 'border-mystery-700 hover:border-mystery-500'
                    }`}
                  >
                    <div className="relative h-48 overflow-hidden">
                      {caseItem.media_urls && caseItem.media_urls.length > 0 ? (
                        <img
                          src={caseItem.media_urls[0]}
                          alt={caseItem.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-mystery-900 flex items-center justify-center">
                          <MapIcon className="w-16 h-16 text-gray-600" />
                        </div>
                      )}
                      
                      {/* Boost Badge */}
                      {isBoosted && (
                        <div className="absolute top-2 left-2 px-3 py-1.5 bg-yellow-500 text-black rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          Featured
                        </div>
                      )}
                      
                      <div className={`absolute top-2 ${isBoosted ? 'right-2' : 'right-2'} bg-mystery-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-mystery-400`}>
                        {caseItem.category}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-white mb-2 group-hover:text-mystery-400 transition-colors">
                        {caseItem.title}
                      </h3>
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                        {caseItem.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{caseItem.location}</span>
                        <span className={`px-2 py-1 rounded-full ${
                          caseItem.status === 'investigating' ? 'bg-blue-500/20 text-blue-400' :
                          caseItem.status === 'closed' ? 'bg-green-500/20 text-green-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {caseItem.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">No cases yet. Be the first to document the unknown!</p>
              <Link
                to="/submit-case"
                className="inline-block bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Submit First Case
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Map Preview */}
      <div className="py-16 bg-mystery-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Global Phenomenon Map</h2>
            <p className="text-gray-400">Explore unexplained events from around the world</p>
          </div>
          <div className="bg-mystery-800 rounded-lg border border-mystery-700 overflow-hidden" style={{ height: '500px' }}>
            <CaseMap />
          </div>
          <div className="text-center mt-6">
            <Link
              to="/map"
              className="inline-flex items-center gap-2 bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              <MapIcon className="w-5 h-5" />
              Explore Full Map
            </Link>
          </div>
        </div>
      </div>

      {/* Community Forum Teaser */}
      <div className="py-16 bg-mystery-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Join the Discussion</h2>
            <p className="text-gray-400">Connect with investigators and researchers worldwide</p>
          </div>
          <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-12 text-center">
            <MessageCircle className="w-16 h-16 text-mystery-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Community Forum</h3>
            <p className="text-gray-400 mb-6">Share theories, ask questions, and collaborate on investigations</p>
            <Link
              to="/forum"
              className="inline-flex items-center gap-2 bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Visit Forum <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>



      {/* Platform Stats */}
      <div className="py-16 bg-mystery-800/50 border-t border-mystery-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-2">By the Numbers</h2>
            <p className="text-gray-400">Growing community of researchers and witnesses</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-mystery-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-mystery-400" />
              </div>
              <div className="text-4xl font-bold text-mystery-400 mb-2">{stats.totalCases.toLocaleString()}</div>
              <div className="text-gray-400">Cases Documented</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-mystery-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-mystery-400" />
              </div>
              <div className="text-4xl font-bold text-mystery-400 mb-2">{stats.totalInvestigators.toLocaleString()}</div>
              <div className="text-gray-400">Verified Investigators</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-mystery-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapIcon className="w-8 h-8 text-mystery-400" />
              </div>
              <div className="text-4xl font-bold text-mystery-400 mb-2">{stats.totalCountries.toLocaleString()}</div>
              <div className="text-gray-400">Countries</div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-mystery-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-mystery-400" />
              </div>
              <div className="text-4xl font-bold text-mystery-400 mb-2">{stats.totalUsers >= 1000 ? `${(stats.totalUsers / 1000).toFixed(1)}k+` : `${stats.totalUsers.toLocaleString()}+`}</div>
              <div className="text-gray-400">Community Members</div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-20 bg-gradient-to-b from-mystery-900 to-mystery-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Be Part of Something <span className="text-mystery-400">Bigger</span>
          </h2>
          <p className="text-gray-300 mb-8 text-xl">
            Whether you're a witness, researcher, or simply curious about the unexplained — there's a place for you here.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/submit-case"
              className="bg-mystery-500 hover:bg-mystery-600 text-white px-10 py-4 rounded-lg text-lg font-bold transition-all transform hover:scale-105 shadow-xl shadow-mystery-500/30 flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Share Your Experience
            </Link>
            <Link
              to="/investigator"
              className="bg-mystery-800 hover:bg-mystery-700 border-2 border-mystery-500 text-white px-10 py-4 rounded-lg text-lg font-bold transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Become an Investigator
            </Link>
          </div>
        </div>
      </div>

      {/* Footer with Discord */}
      <footer className="bg-mystery-950 border-t border-mystery-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* About */}
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Unexplained Archive</h3>
              <p className="text-gray-400 text-sm">
                A global platform for documenting and investigating unexplained phenomena. Join our community of truth seekers.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link to="/explore" className="block text-gray-400 hover:text-mystery-400 text-sm transition-colors">Explore Cases</Link>
                <Link to="/about" className="block text-gray-400 hover:text-mystery-400 text-sm transition-colors">About Us</Link>
                <Link to="/contact" className="block text-gray-400 hover:text-mystery-400 text-sm transition-colors">Contact</Link>
                <Link to="/terms" className="block text-gray-400 hover:text-mystery-400 text-sm transition-colors">Terms & Conditions</Link>
              </div>
            </div>

            {/* Community */}
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Join Our Community</h3>
              <p className="text-gray-400 text-sm mb-4">
                Connect with investigators and discuss mysterious cases
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://discord.gg/YDbn9mhB"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Discord</span>
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61585330192918"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
                >
                  <Facebook className="w-5 h-5" />
                  <span>Facebook</span>
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-mystery-800 text-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} Unexplained Archive. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
