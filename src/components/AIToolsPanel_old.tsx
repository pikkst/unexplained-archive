import React, { useState } from 'react';
import { Sparkles, FileSearch, Scan, FileText, Clock, Shield, X, Loader } from 'lucide-react';
import { aiToolsService, type ImageAnalysisResult, type TextAnalysisResult } from '../services/aiToolsService';

interface AIToolsPanelProps {
  caseId: string;
  caseData: {
    title: string;
    description: string;
    media_url?: string;
  };
  onClose: () => void;
}

export const AIToolsPanel: React.FC<AIToolsPanelProps> = ({ caseId, caseData, onClose }) => {
  const [activeToolView, setActiveTool] = useState<'menu' | 'image' | 'text' | 'similar' | 'report' | 'timeline' | 'verify'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Results state
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [textAnalysis, setTextAnalysis] = useState<TextAnalysisResult | null>(null);
  const [similarCases, setSimilarCases] = useState<any[]>([]);
  const [report, setReport] = useState<string>('');
  const [timeline, setTimeline] = useState<Array<{ time: string; event: string }>>([]);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const runImageAnalysis = async () => {
    if (!caseData.media_url) {
      setError('No image available for analysis');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await aiToolsService.analyzeImage(caseData.media_url, caseData.description);
      setImageAnalysis(result);
      setActiveTool('image');
    } catch (err: any) {
      setError(err.message || 'Image analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const runTextAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await aiToolsService.analyzeText(caseData.description, 'case');
      setTextAnalysis(result);
      setActiveTool('text');
    } catch (err: any) {
      setError(err.message || 'Text analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const findSimilar = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await aiToolsService.findSimilarCases(caseId, 5);
      setSimilarCases(result);
      setActiveTool('similar');
    } catch (err: any) {
      setError(err.message || 'Similar cases search failed');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await aiToolsService.generateReport(caseId);
      setReport(result);
      setActiveTool('report');
    } catch (err: any) {
      setError(err.message || 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  const extractTimeline = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await aiToolsService.extractTimeline(caseId);
      setTimeline(result);
      setActiveTool('timeline');
    } catch (err: any) {
      setError(err.message || 'Timeline extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyImage = async () => {
    if (!caseData.media_url) {
      setError('No image available for verification');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await aiToolsService.verifyImageAuthenticity(caseData.media_url);
      setVerificationResult(result);
      setActiveTool('verify');
    } catch (err: any) {
      setError(err.message || 'Image verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-mystery-800 rounded-2xl border border-mystery-600 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-mystery-700">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-mystery-400" />
            <div>
              <h2 className="text-xl font-bold text-white">AI Investigation Tools</h2>
              <p className="text-sm text-gray-400">{caseData.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <Loader className="w-12 h-12 text-mystery-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Processing with AI...</p>
            </div>
          )}

          {!loading && activeToolView === 'menu' && (
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={runImageAnalysis}
                disabled={!caseData.media_url}
                className="p-6 bg-mystery-700 hover:bg-mystery-600 rounded-xl border border-mystery-600 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Scan className="w-8 h-8 text-mystery-400 mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Image Analysis</h3>
                <p className="text-sm text-gray-400">Detect objects, anomalies, and assess image quality using AI vision</p>
              </button>

              <button
                onClick={runTextAnalysis}
                className="p-6 bg-mystery-700 hover:bg-mystery-600 rounded-xl border border-mystery-600 text-left transition-colors"
              >
                <FileSearch className="w-8 h-8 text-mystery-400 mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Text Analysis</h3>
                <p className="text-sm text-gray-400">Extract keywords, entities, and sentiment from case description</p>
              </button>

              <button
                onClick={findSimilar}
                className="p-6 bg-mystery-700 hover:bg-mystery-600 rounded-xl border border-mystery-600 text-left transition-colors"
              >
                <FileText className="w-8 h-8 text-mystery-400 mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Similar Cases</h3>
                <p className="text-sm text-gray-400">Find related cases with similar characteristics</p>
              </button>

              <button
                onClick={extractTimeline}
                className="p-6 bg-mystery-700 hover:bg-mystery-600 rounded-xl border border-mystery-600 text-left transition-colors"
              >
                <Clock className="w-8 h-8 text-mystery-400 mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Timeline Extraction</h3>
                <p className="text-sm text-gray-400">Automatically extract chronological events from text</p>
              </button>

              <button
                onClick={verifyImage}
                disabled={!caseData.media_url}
                className="p-6 bg-mystery-700 hover:bg-mystery-600 rounded-xl border border-mystery-600 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Shield className="w-8 h-8 text-mystery-400 mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Verify Authenticity</h3>
                <p className="text-sm text-gray-400">Check image for signs of manipulation or forgery</p>
              </button>

              <button
                onClick={generateReport}
                className="p-6 bg-mystery-700 hover:bg-mystery-600 rounded-xl border border-mystery-600 text-left transition-colors"
              >
                <FileText className="w-8 h-8 text-mystery-400 mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Generate Report</h3>
                <p className="text-sm text-gray-400">Create professional investigative report with AI</p>
              </button>
            </div>
          )}

          {/* Image Analysis Results */}
          {!loading && activeToolView === 'image' && imageAnalysis && (
            <div className="space-y-6">
              <button onClick={() => setActiveTool('menu')} className="text-mystery-400 hover:text-mystery-300 text-sm">
                ← Back to Tools
              </button>
              
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Image Analysis Results</h3>
                
                <div className="bg-mystery-700 p-4 rounded-lg mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400">Confidence Score</span>
                    <span className="text-2xl font-bold text-white">{imageAnalysis.confidence}%</span>
                  </div>
                  <div className="w-full bg-mystery-900 rounded-full h-2">
                    <div className="bg-mystery-400 h-2 rounded-full" style={{ width: `${imageAnalysis.confidence}%` }}></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-mystery-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">Detected Objects</h4>
                    <div className="flex flex-wrap gap-2">
                      {imageAnalysis.detectedObjects.map((obj, idx) => (
                        <span key={idx} className="px-3 py-1 bg-mystery-600 text-white rounded-full text-sm">
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>

                  {imageAnalysis.anomalies.length > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-yellow-400 mb-2">⚠️ Anomalies Detected</h4>
                      <ul className="list-disc list-inside text-yellow-200 text-sm space-y-1">
                        {imageAnalysis.anomalies.map((anomaly, idx) => (
                          <li key={idx}>{anomaly}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-mystery-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">Key Findings</h4>
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {imageAnalysis.keyFindings.map((finding, idx) => (
                        <li key={idx}>{finding}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-mystery-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">AI Analysis</h4>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{imageAnalysis.analysis}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Text Analysis Results */}
          {!loading && activeToolView === 'text' && textAnalysis && (
            <div className="space-y-6">
              <button onClick={() => setActiveTool('menu')} className="text-mystery-400 hover:text-mystery-300 text-sm">
                ← Back to Tools
              </button>
              
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Text Analysis Results</h3>
                
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-mystery-700 p-4 rounded-lg">
                    <span className="text-gray-400 text-sm">Sentiment</span>
                    <p className="text-2xl font-bold text-white capitalize">{textAnalysis.sentiment}</p>
                  </div>
                  <div className="bg-mystery-700 p-4 rounded-lg">
                    <span className="text-gray-400 text-sm">Confidence</span>
                    <p className="text-2xl font-bold text-white">{textAnalysis.confidence}%</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-mystery-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {textAnalysis.keywords.map((keyword, idx) => (
                        <span key={idx} className="px-3 py-1 bg-mystery-500 text-white rounded-full text-sm">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-mystery-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">Entities (People, Places, Times)</h4>
                    <div className="flex flex-wrap gap-2">
                      {textAnalysis.entities.map((entity, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/50">
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-mystery-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">Suggested Actions</h4>
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {textAnalysis.suggestedActions.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Similar Cases */}
          {!loading && activeToolView === 'similar' && (
            <div className="space-y-4">
              <button onClick={() => setActiveTool('menu')} className="text-mystery-400 hover:text-mystery-300 text-sm">
                ← Back to Tools
              </button>
              
              <h3 className="text-lg font-bold text-white">Similar Cases ({similarCases.length})</h3>
              
              {similarCases.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No similar cases found</p>
              ) : (
                <div className="space-y-3">
                  {similarCases.map(c => (
                    <div key={c.id} className="bg-mystery-700 p-4 rounded-lg border border-mystery-600">
                      <h4 className="font-semibold text-white">{c.title}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <span className="px-2 py-1 bg-mystery-600 rounded">{c.category}</span>
                        <span>{c.status}</span>
                        <span>{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Report */}
          {!loading && activeToolView === 'report' && report && (
            <div className="space-y-4">
              <button onClick={() => setActiveTool('menu')} className="text-mystery-400 hover:text-mystery-300 text-sm">
                ← Back to Tools
              </button>
              
              <div className="bg-mystery-700 p-6 rounded-lg">
                <h3 className="text-lg font-bold text-white mb-4">Investigation Report</h3>
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-300 text-sm font-sans">{report}</pre>
                </div>
                <button className="mt-4 px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg text-sm">
                  Download Report
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          {!loading && activeToolView === 'timeline' && (
            <div className="space-y-4">
              <button onClick={() => setActiveTool('menu')} className="text-mystery-400 hover:text-mystery-300 text-sm">
                ← Back to Tools
              </button>
              
              <h3 className="text-lg font-bold text-white">Event Timeline</h3>
              
              <div className="space-y-3">
                {timeline.map((event, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-mystery-400 rounded-full"></div>
                      {idx < timeline.length - 1 && <div className="w-0.5 flex-1 bg-mystery-600 my-1"></div>}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm text-mystery-400">{event.time}</p>
                      <p className="text-white">{event.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Results */}
          {!loading && activeToolView === 'verify' && verificationResult && (
            <div className="space-y-6">
              <button onClick={() => setActiveTool('menu')} className="text-mystery-400 hover:text-mystery-300 text-sm">
                ← Back to Tools
              </button>
              
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Image Authenticity Verification</h3>
                
                <div className={`p-6 rounded-lg border-2 mb-6 ${
                  verificationResult.authentic 
                    ? 'bg-green-500/10 border-green-500/50' 
                    : 'bg-red-500/10 border-red-500/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">
                      {verificationResult.authentic ? '✓ Likely Authentic' : '⚠️ Potential Issues Detected'}
                    </span>
                    <span className="text-2xl font-bold text-white">{verificationResult.confidence}%</span>
                  </div>
                </div>

                {verificationResult.issues.length > 0 && (
                  <div className="bg-mystery-700 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-white mb-2">Issues Found</h4>
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {verificationResult.issues.map((issue: string, idx: number) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-mystery-700 p-4 rounded-lg">
                  <h4 className="font-semibold text-white mb-2">Detailed Analysis</h4>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{verificationResult.analysis}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
