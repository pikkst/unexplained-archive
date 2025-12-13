import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle } from 'lucide-react';

export function EmailVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Get token from URL hash (Supabase sends verification token in URL hash)
        const hash = window.location.hash;
        
        if (!hash || !hash.includes('access_token')) {
          // No token in hash, might be old style query params
          const token = searchParams.get('token');
          const type = searchParams.get('type');
          
          if (!token || type !== 'email') {
            setStatus('error');
            setMessage('Invalid or missing verification token.');
            setTimeout(() => navigate('/'), 3000);
            return;
          }
        }

        // Let Supabase handle the verification from the hash
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: hash.substring(1), // Remove the # character
          type: 'email_change' as any, // or 'signup' depending on email type
        });

        if (error) {
          // Try signup type if email_change failed
          const { data: signupData, error: signupError } = await supabase.auth.verifyOtp({
            token_hash: hash.substring(1),
            type: 'signup' as any,
          });

          if (signupError) {
            console.error('Verification error:', error);
            setStatus('error');
            setMessage('Email verification failed. The link may have expired. Please try signing up again.');
            setTimeout(() => navigate('/'), 3000);
            return;
          }
        }

        setStatus('success');
        setMessage('✅ Email verified successfully! Redirecting to login...');
        
        // Redirect to login or home after short delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } catch (err) {
        console.error('Verification error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    verifyEmail();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-mystery-900 flex items-center justify-center p-4">
      <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-8 max-w-md w-full">
        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Verifying Email</h2>
            <p className="text-gray-400">Please wait while we verify your email address...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Success!</h2>
            <p className="text-gray-400">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-gray-400">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 w-full bg-mystery-500 hover:bg-mystery-600 text-white font-semibold py-2 rounded-lg transition-colors"
            >
              Go Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
