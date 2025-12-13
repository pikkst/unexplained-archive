import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { X, Mail, Lock, User, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [accountType, setAccountType] = useState<'USER' | 'INVESTIGATOR'>('USER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          // Check if email is not confirmed
          if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
            setError('Please verify your email first. Check your inbox for the confirmation link.');
          } else if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password');
          } else {
            setError(error.message || 'Login failed');
          }
        } else {
          onClose();
          // Navigate to dashboard after successful login
          navigate('/profile', { replace: true });
        }
      } else {
        if (!username.trim()) {
          setError('Username is required');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, username, accountType);
        if (error) {
          setError(error.message || 'Registration failed');
        } else {
          setError('');
          setEmail('');
          setPassword('');
          setUsername('');
          setAccountType('USER');
          const roleText = accountType === 'INVESTIGATOR' ? 'investigator' : 'user';
          alert(`✅ ${roleText.charAt(0).toUpperCase() + roleText.slice(1)} registration successful!\n\n📧 Check your email to verify your account before logging in.`);
          setMode('login');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-mystery-800 rounded-xl shadow-2xl w-full max-w-md border border-mystery-700 my-8 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-mystery-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'Welcome Back' : 'Join Unexplained Archive'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full bg-mystery-900 border border-mystery-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
                    placeholder="Choose a username"
                    required={mode === 'register'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccountType('USER')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      accountType === 'USER'
                        ? 'border-mystery-500 bg-mystery-500/20 text-white'
                        : 'border-mystery-700 bg-mystery-900 text-gray-400 hover:border-mystery-600'
                    }`}
                  >
                    <div className="text-center">
                      <User className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-semibold">Regular User</div>
                      <div className="text-xs mt-1 opacity-75">Submit & follow cases</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType('INVESTIGATOR')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      accountType === 'INVESTIGATOR'
                        ? 'border-mystery-500 bg-mystery-500/20 text-white'
                        : 'border-mystery-700 bg-mystery-900 text-gray-400 hover:border-mystery-600'
                    }`}
                  >
                    <div className="text-center">
                      <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <div className="font-semibold">Investigator</div>
                      <div className="text-xs mt-1 opacity-75">Solve cases & earn rewards</div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="w-full bg-mystery-900 border border-mystery-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="w-full bg-mystery-900 border border-mystery-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {mode === 'register' && (
              <p className="mt-1 text-xs text-gray-500">
                At least 6 characters
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-mystery-500 hover:bg-mystery-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div className="text-center text-sm text-gray-400">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className="text-mystery-400 hover:text-mystery-300 font-semibold"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="text-mystery-400 hover:text-mystery-300 font-semibold"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
