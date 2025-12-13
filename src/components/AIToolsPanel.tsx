import React, { useState, useEffect } from 'react';
import { 
  Sparkles, FileSearch, Scan, FileText, Clock, Shield, X, Loader, 
  MapPin, Users, HelpCircle, GitCompare, Eye, AlertTriangle, Zap 
} from 'lucide-react';
import { aiToolsService } from '../services/aiToolsService';
import { subscriptionService } from '../services/investigatorSubscriptionService';
import { useAuth } from '../contexts/AuthContext';

interface AIToolsPanelProps {
  caseId: string;
  caseData: {
    title: string;
    description: string;
    media_url?: string;
    location?: string;
  };
  onClose: () => void;
}

type ToolView = 
  | 'menu'
  | 'image'
  | 'text'
  | 'similar'
  | 'report'
  | 'timeline'
  | 'verify'
  | 'ocr'
  | 'location'
  | 'consistency'
  | 'patterns'
  | 'questions';

export const AIToolsPanel: React.FC<AIToolsPanelProps> = ({ caseId, caseData, onClose }) => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<ToolView>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<any>(null);
  const [credits, setCredits] = useState<any>(null);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    if (user) {
      loadCredits();
    }
  }, [user]);

  const loadCredits = async () => {
    if (!user) return;
    
    const [creditsData, hasActive] = await Promise.all([
      subscriptionService.getUserCredits(user.id),
      subscriptionService.hasActiveSubscription(user.id),
    ]);
    
    setCredits(creditsData);
    setHasSubscription(hasActive);
  };

  const checkAndDeductCredits = async (toolName: string): Promise<boolean> => {
    if (!user) {
      setError('Please sign in to use AI tools');
      return false;
    }

    const creditCost = subscriptionService.getToolCreditCost(toolName);
    const check = await subscriptionService.checkCredits(user.id, creditCost);

    if (!check.hasCredits) {
      setError(check.reason || 'Insufficient credits');
      return false;
    }

    return true;
  };

  const runTool = async (toolName: string, toolView: ToolView, fn: () => Promise<any>) => {
    // Check credits first
    const hasCredits = await checkAndDeductCredits(toolName);
    if (!hasCredits) {
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);
    try {
      const result = await fn();
      setResults(result);
      setActiveView(toolView);
      
      // Reload credits after successful use
      await loadCredits();
    } catch (err: any) {
      setError(err.message || `${toolName} failed`);
      console.error(`${toolName} error:`, err);
    } finally {
      setLoading(false);
    }
  };

  const tools = [
    {
      id: 'image',
      name: 'Image Analysis',
      description: 'Deep forensic analysis of visual evidence - objects, anomalies, lighting, quality',
      icon: Scan,
      disabled: !caseData.media_url,
      action: () => runTool(
        'Image Analysis',
        'image',
        () => aiToolsService.analyzeImage(caseData.media_url!, caseData.description)
      )
    },
    {
      id: 'text',
      name: 'Text Analysis',
      description: 'Extract keywords, entities, sentiment, and credibility indicators from testimony',
      icon: FileSearch,
      disabled: false,
      action: () => runTool(
        'Text Analysis',
        'text',
        () => aiToolsService.analyzeText(caseData.description, 'case')
      )
    },
    {
      id: 'ocr',
      name: 'Extract Text (OCR)',
      description: 'Read text from images - signs, documents, license plates, timestamps',
      icon: Eye,
      disabled: !caseData.media_url,
      action: () => runTool(
        'OCR Extraction',
        'ocr',
        () => aiToolsService.extractTextFromImage(caseData.media_url!)
      )
    },
    {
      id: 'verify',
      name: 'Verify Authenticity',
      description: 'Forensic image verification - detect manipulation, artifacts, inconsistencies',
      icon: Shield,
      disabled: !caseData.media_url,
      action: () => runTool(
        'Image Verification',
        'verify',
        () => aiToolsService.verifyImageAuthenticity(caseData.media_url!)
      )
    },
    {
      id: 'consistency',
      name: 'Witness Consistency Check',
      description: 'Analyze contradictions and corroboration across multiple witness statements',
      icon: Users,
      disabled: false,
      action: () => runTool(
        'Consistency Check',
        'consistency',
        () => aiToolsService.verifyWitnessConsistency(caseId)
      )
    },
    {
      id: 'location',
      name: 'Location Analysis',
      description: 'Geographic context - terrain, weather, visibility, environmental factors',
      icon: MapPin,
      disabled: !caseData.location && !caseData.latitude && !caseData.longitude,
      action: () => runTool(
        'Location Analysis',
        'location',
        () => aiToolsService.analyzeLocation(
          caseData.location || `${caseData.latitude}, ${caseData.longitude}`, 
          caseData.description,
          caseData.latitude,
          caseData.longitude
        )
      )
    },
    {
      id: 'timeline',
      name: 'Timeline Extraction',
      description: 'Extract and organize chronological events from case description and comments',
      icon: Clock,
      disabled: false,
      action: () => runTool(
        'Timeline Extraction',
        'timeline',
        () => aiToolsService.extractTimeline(caseId)
      )
    },
    {
      id: 'patterns',
      name: 'Pattern Analysis',
      description: 'Identify recurring patterns, geographic clusters, and similarities with other cases',
      icon: GitCompare,
      disabled: false,
      action: () => runTool(
        'Pattern Analysis',
        'patterns',
        () => aiToolsService.analyzeCasePatterns(caseId)
      )
    },
    {
      id: 'questions',
      name: 'Investigation Questions',
      description: 'AI-generated questions and action items to advance the investigation',
      icon: HelpCircle,
      disabled: false,
      action: () => runTool(
        'Question Generation',
        'questions',
        () => aiToolsService.suggestInvestigativeQuestions(caseId)
      )
    },
    {
      id: 'similar',
      name: 'Find Similar Cases',
      description: 'Search for cases with similar characteristics and patterns',
      icon: FileText,
      disabled: false,
      action: () => runTool(
        'Similar Cases',
        'similar',
        () => aiToolsService.findSimilarCases(caseId, 8)
      )
    },
    {
      id: 'report',
      name: 'Generate Report',
      description: 'Create comprehensive investigative report with all case data and analysis',
      icon: FileText,
      disabled: false,
      action: () => runTool(
        'Report Generation',
        'report',
        () => aiToolsService.generateReport(caseId)
      )
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-mystery-800 rounded-2xl border border-mystery-600 max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-mystery-700 bg-gradient-to-r from-mystery-800 to-mystery-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mystery-400/20 rounded-lg">
              <Sparkles className="w-6 h-6 text-mystery-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Investigation Tools</h2>
              <p className="text-sm text-gray-400">{caseData.title}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Credits Display */}
            {credits && hasSubscription && (
              <div className="flex items-center gap-2 bg-mystery-700 px-4 py-2 rounded-lg">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-white font-semibold">
                  {credits.credits_total === 9999999 
                    ? '∞' 
                    : `${credits.credits_remaining}/${credits.credits_total}`}
                </span>
                <span className="text-gray-400 text-sm">krediiti</span>
              </div>
            )}
            
            {!hasSubscription && (
              <a
                href="/subscription/plans"
                className="bg-mystery-500 hover:bg-mystery-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              >
                Subscribe to Use
              </a>
            )}
            
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-mystery-700 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-400 mb-1">Error</h4>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-16">
              <Loader className="w-12 h-12 text-mystery-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400 font-medium">Processing with Gemini AI...</p>
              <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
            </div>
          )}

          {/* Tools Menu */}
          {!loading && activeView === 'menu' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-2">Professional Investigative Tools</h3>
                <p className="text-gray-400 text-sm">
                  Powered by Google Gemini AI - Select a tool to analyze evidence and advance your investigation
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={tool.action}
                      disabled={tool.disabled}
                      className={`p-5 rounded-xl border text-left transition-all ${
                        tool.disabled
                          ? 'bg-mystery-900/50 border-mystery-700 opacity-50 cursor-not-allowed'
                          : 'bg-mystery-700 border-mystery-600 hover:bg-mystery-600 hover:border-mystery-500 hover:shadow-lg hover:scale-[1.02]'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${tool.disabled ? 'bg-mystery-800' : 'bg-mystery-600'}`}>
                          <Icon className="w-6 h-6 text-mystery-400" />
                        </div>
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{tool.name}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">{tool.description}</p>
                      {tool.disabled && (
                        <p className="text-xs text-yellow-400 mt-2">⚠️ No data available</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results Views */}
          {!loading && activeView !== 'menu' && results && (
            <div className="space-y-6">
              <button 
                onClick={() => {
                  setActiveView('menu');
                  setResults(null);
                  setError('');
                }} 
                className="text-mystery-400 hover:text-mystery-300 text-sm font-medium flex items-center gap-2 hover:gap-3 transition-all"
              >
                ← Back to Tools
              </button>

              {/* Image Analysis Results */}
              {activeView === 'image' && (
                <ImageAnalysisView data={results} />
              )}

              {/* Text Analysis Results */}
              {activeView === 'text' && (
                <TextAnalysisView data={results} />
              )}

              {/* OCR Results */}
              {activeView === 'ocr' && (
                <OCRView data={results} />
              )}

              {/* Verification Results */}
              {activeView === 'verify' && (
                <VerificationView data={results} />
              )}

              {/* Consistency Results */}
              {activeView === 'consistency' && (
                <ConsistencyView data={results} />
              )}

              {/* Location Results */}
              {activeView === 'location' && (
                <LocationView data={results} />
              )}

              {/* Timeline Results */}
              {activeView === 'timeline' && (
                <TimelineView data={results} />
              )}

              {/* Pattern Results */}
              {activeView === 'patterns' && (
                <PatternsView data={results} />
              )}

              {/* Questions Results */}
              {activeView === 'questions' && (
                <QuestionsView data={results} />
              )}

              {/* Similar Cases */}
              {activeView === 'similar' && (
                <SimilarCasesView data={results} />
              )}

              {/* Report */}
              {activeView === 'report' && (
                <ReportView data={results} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Result View Components
const ImageAnalysisView: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <Scan className="w-6 h-6 text-mystery-400" />
      Image Analysis Results
    </h3>

    <div className="bg-mystery-700 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400">Analysis Confidence</span>
        <span className="text-3xl font-bold text-white">{data.confidence}%</span>
      </div>
      <div className="w-full bg-mystery-900 rounded-full h-3">
        <div 
          className="bg-gradient-to-r from-mystery-500 to-mystery-400 h-3 rounded-full transition-all duration-500" 
          style={{ width: `${data.confidence}%` }}
        ></div>
      </div>
    </div>

    {data.detectedObjects?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Detected Objects
        </h4>
        <div className="flex flex-wrap gap-2">
          {data.detectedObjects.map((obj: string, idx: number) => (
            <span key={idx} className="px-4 py-2 bg-mystery-600 text-white rounded-full text-sm font-medium">
              {obj}
            </span>
          ))}
        </div>
      </div>
    )}

    {data.anomalies?.length > 0 && (
      <div className="bg-yellow-500/10 border-2 border-yellow-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Anomalies Detected
        </h4>
        <ul className="space-y-2">
          {data.anomalies.map((anomaly: string, idx: number) => (
            <li key={idx} className="text-yellow-200 text-sm flex items-start gap-2">
              <span className="text-yellow-400 mt-1">•</span>
              <span>{anomaly}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {data.metadata && (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-mystery-700 p-4 rounded-lg">
          <span className="text-gray-400 text-sm">Lighting</span>
          <p className="text-white font-medium mt-1">{data.metadata.lighting}</p>
        </div>
        <div className="bg-mystery-700 p-4 rounded-lg">
          <span className="text-gray-400 text-sm">Quality</span>
          <p className="text-white font-medium mt-1">{data.metadata.quality}</p>
        </div>
        {data.metadata.estimatedTime && (
          <div className="bg-mystery-700 p-4 rounded-lg">
            <span className="text-gray-400 text-sm">Estimated Time</span>
            <p className="text-white font-medium mt-1">{data.metadata.estimatedTime}</p>
          </div>
        )}
        {data.metadata.weatherConditions && (
          <div className="bg-mystery-700 p-4 rounded-lg">
            <span className="text-gray-400 text-sm">Weather</span>
            <p className="text-white font-medium mt-1">{data.metadata.weatherConditions}</p>
          </div>
        )}
      </div>
    )}

    {data.keyFindings?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Key Findings</h4>
        <ul className="space-y-2">
          {data.keyFindings.map((finding: string, idx: number) => (
            <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
              <span className="text-mystery-400 mt-1 font-bold">{idx + 1}.</span>
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {data.suggestedActions?.length > 0 && (
      <div className="bg-blue-500/10 border border-blue-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-blue-400 mb-3">Suggested Actions</h4>
        <ul className="space-y-2">
          {data.suggestedActions.map((action: string, idx: number) => (
            <li key={idx} className="text-blue-200 text-sm flex items-start gap-2">
              <span className="text-blue-400">→</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {data.analysis && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Detailed Analysis</h4>
        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{data.analysis}</p>
      </div>
    )}
  </div>
);

const TextAnalysisView: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <FileSearch className="w-6 h-6 text-mystery-400" />
      Text Analysis Results
    </h3>

    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Sentiment</span>
        <p className="text-2xl font-bold text-white capitalize mt-2">{data.sentiment || 'neutral'}</p>
      </div>
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Credibility Score</span>
        <p className="text-2xl font-bold text-white mt-2">{data.credibilityScore || data.confidence}%</p>
      </div>
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Confidence</span>
        <p className="text-2xl font-bold text-white mt-2">{data.confidence}%</p>
      </div>
    </div>

    {data.keywords?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Keywords</h4>
        <div className="flex flex-wrap gap-2">
          {data.keywords.map((keyword: string, idx: number) => (
            <span key={idx} className="px-4 py-2 bg-mystery-500 text-white rounded-full text-sm font-medium">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    )}

    {data.entities && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-4">Identified Entities</h4>
        <div className="grid md:grid-cols-2 gap-4">
          {data.entities.people?.length > 0 && (
            <div>
              <span className="text-gray-400 text-sm">People</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.entities.people.map((person: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/50">
                    {person}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.entities.places?.length > 0 && (
            <div>
              <span className="text-gray-400 text-sm">Places</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.entities.places.map((place: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/50">
                    {place}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.entities.times?.length > 0 && (
            <div>
              <span className="text-gray-400 text-sm">Times</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.entities.times.map((time: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/50">
                    {time}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.entities.organizations?.length > 0 && (
            <div>
              <span className="text-gray-400 text-sm">Organizations</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.entities.organizations.map((org: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm border border-orange-500/50">
                    {org}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {data.inconsistencies?.length > 0 && (
      <div className="bg-yellow-500/10 border-2 border-yellow-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-yellow-400 mb-3">⚠️ Potential Inconsistencies</h4>
        <ul className="space-y-2">
          {data.inconsistencies.map((issue: string, idx: number) => (
            <li key={idx} className="text-yellow-200 text-sm">• {issue}</li>
          ))}
        </ul>
      </div>
    )}

    {data.analysis && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Analysis</h4>
        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{data.analysis}</p>
      </div>
    )}
  </div>
);

const OCRView: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <Eye className="w-6 h-6 text-mystery-400" />
      Text Extraction (OCR) Results
    </h3>

    <div className="bg-mystery-700 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400">Confidence</span>
        <span className="text-3xl font-bold text-white">{data.confidence}%</span>
      </div>
      <div className="w-full bg-mystery-900 rounded-full h-3">
        <div className="bg-mystery-400 h-3 rounded-full" style={{ width: `${data.confidence}%` }}></div>
      </div>
    </div>

    {data.extractedText?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Extracted Text</h4>
        <div className="space-y-2">
          {data.extractedText.map((text: string, idx: number) => (
            <div key={idx} className="bg-mystery-600 p-3 rounded font-mono text-sm text-gray-200">
              {text}
            </div>
          ))}
        </div>
      </div>
    )}

    {data.textLocations?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Text Locations</h4>
        <div className="space-y-2">
          {data.textLocations.map((loc: string, idx: number) => (
            <div key={idx} className="text-gray-300 text-sm">• {loc}</div>
          ))}
        </div>
      </div>
    )}

    {data.translations && Object.keys(data.translations).length > 0 && (
      <div className="bg-blue-500/10 border border-blue-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-blue-400 mb-3">Translations</h4>
        <div className="space-y-3">
          {Object.entries(data.translations).map(([original, translation], idx) => (
            <div key={idx} className="bg-mystery-700/50 p-3 rounded">
              <div className="text-gray-400 text-xs mb-1">Original:</div>
              <div className="text-white text-sm mb-2">{original}</div>
              <div className="text-gray-400 text-xs mb-1">Translation:</div>
              <div className="text-blue-300 text-sm">{translation}</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {data.notes && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Additional Notes</h4>
        <p className="text-gray-300 text-sm">{data.notes}</p>
      </div>
    )}
  </div>
);

const VerificationView: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <Shield className="w-6 h-6 text-mystery-400" />
      Image Authenticity Verification
    </h3>

    <div className={`p-6 rounded-xl border-2 ${
      data.authentic 
        ? 'bg-green-500/10 border-green-500/50' 
        : 'bg-red-500/10 border-red-500/50'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-2xl font-bold text-white mb-1">
            {data.authentic ? '✓ Likely Authentic' : '⚠️ Potential Issues Detected'}
          </div>
          <div className={`text-sm ${data.authentic ? 'text-green-400' : 'text-red-400'}`}>
            {data.authentic 
              ? 'No significant manipulation detected' 
              : 'Image shows signs of modification'}
          </div>
        </div>
        <div className="text-4xl font-bold text-white">{data.confidence}%</div>
      </div>
    </div>

    {data.issues?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          Issues Found
        </h4>
        <ul className="space-y-2">
          {data.issues.map((issue: string, idx: number) => (
            <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
              <span className="text-red-400 mt-1">•</span>
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {data.analysis && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Detailed Analysis</h4>
        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{data.analysis}</p>
      </div>
    )}
  </div>
);

const ConsistencyView: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <Users className="w-6 h-6 text-mystery-400" />
      Witness Consistency Analysis
    </h3>

    <div className="bg-mystery-700 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400">Overall Consistency Score</span>
        <span className="text-3xl font-bold text-white">{data.overallConsistency}%</span>
      </div>
      <div className="w-full bg-mystery-900 rounded-full h-3">
        <div className="bg-mystery-400 h-3 rounded-full" style={{ width: `${data.overallConsistency}%` }}></div>
      </div>
    </div>

    {data.consistentDetails?.length > 0 && (
      <div className="bg-green-500/10 border border-green-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-green-400 mb-3">✓ Consistent Details (Corroborated)</h4>
        <ul className="space-y-2">
          {data.consistentDetails.map((detail: string, idx: number) => (
            <li key={idx} className="text-green-200 text-sm">• {detail}</li>
          ))}
        </ul>
      </div>
    )}

    {data.inconsistencies?.length > 0 && (
      <div className="bg-red-500/10 border border-red-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-red-400 mb-3">⚠️ Inconsistencies Found</h4>
        <div className="space-y-3">
          {data.inconsistencies.map((item: any, idx: number) => (
            <div key={idx} className="bg-mystery-700/50 p-3 rounded">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-white text-sm font-medium">{item.detail}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  item.severity === 'high' ? 'bg-red-500/30 text-red-300' :
                  item.severity === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                  'bg-gray-500/30 text-gray-300'
                }`}>
                  {item.severity}
                </span>
              </div>
              <div className="text-red-200 text-xs">
                Sources: {item.sources?.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {data.credibilityScores && Object.keys(data.credibilityScores).length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-4">Credibility Scores by Source</h4>
        <div className="space-y-3">
          {Object.entries(data.credibilityScores).map(([source, score]: [string, any], idx: number) => (
            <div key={idx}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">{source}</span>
                <span className="text-white font-medium">{score}%</span>
              </div>
              <div className="w-full bg-mystery-900 rounded-full h-2">
                <div className="bg-mystery-400 h-2 rounded-full" style={{ width: `${score}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {data.analysis && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Analysis Summary</h4>
        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{data.analysis}</p>
      </div>
    )}
  </div>
);

const LocationView: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <MapPin className="w-6 h-6 text-mystery-400" />
      Location Analysis
    </h3>

    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Terrain</span>
        <p className="text-white font-medium mt-2">{data.terrain}</p>
      </div>
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Visibility</span>
        <p className="text-white font-medium mt-2">{data.visibility}</p>
      </div>
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Accessibility</span>
        <p className="text-white font-medium mt-2">{data.accessibility}</p>
      </div>
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Confidence</span>
        <p className="text-white font-medium mt-2">{data.confidence}%</p>
      </div>
    </div>

    {data.weatherFactors?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Weather Factors</h4>
        <div className="flex flex-wrap gap-2">
          {data.weatherFactors.map((factor: string, idx: number) => (
            <span key={idx} className="px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-sm border border-blue-500/50">
              {factor}
            </span>
          ))}
        </div>
      </div>
    )}

    {data.environmentalFactors?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Environmental Factors</h4>
        <ul className="space-y-2">
          {data.environmentalFactors.map((factor: string, idx: number) => (
            <li key={idx} className="text-gray-300 text-sm">• {factor}</li>
          ))}
        </ul>
      </div>
    )}

    {data.historicalContext && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Historical Context</h4>
        <p className="text-gray-300 text-sm leading-relaxed">{data.historicalContext}</p>
      </div>
    )}

    {data.suggestedSites?.length > 0 && (
      <div className="bg-blue-500/10 border border-blue-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-blue-400 mb-3">Suggested Investigation Sites</h4>
        <ul className="space-y-2">
          {data.suggestedSites.map((site: string, idx: number) => (
            <li key={idx} className="text-blue-200 text-sm">→ {site}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const TimelineView: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <Clock className="w-6 h-6 text-mystery-400" />
      Event Timeline
    </h3>

    <div className="space-y-1">
      {data.map((event: any, idx: number) => (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center pt-1">
            <div className="w-4 h-4 bg-mystery-400 rounded-full border-2 border-mystery-800"></div>
            {idx < data.length - 1 && <div className="w-0.5 flex-1 bg-mystery-600 my-1"></div>}
          </div>
          <div className="flex-1 pb-6">
            <p className="text-sm text-mystery-400 font-medium mb-1">{event.time}</p>
            <p className="text-white leading-relaxed">{event.event}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const PatternsView: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <GitCompare className="w-6 h-6 text-mystery-400" />
      Pattern Analysis
    </h3>

    <div className="bg-mystery-700 p-6 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-gray-400 text-sm">Classification</span>
          <p className="text-2xl font-bold text-white mt-1">{data.classification}</p>
        </div>
        <div className="text-right">
          <span className="text-gray-400 text-sm">Confidence</span>
          <p className="text-2xl font-bold text-white mt-1">{data.confidence}%</p>
        </div>
      </div>
    </div>

    {data.recurringPatterns?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Recurring Patterns</h4>
        <ul className="space-y-2">
          {data.recurringPatterns.map((pattern: string, idx: number) => (
            <li key={idx} className="text-gray-300 text-sm">• {pattern}</li>
          ))}
        </ul>
      </div>
    )}

    {data.behavioralPatterns?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Behavioral Patterns</h4>
        <ul className="space-y-2">
          {data.behavioralPatterns.map((pattern: string, idx: number) => (
            <li key={idx} className="text-gray-300 text-sm">• {pattern}</li>
          ))}
        </ul>
      </div>
    )}

    {data.uniqueAspects?.length > 0 && (
      <div className="bg-purple-500/10 border border-purple-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-purple-400 mb-3">Unique Aspects</h4>
        <ul className="space-y-2">
          {data.uniqueAspects.map((aspect: string, idx: number) => (
            <li key={idx} className="text-purple-200 text-sm">★ {aspect}</li>
          ))}
        </ul>
      </div>
    )}

    {data.hypothesis && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Working Hypothesis</h4>
        <p className="text-gray-300 text-sm leading-relaxed">{data.hypothesis}</p>
      </div>
    )}

    {data.recommendedExperts?.length > 0 && (
      <div className="bg-blue-500/10 border border-blue-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-blue-400 mb-3">Recommended Expert Consultations</h4>
        <div className="flex flex-wrap gap-2">
          {data.recommendedExperts.map((expert: string, idx: number) => (
            <span key={idx} className="px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-sm border border-blue-500/50">
              {expert}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

const QuestionsView: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <HelpCircle className="w-6 h-6 text-mystery-400" />
      Investigation Questions & Actions
    </h3>

    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Priority Level</span>
        <p className="text-2xl font-bold text-white uppercase mt-2">{data.priorityLevel}</p>
      </div>
      <div className="bg-mystery-700 p-5 rounded-lg">
        <span className="text-gray-400 text-sm">Estimated Time to Resolve</span>
        <p className="text-xl font-medium text-white mt-2">{data.estimatedTimeToResolve}</p>
      </div>
    </div>

    {data.criticalQuestions?.length > 0 && (
      <div className="bg-red-500/10 border-2 border-red-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-red-400 mb-3">🔴 Critical Questions</h4>
        <ul className="space-y-2">
          {data.criticalQuestions.map((q: string, idx: number) => (
            <li key={idx} className="text-red-200 text-sm flex items-start gap-2">
              <span className="text-red-400 font-bold mt-0.5">{idx + 1}.</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {data.witnessQuestions?.length > 0 && (
      <div className="bg-mystery-700 p-5 rounded-lg">
        <h4 className="font-semibold text-white mb-3">Witness Questions</h4>
        <ul className="space-y-2">
          {data.witnessQuestions.map((q: string, idx: number) => (
            <li key={idx} className="text-gray-300 text-sm">• {q}</li>
          ))}
        </ul>
      </div>
    )}

    {data.expertConsultations?.length > 0 && (
      <div className="bg-purple-500/10 border border-purple-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-purple-400 mb-3">Expert Consultations Needed</h4>
        <div className="space-y-3">
          {data.expertConsultations.map((item: any, idx: number) => (
            <div key={idx} className="bg-mystery-700/50 p-3 rounded">
              <div className="text-purple-300 font-medium mb-2">{item.expert}</div>
              <ul className="space-y-1">
                {item.questions.map((q: string, qIdx: number) => (
                  <li key={qIdx} className="text-purple-200 text-sm">→ {q}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    )}

    {data.followUpActions?.length > 0 && (
      <div className="bg-blue-500/10 border border-blue-500/50 p-5 rounded-lg">
        <h4 className="font-semibold text-blue-400 mb-3">Follow-Up Actions</h4>
        <div className="space-y-2">
          {data.followUpActions.map((action: any, idx: number) => (
            <div key={idx} className="bg-mystery-700/50 p-3 rounded flex items-start justify-between gap-3">
              <div className="flex-1">
                <span className="text-white text-sm">{action.action}</span>
                <div className="text-gray-400 text-xs mt-1">Timeline: {action.timeline}</div>
              </div>
              <span className={`px-2 py-1 rounded text-xs flex-shrink-0 ${
                action.priority === 'high' ? 'bg-red-500/30 text-red-300' :
                action.priority === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                'bg-gray-500/30 text-gray-300'
              }`}>
                {action.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const SimilarCasesView: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <FileText className="w-6 h-6 text-mystery-400" />
      Similar Cases ({data.length})
    </h3>

    {data.length === 0 ? (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No similar cases found</p>
      </div>
    ) : (
      <div className="space-y-3">
        {data.map(c => (
          <div key={c.id} className="bg-mystery-700 p-5 rounded-lg border border-mystery-600 hover:border-mystery-500 transition-colors">
            <h4 className="font-semibold text-white text-lg mb-2">{c.title}</h4>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="px-3 py-1 bg-mystery-600 rounded-full text-gray-300">{c.category}</span>
              <span className={`px-3 py-1 rounded-full ${
                c.status === 'OPEN' ? 'bg-green-500/20 text-green-400' :
                c.status === 'INVESTIGATING' ? 'bg-blue-500/20 text-blue-400' :
                c.status === 'CLOSED' ? 'bg-gray-500/20 text-gray-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {c.status}
              </span>
              <span className="text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ReportView: React.FC<{ data: string }> = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      <FileText className="w-6 h-6 text-mystery-400" />
      Investigation Report
    </h3>

    <div className="bg-mystery-700 p-6 rounded-lg">
      <div className="prose prose-invert max-w-none">
        <pre className="whitespace-pre-wrap text-gray-300 text-sm font-sans leading-relaxed">{data}</pre>
      </div>
    </div>

    <div className="flex gap-3">
      <button 
        onClick={() => {
          const blob = new Blob([data], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `investigation-report-${Date.now()}.txt`;
          a.click();
        }}
        className="px-6 py-3 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg font-medium transition-colors"
      >
        Download Report
      </button>
      <button 
        onClick={() => navigator.clipboard.writeText(data)}
        className="px-6 py-3 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg font-medium transition-colors"
      >
        Copy to Clipboard
      </button>
    </div>
  </div>
);
