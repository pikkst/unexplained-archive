
import React, { useState, useEffect } from 'react';
import { Case, User, InvestigatorLogEntry, CaseDocument } from '../types';
import { 
  FolderOpen, FileText, Image as ImageIcon, PenTool, ClipboardCheck, 
  Download, Upload, Plus, Clock, MapPin, User as UserIcon, 
  Sparkles, Save, ArrowLeft, Paperclip, Search, Shield
} from 'lucide-react';
import { caseService } from '../services/caseService';

interface CaseFolderProps {
  caseData: Case;
  currentUser: User;
  onUpdateCase: (updatedCase: Case) => void;
  onBack: () => void;
}

export const CaseFolder: React.FC<CaseFolderProps> = ({ caseData: rawCaseData, currentUser, onUpdateCase, onBack }) => {
  // Transform snake_case to camelCase if needed
  const caseData = React.useMemo(() => {
    const data = rawCaseData as any;
    return {
      ...rawCaseData,
      investigationLog: data.investigationLog || data.investigation_log || [],
      resolutionProposal: data.resolutionProposal || data.resolution_proposal || '',
      documents: data.documents || [],
      investigatorNotes: data.investigatorNotes || data.investigator_notes || ''
    };
  }, [rawCaseData]);

  const [activeTab, setActiveTab] = useState<'INTAKE' | 'EVIDENCE' | 'JOURNAL' | 'DOCS' | 'REPORT'>('INTAKE');
  const [newLogNote, setNewLogNote] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Local state for editing the report before saving
  const [reportText, setReportText] = useState(caseData.resolutionProposal || '');

  // Sync reportText when caseData changes (e.g., after refresh)
  useEffect(() => {
    setReportText(caseData.resolutionProposal || '');
  }, [caseData.resolutionProposal]);

  // Add a log entry - UPDATED to save to database
  const handleAddLog = async () => {
    if (!newLogNote.trim()) return;
    
    const newEntry: InvestigatorLogEntry = {
      id: `l-${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: newLogNote,
      type: 'NOTE'
    };

    const updatedLog = [newEntry, ...(caseData.investigationLog || [])];

    try {
      setIsSaving(true);
      // Save to database and get updated data
      const updated = await caseService.updateCase(caseData.id, {
        investigation_log: updatedLog as any
      });

      // Use the fresh data from database
      onUpdateCase(updated);
      setNewLogNote('');
    } catch (error) {
      console.error('Failed to add log entry:', error);
      alert('Failed to add note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Upload a document - UPDATED to save to database
  const handleUploadDoc = async () => {
    const newDoc: CaseDocument = {
      id: `d-${Date.now()}`,
      name: `Analysis_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`,
      type: 'PDF',
      url: '#',
      uploadedAt: new Date().toISOString(),
      addedBy: 'INVESTIGATOR'
    };
    
    const updatedDocs = [newDoc, ...(caseData.documents || [])];

    try {
      setIsSaving(true);
      // Save to database and get updated data
      const updated = await caseService.updateCase(caseData.id, {
        documents: updatedDocs as any
      });

      // Use the fresh data from database
      onUpdateCase(updated);
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert('Failed to add document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // AI Report Generator Logic
  const handleAiGenerateReport = () => {
    setIsGeneratingReport(true);
    setTimeout(() => {
      const logs = caseData.investigationLog?.map(l => l.content).join('\n') || '';
      
      const generatedReport = `OFFICIAL INVESTIGATION REPORT\nCASE ID: ${caseData.id.toUpperCase()}\n----------------------------\n\nINCIDENT SUMMARY:\n${caseData.description}\n\nINVESTIGATIVE FINDINGS:\nBased on field notes and evidence analysis:\n${logs}\n\nGEOSPATIAL ANALYSIS:\nIncident occurred at ${caseData.location}. Environmental factors analyzed: Negative for seismic activity.\n\nCONCLUSION:\nThe evidence suggests this case is ${caseData.status === 'RESOLVED' ? 'concluded' : 'anomalous requiring further peer review'}. The initial witness testimony aligns with recorded data points.`;
      
      setReportText(generatedReport);
      setIsGeneratingReport(false);
    }, 2000);
  };

  const handleSaveReport = async () => {
    try {
      setIsSaving(true);
      // Save to database and get updated data
      const updated = await caseService.updateCase(caseData.id, {
        resolution_proposal: reportText as any
      });

      // Use fresh data from database
      onUpdateCase(updated);
      alert("Report saved to case file. ✅");
    } catch (error) {
      console.error('Failed to save report:', error);
      alert('Failed to save report. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitResolution = async () => {
    try {
      setIsSaving(true);
      // Save to database with status change and get updated data
      const updated = await caseService.updateCase(caseData.id, {
        status: 'PENDING_REVIEW' as any,
        resolution_proposal: reportText as any
      });

      // Use fresh data from database
      onUpdateCase(updated);
      alert("Resolution submitted for user review! User will now receive a notification. 📧");
    } catch (error) {
      console.error('Failed to submit resolution:', error);
      alert('Failed to submit resolution. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-mystery-800 p-4 rounded-t-xl border-b-4 border-mystery-500 shadow-xl">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-mystery-700 rounded-lg text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-mystery-accent" />
              <h1 className="text-2xl font-mono font-bold text-white tracking-widest uppercase">
                CASE FILE #{caseData.id.toUpperCase()}
              </h1>
            </div>
            <div className="flex gap-4 text-xs font-mono text-gray-400 mt-1">
               <span>CLASSIFICATION: {caseData.category.toUpperCase()}</span>
               <span>•</span>
               <span>STATUS: {caseData.status}</span>
               <span>•</span>
               <span className="text-green-400">ASSIGNED TO: {currentUser.name.toUpperCase()}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <button className="px-4 py-2 bg-mystery-900 border border-mystery-600 hover:border-mystery-400 text-gray-300 rounded font-mono text-sm flex items-center gap-2">
             <Download className="w-4 h-4" /> EXPORT DOSSIER
           </button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-mystery-800 rounded-xl border border-mystery-700 flex flex-col p-2 space-y-1">
          <button 
            onClick={() => setActiveTab('INTAKE')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'INTAKE' ? 'bg-mystery-600 text-white shadow-md' : 'text-gray-400 hover:bg-mystery-700 hover:text-white'}`}
          >
            <ClipboardCheck className="w-4 h-4" /> Intake Data
          </button>
          <button 
            onClick={() => setActiveTab('EVIDENCE')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'EVIDENCE' ? 'bg-mystery-600 text-white shadow-md' : 'text-gray-400 hover:bg-mystery-700 hover:text-white'}`}
          >
            <ImageIcon className="w-4 h-4" /> Evidence Locker
          </button>
          <button 
            onClick={() => setActiveTab('JOURNAL')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'JOURNAL' ? 'bg-mystery-600 text-white shadow-md' : 'text-gray-400 hover:bg-mystery-700 hover:text-white'}`}
          >
            <PenTool className="w-4 h-4" /> Field Journal
          </button>
           <button 
            onClick={() => setActiveTab('DOCS')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'DOCS' ? 'bg-mystery-600 text-white shadow-md' : 'text-gray-400 hover:bg-mystery-700 hover:text-white'}`}
          >
            <FileText className="w-4 h-4" /> Documents
          </button>
          <div className="flex-1"></div>
          <button 
            onClick={() => setActiveTab('REPORT')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'REPORT' ? 'bg-gradient-to-r from-green-700 to-green-600 text-white shadow-md' : 'bg-mystery-900 text-green-500 border border-green-900/50 hover:bg-mystery-700'}`}
          >
            <Shield className="w-4 h-4" /> Final Report
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-mystery-800 rounded-xl border border-mystery-700 overflow-hidden flex flex-col">
          
          {/* INTAKE TAB */}
          {activeTab === 'INTAKE' && (
            <div className="p-8 overflow-y-auto custom-scrollbar h-full">
              <h2 className="text-xl font-bold text-white mb-6 pb-2 border-b border-mystery-600 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-mystery-accent" /> Subject & Incident Intake
              </h2>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-mystery-900 p-4 rounded border border-mystery-700">
                    <label className="text-xs font-mono text-gray-500 block mb-1">SUBJECT NAME</label>
                    <div className="text-white font-medium">{caseData.submittedBy.name}</div>
                  </div>
                   <div className="bg-mystery-900 p-4 rounded border border-mystery-700">
                    <label className="text-xs font-mono text-gray-500 block mb-1">INCIDENT DATE</label>
                    <div className="text-white font-medium">{new Date(caseData.incidentDate).toLocaleString()}</div>
                  </div>
                   <div className="bg-mystery-900 p-4 rounded border border-mystery-700">
                    <label className="text-xs font-mono text-gray-500 block mb-1">LOCATION VECTOR</label>
                    <div className="text-white font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-500" />
                      {caseData.location}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-mystery-900 p-4 rounded border border-mystery-700 h-full">
                    <label className="text-xs font-mono text-gray-500 block mb-1">INITIAL STATEMENT</label>
                    <p className="text-gray-300 text-sm leading-relaxed">{caseData.description}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-mystery-900 p-4 rounded border border-mystery-700">
                <label className="text-xs font-mono text-gray-500 block mb-1">DETAILED REPORT</label>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {caseData.detailedDescription || "No detailed report provided."}
                </p>
              </div>
            </div>
          )}

          {/* EVIDENCE TAB */}
          {activeTab === 'EVIDENCE' && (
            <div className="p-8 overflow-y-auto h-full">
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-mystery-600">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-mystery-accent" /> Evidence Locker
                </h2>
                <button className="px-3 py-1.5 bg-mystery-700 hover:bg-mystery-600 rounded text-xs text-white border border-mystery-500 flex items-center gap-2">
                  <Upload className="w-3 h-3" /> Upload Media
                </button>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {/* Main Evidence */}
                <div className="col-span-1 group relative rounded-lg overflow-hidden border border-mystery-600 hover:border-mystery-accent transition-colors">
                  <img src={caseData.imageUrl} className="w-full h-48 object-cover" />
                  <div className="p-3 bg-mystery-900">
                    <p className="text-xs font-mono text-gray-400">EXHIBIT A: PRIMARY VISUAL</p>
                    <p className="text-sm text-white truncate">{caseData.title}</p>
                  </div>
                  {caseData.isAiGeneratedImage && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 text-[10px] text-mystery-accent border border-mystery-accent rounded">AI GEN</div>
                  )}
                </div>

                {/* Placeholders for demo */}
                <div className="col-span-1 border-2 border-dashed border-mystery-700 rounded-lg flex flex-col items-center justify-center h-full min-h-[200px] text-gray-500 hover:text-gray-300 hover:border-mystery-500 cursor-pointer transition-colors">
                  <Plus className="w-8 h-8 mb-2" />
                  <span className="text-sm font-mono">ADD EVIDENCE</span>
                </div>
              </div>
            </div>
          )}

          {/* JOURNAL TAB */}
          {activeTab === 'JOURNAL' && (
            <div className="flex flex-col h-full">
               <div className="p-6 border-b border-mystery-700">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-mystery-accent" /> Investigator's Log
                </h2>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {caseData.investigationLog && caseData.investigationLog.length > 0 ? (
                   caseData.investigationLog.map(log => (
                     <div key={log.id} className="flex gap-4 group">
                       <div className="flex flex-col items-center">
                         <div className="w-2 h-2 rounded-full bg-mystery-500 mt-2"></div>
                         <div className="w-px h-full bg-mystery-700 group-last:bg-transparent my-1"></div>
                       </div>
                       <div className="flex-1 bg-mystery-900 p-4 rounded-lg border border-mystery-700">
                         <div className="flex justify-between mb-2">
                           <span className="text-xs font-mono text-mystery-400">{new Date(log.timestamp).toLocaleString()}</span>
                           <span className="text-[10px] uppercase font-bold text-gray-500 bg-black/30 px-2 py-0.5 rounded">{log.type}</span>
                         </div>
                         <p className="text-gray-300 text-sm">{log.content}</p>
                       </div>
                     </div>
                   ))
                 ) : (
                   <p className="text-gray-500 text-center italic mt-10">No entries in field journal.</p>
                 )}
               </div>

               <div className="p-4 bg-mystery-900 border-t border-mystery-700">
                 <div className="relative">
                   <textarea
                     value={newLogNote}
                     onChange={(e) => setNewLogNote(e.target.value)}
                     placeholder="Enter field notes..."
                     className="w-full bg-mystery-800 border border-mystery-600 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-mystery-500 outline-none pr-12 resize-none"
                     rows={2}
                     onKeyDown={(e) => {
                       if(e.key === 'Enter' && !e.shiftKey) {
                         e.preventDefault();
                         handleAddLog();
                       }
                     }}
                   />
                   <button 
                     onClick={handleAddLog}
                     disabled={isSaving}
                     className="absolute right-2 top-2 p-2 bg-mystery-600 hover:bg-mystery-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                   </button>
                 </div>
               </div>
            </div>
          )}

          {/* DOCUMENTS TAB */}
           {activeTab === 'DOCS' && (
            <div className="p-8 overflow-y-auto h-full">
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-mystery-600">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-mystery-accent" /> Documents & Files
                </h2>
                <button 
                  onClick={handleUploadDoc}
                  className="px-3 py-1.5 bg-mystery-700 hover:bg-mystery-600 rounded text-xs text-white border border-mystery-500 flex items-center gap-2"
                >
                  <Upload className="w-3 h-3" /> Add Document
                </button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-12 text-xs font-mono text-gray-500 px-4 mb-2">
                  <div className="col-span-6">FILENAME</div>
                  <div className="col-span-2">TYPE</div>
                  <div className="col-span-3">DATE ADDED</div>
                  <div className="col-span-1"></div>
                </div>
                
                {caseData.documents && caseData.documents.map(doc => (
                  <div key={doc.id} className="grid grid-cols-12 items-center bg-mystery-900 p-3 rounded border border-mystery-700 hover:border-mystery-500 transition-colors cursor-pointer">
                     <div className="col-span-6 flex items-center gap-2 text-white text-sm font-medium">
                        <Paperclip className="w-4 h-4 text-gray-500" />
                        {doc.name}
                     </div>
                     <div className="col-span-2">
                        <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-300">{doc.type}</span>
                     </div>
                     <div className="col-span-3 text-xs text-gray-400 font-mono">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                     </div>
                     <div className="col-span-1 flex justify-end">
                       <button className="text-mystery-400 hover:text-white"><Download className="w-4 h-4" /></button>
                     </div>
                  </div>
                ))}
                {(!caseData.documents || caseData.documents.length === 0) && (
                  <div className="text-center py-8 text-gray-500 border border-dashed border-mystery-700 rounded">
                    No documents attached to this case file.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REPORT TAB */}
          {activeTab === 'REPORT' && (
            <div className="flex flex-col h-full bg-mystery-900/50">
               <div className="p-6 border-b border-mystery-700 flex justify-between items-center">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-400" /> Final Report & Resolution
                </h2>
                 <button 
                    onClick={handleAiGenerateReport}
                    disabled={isGeneratingReport}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Sparkles className={`w-3 h-3 ${isGeneratingReport ? 'animate-spin' : ''}`} />
                    {isGeneratingReport ? 'AI Generating...' : 'Generate AI Report'}
                  </button>
               </div>

               <div className="flex-1 p-6">
                 <div className="bg-black/40 p-1 rounded-t-lg border border-mystery-600 border-b-0 w-32 text-center text-xs font-mono text-gray-400">
                   EDITOR
                 </div>
                 <textarea
                   value={reportText}
                   onChange={(e) => setReportText(e.target.value)}
                   className="w-full h-full bg-mystery-900 border border-mystery-600 rounded-b-lg rounded-tr-lg p-6 text-gray-300 font-mono text-sm leading-relaxed focus:ring-1 focus:ring-green-500 outline-none resize-none"
                   placeholder="Compile investigation findings here..."
                 />
               </div>

               <div className="p-6 border-t border-mystery-700 flex justify-end gap-4 bg-mystery-800">
                  <button 
                    onClick={handleSaveReport}
                    disabled={isSaving}
                    className="px-6 py-3 bg-transparent border border-gray-600 hover:border-gray-400 text-gray-300 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button 
                    onClick={handleSubmitResolution}
                    disabled={isSaving}
                    className="px-6 py-3 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-green-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                    {isSaving ? 'Submitting...' : 'Submit Resolution'}
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
