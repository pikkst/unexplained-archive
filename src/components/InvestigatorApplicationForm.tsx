import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Award, FileText, Plus, X, CheckCircle, Upload, Save } from 'lucide-react';

interface Certification {
  name: string;
  issuer: string;
  year: string;
  url?: string;
}

interface InvestigatorApplicationFormProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InvestigatorApplicationForm({ userId, onSuccess, onCancel }: InvestigatorApplicationFormProps) {
  const [motivation, setMotivation] = useState('');
  const [expertise, setExpertise] = useState<string[]>(['']);
  const [experience, setExperience] = useState('');
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('identity');
  const [showCertForm, setShowCertForm] = useState(false);
  const [newCert, setNewCert] = useState<Certification>({ name: '', issuer: '', year: '', url: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Fetch existing application data on mount
    const fetchApplication = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('investigator_applications')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setMotivation(data.motivation || '');
          setExpertise(data.expertise || ['']);
          setExperience(data.experience || '');
          setCertifications(data.certifications || []);
          setDocuments(data.documents || []);
        }
      } catch (err: any) {
        console.error('Error fetching application data:', err);
        setError('Could not load your application data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchApplication();
  }, [userId]);

  const expertiseOptions = [
    'UFO/UAP Phenomena',
    'Cryptozoology',
    'Paranormal Investigation',
    'Forensic Analysis',
    'Geospatial Analysis',
    'Historical Research',
    'Scientific Analysis',
    'Photography/Videography Analysis',
    'Witness Interview Techniques',
    'Data Analysis'
  ];

  const addExpertiseField = () => {
    setExpertise([...expertise, '']);
  };

  const updateExpertise = (index: number, value: string) => {
    const updated = [...expertise];
    updated[index] = value;
    setExpertise(updated);
  };

  const removeExpertise = (index: number) => {
    setExpertise(expertise.filter((_, i) => i !== index));
  };

  const addCertification = () => {
    if (!newCert.name || !newCert.issuer || !newCert.year) {
      setError('Please fill in all required certification fields');
      return;
    }
    setCertifications([...certifications, newCert]);
    setNewCert({ name: '', issuer: '', year: '', url: '' });
    setShowCertForm(false);
  };

  const removeCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  const handleFileUpload = async () => {
    if (!fileToUpload) {
      setError('Please select a file to upload.');
      return;
    }
    setIsUploading(true);
    setError('');
    try {
      const filePath = `${userId}/application/${documentType}-${fileToUpload.name}`;
      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, fileToUpload);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath);

      const newDocument = {
        type: documentType,
        url: urlData.publicUrl,
        fileName: fileToUpload.name,
        uploadedAt: new Date().toISOString()
      };
      
      setDocuments([...documents, newDocument]);
      setFileToUpload(null);
    } catch (err: any) {
      setError(`Failed to upload file: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };
  
  const handleSaveOrSubmit = async (isDraft: boolean) => {
    setError('');
    const validExpertise = expertise.filter(e => e.trim() !== '');

    if (!isDraft) {
        if (validExpertise.length === 0) {
            setError('Please select at least one area of expertise');
            return;
        }
        if (motivation.length < 100) {
            setError('Please write at least 100 characters explaining your motivation');
            return;
        }
    }

    setLoading(true);
    
    try {
        const { data, error: rpcError } = await supabase.rpc('submit_investigator_application', {
            application_data: {
                user_id: userId,
                motivation: motivation,
                expertise: validExpertise,
                experience: experience || null,
                certifications: certifications.length > 0 ? certifications : [],
                documents: documents,
                status: isDraft ? 'draft' : 'pending'
            }
        });

        if (rpcError) throw rpcError;
        if (data && !data.success) {
            throw new Error(data.error || 'Failed to save application');
        }

        if (isDraft) {
            alert('✅ Application progress saved!');
        } else {
            alert('✅ Application submitted successfully! You will be notified once reviewed.');
            onSuccess();
        }
    } catch (err: any) {
        console.error('Error saving application:', err);
        setError(err.message || 'Failed to save application');
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveOrSubmit(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-mystery-800 rounded-xl shadow-2xl w-full max-w-3xl border border-mystery-700 my-8">
        <div className="flex justify-between items-center p-6 border-b border-mystery-700">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-mystery-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Become an Investigator</h2>
              <p className="text-sm text-gray-400">Submit your application for admin review</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Motivation */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Why do you want to become an investigator? *
            </label>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none min-h-[150px]"
              placeholder="Explain your motivation, background, and what makes you qualified to investigate unexplained phenomena..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">{motivation.length}/100 characters minimum</p>
          </div>

          {/* Areas of Expertise */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Areas of Expertise *
            </label>
            {expertise.map((exp, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <select
                  value={exp}
                  onChange={(e) => updateExpertise(index, e.target.value)}
                  className="flex-1 bg-mystery-900 border border-mystery-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
                  required
                >
                  <option value="">Select an area...</option>
                  {expertiseOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {expertise.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExpertise(index)}
                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addExpertiseField}
              className="text-mystery-400 hover:text-mystery-300 text-sm flex items-center gap-1 mt-2"
            >
              <Plus className="w-4 h-4" /> Add another area
            </button>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Previous Experience (Optional)
            </label>
            <textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
              placeholder="Describe any relevant experience, education, or training..."
              rows={4}
            />
          </div>

          {/* Certifications */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Award className="w-4 h-4 inline mr-2" />
              Certifications (Optional)
            </label>
            
            {certifications.length > 0 && (
              <div className="space-y-2 mb-3">
                {certifications.map((cert, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-mystery-900 rounded-lg border border-mystery-700">
                    <div>
                      <div className="font-semibold text-white">{cert.name}</div>
                      <div className="text-sm text-gray-400">{cert.issuer} • {cert.year}</div>
                      {cert.url && (
                        <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-xs text-mystery-400 hover:underline">
                          View Certificate
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCertification(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showCertForm ? (
              <div className="p-4 bg-mystery-900 rounded-lg border border-mystery-700 space-y-3">
                <input
                  type="text"
                  value={newCert.name}
                  onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                  placeholder="Certification Name *"
                  className="w-full bg-mystery-800 border border-mystery-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
                />
                <input
                  type="text"
                  value={newCert.issuer}
                  onChange={(e) => setNewCert({ ...newCert, issuer: e.target.value })}
                  placeholder="Issuing Organization *"
                  className="w-full bg-mystery-800 border border-mystery-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
                />
                <input
                  type="text"
                  value={newCert.year}
                  onChange={(e) => setNewCert({ ...newCert, year: e.target.value })}
                  placeholder="Year *"
                  className="w-full bg-mystery-800 border border-mystery-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
                />
                <input
                  type="url"
                  value={newCert.url}
                  onChange={(e) => setNewCert({ ...newCert, url: e.target.value })}
                  placeholder="Certificate URL (optional)"
                  className="w-full bg-mystery-800 border border-mystery-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addCertification}
                    className="px-4 py-2 bg-mystery-500 text-white rounded-lg hover:bg-mystery-600"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCertForm(false);
                      setNewCert({ name: '', issuer: '', year: '', url: '' });
                    }}
                    className="px-4 py-2 bg-mystery-700 text-white rounded-lg hover:bg-mystery-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCertForm(true)}
                className="text-mystery-400 hover:text-mystery-300 text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Certification
              </button>
            )}
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Upload className="w-4 h-4 inline mr-2" />
              Identity Verification Documents (Optional but Recommended)
            </label>
            <p className="text-xs text-gray-400 mb-3">Please upload a government-issued ID to verify your identity. This helps build trust and is required for higher-level verification.</p>
            
            {documents.length > 0 && (
                <div className="space-y-2 mb-3">
                    {documents.map((doc, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-mystery-900 rounded-lg border border-mystery-700">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-mystery-400"/>
                                <span className="text-sm text-gray-300">{doc.fileName} ({doc.type})</span>
                            </div>
                            <button type="button" onClick={() => removeDocument(index)} className="text-red-400 hover:text-red-300"><X size={16}/></button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2 items-center p-3 bg-mystery-900/50 rounded-lg">
                <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="bg-mystery-800 border border-mystery-700 rounded-lg px-3 py-2 text-white">
                    <option value="identity">Identity</option>
                    <option value="credential">Credential</option>
                    <option value="other">Other</option>
                </select>
                <input type="file" id="file-upload" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} className="flex-1 text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-mystery-700 file:text-white hover:file:bg-mystery-600"/>
                <button type="button" onClick={handleFileUpload} disabled={isUploading || !fileToUpload} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-mystery-700">
            <button type="button" onClick={() => handleSaveOrSubmit(true)} disabled={loading} className="px-6 py-3 bg-mystery-700 text-white rounded-lg hover:bg-mystery-600 font-semibold flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />
                Save as Draft
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-mystery-500 text-white rounded-lg hover:bg-mystery-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? 'Submitting...' : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Submit Application
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
