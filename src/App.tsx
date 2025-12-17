import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserRole } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { UserProfile } from './components/UserProfile';
import { InvestigatorDashboard } from './components/InvestigatorDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SubmitCaseForm } from './components/SubmitCaseForm';
import { ExploreCases } from './components/ExploreCases';
import { CaseDetail } from './components/CaseDetail';
import { ArticleDetail } from './components/ArticleDetail';
import { DonationPage } from './components/DonationPage';
import Forum from './components/Forum';
import ThreadView from './components/ThreadView';
import { Leaderboard } from './components/Leaderboard';
import { CaseMap } from './components/CaseMap';
import { AboutUs, ContactUs, TermsAndConditions } from './components/StaticPages';
import { MapAnalysisAgent } from './components/MapAnalysisAgent';
import { Inbox } from './components/Inbox';
import { Wallet } from './components/Wallet';
import { InvestigatorSubscriptionPlans } from './components/InvestigatorSubscriptionPlans';
import { SubscriptionManagement } from './components/SubscriptionManagement';
import SubscriptionSuccess from './components/SubscriptionSuccess';
import PaymentSuccess from './components/PaymentSuccess';
import { useAnalyticsTracking } from './hooks/useAnalytics';
import { caseService } from './services/caseService';
import { supabase } from './lib/supabase';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole?: 'user' | 'investigator' | 'admin';
}) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mystery-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && profile?.role !== requiredRole && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mystery-900">
        <div className="text-center p-8 bg-mystery-800 rounded-lg border border-mystery-700">
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, profile } = useAuth();

  // Enable first-party analytics tracking for all route changes
  useAnalyticsTracking();

  return (
    <div className="min-h-screen bg-mystery-900 text-gray-100 font-sans selection:bg-mystery-500 selection:text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/explore" element={<ExploreCases />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="/articles/:slug" element={<ArticleDetail />} />
          <Route path="/map" element={
            <div className="w-full h-[calc(100vh-64px)] bg-mystery-900">
              <CaseMap />
            </div>
          } />
          <Route path="/map-analysis" element={<MapAnalysisAgent />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/forum/:id" element={<ThreadView />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/donate" element={<DonationPage />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/terms" element={<TermsAndConditions />} />

          {/* Subscription Routes */}
          <Route path="/subscription/plans" element={<InvestigatorSubscriptionPlans />} />
          <Route path="/subscription/success" element={<SubscriptionSuccess />} />
          <Route 
            path="/subscription" 
            element={
              <ProtectedRoute>
                <SubscriptionManagement />
              </ProtectedRoute>
            } 
          />

          {/* Payment Success Page - Universal confirmation for all payment types */}
          <Route path="/payment/success" element={<PaymentSuccess />} />

          {/* Public Profile Route */}
          <Route path="/profile/:username" element={<UserProfile />} />

          {/* Protected Routes - Authenticated Users */}
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/messages" 
            element={
              <ProtectedRoute>
                <Inbox />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/wallet" 
            element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/submit-case" 
            element={
              <ProtectedRoute>
                <SubmitCaseForm 
                  currentUser={{
                    id: user?.id || '',
                    name: profile?.full_name || profile?.username || 'Anonymous',
                    avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`,
                    bio: profile?.bio || '',
                    role: (profile?.role?.toUpperCase() || 'USER') as UserRole,
                    isVerified: profile?.is_verified || false,
                    specialization: profile?.specialization,
                    joinedDate: profile?.created_at || new Date().toISOString(),
                    walletBalance: 0,
                    reputationScore: 0,
                    badges: [],
                    completedCasesCount: 0
                  }} 
                  onSubmit={async (newCase) => {
                    try {
                      const reward = newCase.reward || 0;
                      const paymentMethod = (newCase as any).paymentMethod || 'wallet';
                      
                      // Validate payment if reward is set
                      if (reward > 0) {
                        if (paymentMethod === 'credits') {
                          // Check credits balance
                          const requiredCredits = reward * 10; // 1 credit = €0.10
                          const { data: profile } = await supabase
                            .from('profiles')
                            .select('credits')
                            .eq('id', user!.id)
                            .single();
                          
                          const availableCredits = profile?.credits || 0;
                          
                          if (availableCredits < requiredCredits) {
                            alert(`Insufficient credits. You need ${requiredCredits} credits but only have ${availableCredits}. Please redeem a promo code to get more credits!`);
                            return;
                          }
                        } else if (paymentMethod === 'wallet') {
                          // Check wallet balance
                          const { walletService } = await import('./services/walletService');
                          const balance = await walletService.getBalance(user!.id);
                          
                          if (balance < reward) {
                            alert(`Insufficient funds in wallet. You have €${balance.toFixed(2)}, but need €${reward.toFixed(2)}. Please add funds to your wallet first.`);
                            return;
                          }
                        }
                        // Stripe payment will be handled after case creation
                      }
                      
                      const caseData = {
                        user_id: user!.id,
                        title: newCase.title || 'Untitled Case',
                        description: newCase.description || '',
                        category: newCase.category || 'UFO',
                        date_occurred: newCase.incidentDate || new Date().toISOString(),
                        location: newCase.location || '',
                        latitude: newCase.coordinates?.lat || null,
                        longitude: newCase.coordinates?.lng || null,
                        media_urls: (newCase as any).mediaUrls || [],
                        ai_generated: newCase.isAiGenerated || false,
                        status: 'OPEN' as const,
                        investigator_id: null,
                        reward_amount: 0 // Will be updated after payment
                      };
                      
                      const createdCase = await caseService.createCase(caseData);
                      
                      // Process payment based on method
                      if (reward > 0 && createdCase) {
                        if (paymentMethod === 'credits') {
                          // Spend credits and add reward to case
                          const requiredCredits = reward * 10;
                          const { data: spendResult } = await supabase.rpc('spend_user_credits', {
                            p_user_id: user!.id,
                            p_amount: requiredCredits,
                            p_source: 'case_reward',
                            p_description: `Reward for case: ${createdCase.title}`,
                            p_case_id: createdCase.id
                          });
                          
                          if (!spendResult?.success) {
                            alert(`Case created, but credit payment failed: ${spendResult?.error}. You can add the reward later from the case page.`);
                          } else {
                            // Add the EUR equivalent to the case pool
                            const { walletService } = await import('./services/walletService');
                            await walletService.addRewardToCase(createdCase.id, reward);
                          }
                        } else if (paymentMethod === 'wallet') {
                          // Pay from wallet
                          const { walletService } = await import('./services/walletService');
                          const result = await walletService.donateToCase(user!.id, createdCase.id, reward);
                          
                          if (!result.success) {
                            console.error('Failed to process reward payment:', result.error);
                            alert(`Case created, but reward payment failed: ${result.error}. You can add the reward later from the case page.`);
                          }
                        } else if (paymentMethod === 'stripe') {
                          // Redirect to Stripe payment
                          const { data: session } = await supabase.functions.invoke('create-case-reward-payment', {
                            body: {
                              caseId: createdCase.id,
                              amount: reward,
                              userId: user!.id
                            }
                          });
                          
                          if (session?.url) {
                            // Redirect to Stripe checkout
                            window.location.href = session.url;
                            return; // Don't show success message yet
                          } else {
                            alert(`Case created, but payment setup failed. You can add the reward later from the case page.`);
                          }
                        }
                      }
                      
                      const paymentMethodText = paymentMethod === 'credits' ? `${reward * 10} credits` : `€${reward.toFixed(2)}`;
                      alert(reward > 0 ? `Case submitted successfully with ${paymentMethodText} reward!` : 'Case submitted successfully!');
                      window.location.href = '/explore';
                    } catch (error: any) {
                      console.error('Error submitting case:', error);
                      alert('Failed to submit case: ' + (error.message || 'Unknown error'));
                    }
                  }}
                  onCancel={() => window.history.back()}
                />
              </ProtectedRoute>
            } 
          />

          {/* Protected Routes - Investigators */}
          <Route 
            path="/investigator" 
            element={
              <ProtectedRoute requiredRole="investigator">
                <InvestigatorDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Protected Routes - Admins */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      <footer className="bg-mystery-900 border-t border-mystery-800 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-bold mb-4">Unexplained Archive</h4>
              <p className="text-gray-500 text-sm">Documenting the unknown, together.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/explore" className="hover:text-mystery-400">Explore Cases</Link></li>
                <li><Link to="/submit-case" className="hover:text-mystery-400">Submit a Case</Link></li>
                <li><Link to="/map" className="hover:text-mystery-400">Case Map</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/forum" className="hover:text-mystery-400">Forum</Link></li>
                <li><Link to="/leaderboard" className="hover:text-mystery-400">Leaderboard</Link></li>
                <li><Link to="/donate" className="hover:text-mystery-400">Donate</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/terms" className="hover:text-mystery-400">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-mystery-400">Terms of Service</Link></li>
                <li><Link to="/contact" className="hover:text-mystery-400">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-gray-600 text-sm border-t border-mystery-800 pt-8">
            <p>© 2024 Unexplained Archive. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router basename="/unexplained-archive/">
          <AppContent />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
