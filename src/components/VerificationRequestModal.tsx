import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Upload, FileText, Clock, X, CheckCircle } from 'lucide-react';

interface VerificationRequestModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const VerificationRequestModal: React.FC<VerificationRequestModalProps> = ({ userId, isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [check, setCheck] = useState<any>(null);
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    identity: null,
    credential: null,
    other: null
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchVerificationStatus = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('background_checks')
          .select('*')
          .eq('investigator_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          setCheck(data[0]);
        }
      } catch (err: any) {
        setError('Failed to load verification status.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVerificationStatus();
  }, [userId]);

  const handleFileChange = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const handleUpload = async () => {
    if (!check) {
      setError('No active verification request found.');
      return;
    }

    if (Object.values(files).every(f => f === null)) {
        setError('Please select at least one file to upload.');
        return;
    }
      
    setUploading(true);
    setError(null);
    setSuccess(null);

    const uploadedDocuments = [...(check.documents || [])];

    for (const type in files) {
      const file = files[type];
      if (file) {
        try {
          const filePath = `${userId}/${check.id}/${type}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('verification-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('verification-documents')
            .getPublicUrl(filePath);

          uploadedDocuments.push({
            type: type,
            url: urlData.publicUrl,
            fileName: file.name,
            uploadedAt: new Date().toISOString()
          });
        } catch (err: any) {
          setError(`Failed to upload ${file.name}: ${err.message}`);
          setUploading(false);
          return;
        }
      }
    }

    try {
        const { data, error: dbError } = await supabase
            .from('background_checks')
            .update({ documents: uploadedDocuments })
            .eq('id', check.id)
            .select();

        if (dbError) throw dbError;
        
        if (data) {
          setCheck(data[0]);
        }
        
        setSuccess('Documents uploaded successfully!');
        setFiles({ identity: null, credential: null, other: null });
        onSuccess();

    } catch (err: any) {
        setError(`Failed to update records: ${err.message}`);
    } finally {
        setUploading(false);
    }
  };
    
  if (!isOpen) {
    return null;
  }
    
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400"></div>
      </div>
    );
  }

  if (!check) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-8 w-full max-w-md text-white text-center" onClick={(e) => e.stopPropagation()}>
          <Shield className="w-16 h-16 text-mystery-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Verification Request Found</h2>
          <p className="text-gray-400">
            You have not requested a background check yet. Please purchase one from your dashboard.
          </p>
          <button onClick={onClose} className="mt-6 px-6 py-2 bg-mystery-600 hover:bg-mystery-500 rounded-lg font-medium">
            Close
          </button>
        </div>
      </div>
    );
  }

  const isPending = check.status === 'pending' || check.status === 'in_progress';
  const isCompleted = check.status === 'completed';
  const isFailed = check.status === 'failed';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 sm:p-8 w-full max-w-2xl text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="w-7 h-7 text-mystery-400" />
            Verification Status & Document Upload
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>

        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4">{error}</div>}
        {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-lg mb-4">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-mystery-900/50 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Status</p>
                <div className={`text-lg font-bold flex items-center gap-2 mt-1 ${
                    isCompleted ? 'text-green-400' : isFailed ? 'text-red-400' : 'text-yellow-400'
                }`}>
                    {isCompleted && <CheckCircle size={20} />}
                    {isFailed && <X size={20} />}
                    {isPending && <Clock size={20} />}
                    {check.status.replace('_', ' ').toUpperCase()}
                </div>
            </div>
            <div className="bg-mystery-900/50 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Check Type</p>
                <p className="text-lg font-bold">{check.check_type.toUpperCase()}</p>
            </div>
        </div>

        {isCompleted && (
            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg text-center mb-6">
                <h3 className="font-bold text-green-300 text-xl">Your verification is complete!</h3>
                <p className="text-green-400/80 mt-1">You now have a verified badge on your profile. No further action is needed.</p>
            </div>
        )}

        {isFailed && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg mb-6">
                <h3 className="font-bold text-red-300 text-xl">Verification Failed</h3>
                <p className="text-red-400/80 mt-1">
                    <span className="font-bold">Admin Note:</span> {check.review_notes || 'No specific reason provided.'}
                </p>
                <p className="text-gray-400 mt-2 text-sm">Please contact support if you have questions.</p>
            </div>
        )}

        {isPending && (
          <>
            <div className="bg-mystery-900/50 p-6 rounded-lg mb-6">
              <h3 className="font-bold text-lg mb-4">Upload Your Documents</h3>
              <p className="text-gray-400 text-sm mb-4">
                To complete your verification, please upload clear copies of the required documents. Ensure all information is visible.
              </p>
              <div className="space-y-4">
                {['identity', 'credential', 'other'].map(type => (
                  <div key={type}>
                    <label className="block text-sm font-medium text-gray-300 mb-2 capitalize">
                      {type} Document (e.g., ID card, license, certificate)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id={`file-${type}`}
                        className="hidden"
                        onChange={(e) => handleFileChange(type, e)}
                        accept="image/*,.pdf"
                      />
                      <label htmlFor={`file-${type}`} className="flex-1 px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg cursor-pointer text-center truncate">
                        {files[type]?.name || 'Choose File'}
                      </label>
                      {files[type] && <button onClick={() => setFiles(p => ({...p, [type]: null}))}><X className="text-red-500" size={20}/></button>}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="mt-6 w-full px-4 py-3 bg-mystery-600 hover:bg-mystery-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Upload />
                {uploading ? 'Uploading...' : 'Upload Selected Files'}
              </button>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-3">Submitted Documents</h3>
              {check.documents && check.documents.length > 0 ? (
                <div className="space-y-2">
                  {check.documents.map((doc: any, i: number) => (
                    <a
                      key={i}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-mystery-900/50 rounded-lg hover:bg-mystery-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-mystery-400" />
                        <span className="text-gray-300">{doc.fileName || `${doc.type} Document`}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No documents have been uploaded yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerificationRequestModal;