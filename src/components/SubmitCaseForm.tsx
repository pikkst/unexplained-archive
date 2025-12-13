
import React, { useState } from 'react';
import { Case, User } from '../types';
import { Upload, Camera, MapPin, Calendar, FileText, DollarSign, Sparkles, RefreshCw, Check, Map as MapIcon, X, Clock } from 'lucide-react';
import { CaseMap } from './CaseMap';
import { caseService } from '../services/caseService';
import { format } from 'date-fns';

interface SubmitCaseFormProps {
  currentUser: User;
  onSubmit: (newCase: Partial<Case>) => void;
  onCancel: () => void;
}

export const SubmitCaseForm: React.FC<SubmitCaseFormProps> = ({ currentUser, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    category: 'UFO',
    location: '',
    coordinates: { lat: 0, lng: 0 },
    incidentDate: '',
    incidentTime: '',
    description: '',
    detailedDescription: '',
    reward: 0,
    imageUrl: '',
    isAiGenerated: false
  });

  const [aiState, setAiState] = useState<'IDLE' | 'GENERATING' | 'GENERATED' | 'CONFIRMED'>('IDLE');
  const [regenCount, setRegenCount] = useState(0);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translatedPrompt, setTranslatedPrompt] = useState<string>('');

  // Translate text to English using Gemini AI
  const translateToEnglish = async (text: string): Promise<string> => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey) {
        console.warn('Translation API not available, using original text');
        return text;
      }

      // Use Gemini for translation to English (universal AI language)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate the following text to English. Preserve all specific details, names, and descriptions. Only provide the direct translation without explanations:\n\n${text}`
              }]
            }]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Translation API error:', response.status, errorData);
        return text; // Return original if translation fails
      }

      const data = await response.json();
      const translated = data.candidates[0]?.content?.parts[0]?.text?.trim();
      
      return translated || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original if translation fails
    }
  };

  // Generate forensic/witness-based prompt - like a police sketch artist
  const generatePrompt = (description?: string, location?: string) => {
    const descText = description || formData.detailedDescription;
    const locText = location || formData.location;
    const descLower = descText.toLowerCase();
    
    // Build forensic reconstruction prompt - ONLY what witness described
    let prompt = `FORENSIC RECONSTRUCTION: Create a photorealistic witness testimony visualization. `;
    prompt += `Act as a forensic artist creating an accurate depiction based ONLY on the witness statement. `;
    prompt += `DO NOT add creative interpretation, artistic license, or embellishments. `;
    
    // Core witness statement - THE MOST IMPORTANT PART
    prompt += `\n\nWITNESS STATEMENT (recreate EXACTLY as described): "${descText}". `;
    
    // Add factual location context ONLY if provided
    if (locText) {
      prompt += `\n\nLOCATION: ${locText}. Show the actual location environment accurately. `;
    }
    
    // Add time/lighting context ONLY if mentioned by witness
    // Multi-language time indicators
    const timeIndicators = {
      night: descLower.match(/night|noche|nuit|nacht|noite|notte|晚上|夜|ночь|õhtul|öö|pimedal|pime/i),
      day: descLower.match(/day|día|jour|tag|dia|giorno|白天|昼|день|päeval|päikese|hommik|keskpäev/i),
      dusk: descLower.match(/dusk|twilight|crepúsculo|crépuscule|dämmerung|crepúsculo|crepuscolo|黄昏|сумерки|hämar/i),
    };
    
    if (timeIndicators.night) {
      prompt += `LIGHTING: Night scene as stated by witness - dark sky, limited visibility. `;
    } else if (timeIndicators.day) {
      prompt += `LIGHTING: Daytime as stated by witness - natural daylight conditions. `;
    } else if (timeIndicators.dusk) {
      prompt += `LIGHTING: Dusk/twilight as stated by witness - fading light. `;
    }
    
    // Extract ONLY explicitly mentioned visual details
    const visualDetails = [];
    
    // Shape descriptors (multi-language)
    if (descLower.match(/disc|disk|saucer|platillo|disque|scheibe|disco|円盤|диск|ketas/i)) {
      visualDetails.push('disc-shaped or saucer-like object as described');
    }
    if (descLower.match(/oval|ovalado|ovale|oval|楕円|овальный|ovaal/i)) {
      visualDetails.push('oval-shaped object as described');
    }
    if (descLower.match(/triangle|triangular|triángulo|triangulaire|dreieck|triangolo|三角|треугольник|kolmnurk/i)) {
      visualDetails.push('triangular shape as described');
    }
    if (descLower.match(/sphere|ball|esfera|sphère|kugel|sfera|球|сфера|kera/i)) {
      visualDetails.push('spherical object as described');
    }
    
    // Light/color descriptors (multi-language)
    if (descLower.match(/light|luz|lumière|licht|luce|光|свет|valgus|tuli/i)) {
      visualDetails.push('visible lights as mentioned');
    }
    if (descLower.match(/red|rojo|rouge|rot|rosso|赤|красный|punane/i)) {
      visualDetails.push('red coloration as stated');
    }
    if (descLower.match(/blue|azul|bleu|blau|blu|青|синий|sinine/i)) {
      visualDetails.push('blue coloration as stated');
    }
    if (descLower.match(/green|verde|vert|grün|绿|зеленый|roheline/i)) {
      visualDetails.push('green coloration as stated');
    }
    if (descLower.match(/orange|naranja|arancione|オレンジ|оранжевый|oranž/i)) {
      visualDetails.push('orange coloration as stated');
    }
    if (descLower.match(/bright|brilliant|hell|luminoso|明るい|яркий|hele|särav/i)) {
      visualDetails.push('bright/glowing appearance as described');
    }
    
    // Motion descriptors (multi-language)
    if (descLower.match(/fly|flying|hover|volando|volant|fliegen|volare|飛ぶ|летать|lendav|õhus/i)) {
      visualDetails.push('airborne/flying position as observed');
    }
    if (descLower.match(/fast|quick|rapid|rápido|rapide|schnell|veloce|速い|быстрый|kiire/i)) {
      visualDetails.push('show motion blur if speed was emphasized');
    }
    
    // Size/scale descriptors (multi-language)
    if (descLower.match(/large|big|grande|groß|大きい|большой|suur/i)) {
      visualDetails.push('large scale as indicated');
    }
    if (descLower.match(/small|tiny|pequeño|petit|klein|piccolo|小さい|маленький|väike/i)) {
      visualDetails.push('small scale as indicated');
    }
    
    if (visualDetails.length > 0) {
      prompt += `\n\nSPECIFIC VISUAL DETAILS FROM WITNESS: ${visualDetails.join('; ')}. `;
    }
    
    // Technical guidelines for forensic accuracy
    prompt += `\n\nFORENSIC GUIDELINES: `;
    prompt += `- Photorealistic documentary evidence style `;
    prompt += `- Accurate environmental context for location `;
    prompt += `- Neutral perspective, objective witness viewpoint `;
    prompt += `- No dramatic effects unless witness mentioned them `;
    prompt += `- No artistic interpretation or creative additions `;
    prompt += `- Focus on witness-described elements only `;
    
    // Strict exclusions
    prompt += `\n\nSTRICTLY AVOID: `;
    prompt += `Aurora borealis/northern lights, `;
    prompt += `cartoon style, fantasy art, `;
    prompt += `science fiction movie effects, `;
    prompt += `elements NOT mentioned by witness, `;
    prompt += `dramatic artistic embellishments, `;
    prompt += `speculative additions. `;
    
    prompt += `\n\nRender ONLY what the witness explicitly described, nothing more.`;
    
    return prompt;
  };

  const handleGenerateAiImage = async () => {
    if (!formData.detailedDescription || !formData.category) {
      alert("Please fill in Category and Detailed Report to generate an image.");
      return;
    }
    
    setAiState('GENERATING');
    setAiError(null);
    setTranslating(autoTranslate);
    
    try {
      setTranslating(false);
      
      // Use original text directly - AI can understand Estonian
      const promptText = formData.detailedDescription;
      const locationText = formData.location;
      
      const prompt = generatePrompt(promptText, locationText);
      console.log('Generated prompt:', prompt);
      
      // Generate AI image using caseService
      const result = await caseService.generateAIImage(
        currentUser.id, 
        null, 
        promptText || formData.detailedDescription,
        formData.category,
        locationText || formData.location
      );
      
      setFormData({ 
        ...formData, 
        imageUrl: result.imageUrl, 
        isAiGenerated: true 
      });
      setAiState('GENERATED');
      
      if (result.remaining === 0) {
        setAiError('You have used all free AI generations for this case');
      }
      
    } catch (error: any) {
      console.error('AI generation error:', error);
      setAiError(error.message || 'Failed to generate image');
      setAiState('IDLE');
    }
  };

  const handleRegenerate = () => {
    if (regenCount >= 1) return;
    setRegenCount(prev => prev + 1);
    handleGenerateAiImage();
  };

  const handleLocationPick = (lat: number, lng: number) => {
    setFormData({
      ...formData,
      coordinates: { lat, lng },
      location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    });
    // Don't close immediately so they can adjust
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.imageUrl && aiState !== 'CONFIRMED') {
      alert("Please upload media or generate/confirm an AI visualization.");
      return;
    }

    // Check if user wants to translate case to English
    const submitLanguage = (document.querySelector('input[name="submitLanguage"]:checked') as HTMLInputElement)?.value;
    const shouldTranslate = submitLanguage === 'english';

    let finalData = { ...formData };
    let originalData = null;

    // Translate case content if requested
    if (shouldTranslate) {
      try {
        const [translatedTitle, translatedDesc, translatedDetailed, translatedLocation] = await Promise.all([
          translateToEnglish(formData.title),
          translateToEnglish(formData.description),
          translateToEnglish(formData.detailedDescription),
          formData.location ? translateToEnglish(formData.location) : Promise.resolve('')
        ]);

        // Store original data in metadata
        originalData = {
          title: formData.title,
          description: formData.description,
          detailedDescription: formData.detailedDescription,
          location: formData.location
        };

        finalData = {
          ...formData,
          title: translatedTitle,
          description: translatedDesc,
          detailedDescription: translatedDetailed,
          location: translatedLocation || formData.location
        };
      } catch (error) {
        console.error('Translation error:', error);
        alert('Translation failed. Submitting in original language.');
      }
    }

    // Combine date and time into ISO format
    let finalDateTime = '';
    if (finalData.incidentDate) {
      const dateTime = finalData.incidentTime 
        ? `${finalData.incidentDate}T${finalData.incidentTime}:00`
        : `${finalData.incidentDate}T12:00:00`;
      finalDateTime = new Date(dateTime).toISOString();
    }

    onSubmit({
      ...finalData,
      incidentDate: finalDateTime,
      status: 'OPEN',
      submittedBy: currentUser,
      submittedDate: new Date().toISOString(),
      communityVotes: { agree: 0, disagree: 0 },
      metadata: originalData ? { original_language: originalData } : undefined
    } as unknown as Partial<Case>);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-mystery-800 rounded-xl p-8 border border-mystery-700 shadow-2xl">
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <FileText className="text-mystery-accent" />
          Submit a New Case
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Case Title</label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
                placeholder="e.g., Strange Lights over Nevada"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
              >
                <option value="UFO">UFO / Aerial Phenomenon</option>
                <option value="CRYPTID">Cryptid (Bigfoot, etc.)</option>
                <option value="PARANORMAL">Paranormal / Ghost</option>
                <option value="SUPERNATURAL">Supernatural</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Location
              </label>
              <div className="flex gap-2">
                  <input
                    required
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="flex-1 bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
                    placeholder="City or Coordinates"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="p-3 bg-mystery-700 hover:bg-mystery-600 rounded-lg text-white border border-mystery-600"
                    title="Pin on Map"
                  >
                    <MapIcon className="w-5 h-5" />
                  </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Date of Incident
              </label>
              <input
                required
                type="date"
                value={formData.incidentDate}
                onChange={(e) => setFormData({...formData, incidentDate: e.target.value})}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Time of Incident (Optional)
            </label>
            <input
              type="time"
              value={formData.incidentTime}
              onChange={(e) => setFormData({...formData, incidentTime: e.target.value})}
              className="w-full md:w-1/2 bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none [color-scheme:dark]"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty if you don't remember the exact time</p>
          </div>

          {/* Map Picker Modal */}
          {showMapPicker && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-mystery-800 w-full max-w-4xl h-[600px] rounded-xl border border-mystery-600 flex flex-col overflow-hidden">
                <div className="p-4 bg-mystery-900 border-b border-mystery-700 flex justify-between items-center">
                  <h3 className="text-white font-bold flex items-center gap-2"><MapIcon className="w-4 h-4"/> Pin Exact Location</h3>
                  <button onClick={() => setShowMapPicker(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                <div className="flex-1 relative">
                  <CaseMap isPickerMode={true} onLocationPick={handleLocationPick} />
                </div>
                <div className="p-4 bg-mystery-900 border-t border-mystery-700 flex justify-between items-center">
                  <p className="text-gray-400 text-sm">Selected: {formData.coordinates.lat ? `${formData.coordinates.lat.toFixed(5)}, ${formData.coordinates.lng.toFixed(5)}` : 'None'}</p>
                  <button onClick={() => setShowMapPicker(false)} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold">Confirm Location</button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Brief Description</label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none resize-none"
              placeholder="What happened? Keep it short for the preview."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-400">Detailed Report (Required for AI)</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoTranslate"
                  checked={autoTranslate}
                  onChange={(e) => setAutoTranslate(e.target.checked)}
                  className="w-4 h-4 rounded bg-mystery-900 border-mystery-700 text-mystery-500 focus:ring-mystery-500"
                />
                <label htmlFor="autoTranslate" className="text-xs text-gray-400 cursor-pointer">
                  🌐 Auto-translate for AI (any language → English)
                </label>
              </div>
            </div>
            <textarea
              required
              rows={5}
              value={formData.detailedDescription}
              onChange={(e) => setFormData({...formData, detailedDescription: e.target.value})}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none resize-none"
              placeholder="Describe in detail in your language (auto-translation available)"
            />
            {translatedPrompt && autoTranslate && (
              <div className="mt-2 p-2 bg-mystery-800 border border-mystery-700 rounded text-xs text-gray-400">
                <span className="font-semibold text-mystery-400">Translated for AI:</span> {translatedPrompt.substring(0, 100)}...
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Media Section */}
             <div className="bg-mystery-900 p-4 rounded-lg border border-mystery-700">
              <label className="block text-sm font-medium text-gray-400 mb-4">Evidence Media</label>
              
              {/* Error message */}
              {aiError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                  {aiError}
                </div>
              )}
              
              {!formData.isAiGenerated && aiState === 'IDLE' ? (
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 w-full h-32 border-2 border-dashed border-mystery-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-mystery-500 hover:text-mystery-400 cursor-pointer transition-colors">
                    <Upload className="w-8 h-8 mb-2" />
                    <span className="text-sm">Upload File</span>
                  </div>
                  <div className="text-gray-500 font-bold">OR</div>
                  <div 
                    onClick={handleGenerateAiImage}
                    className="flex-1 w-full h-32 border-2 border-mystery-600 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:border-mystery-accent hover:text-mystery-accent group"
                  >
                    <Sparkles className="w-8 h-8 mb-2 group-hover:animate-pulse" />
                    <span className="text-sm">Generate with AI</span>
                    <span className="text-xs text-gray-600 mt-1">FREE - 2x per case</span>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-48 bg-black rounded-lg overflow-hidden flex items-center justify-center">
                  {aiState === 'GENERATING' ? (
                    <div className="flex flex-col items-center text-mystery-accent animate-pulse">
                      <Sparkles className="w-8 h-8 mb-2" />
                      <span className="text-sm">
                        {translating ? 'Translating to English...' : 'Visualizing based on report...'}
                      </span>
                    </div>
                  ) : (
                    <>
                       <img src={formData.imageUrl} className="w-full h-full object-cover" />
                       <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                         {aiState === 'GENERATED' && (
                           <>
                             <button 
                               onClick={() => setAiState('CONFIRMED')}
                               className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                             >
                               <Check className="w-4 h-4" /> Confirm
                             </button>
                             {regenCount < 1 && (
                               <button 
                                 onClick={handleRegenerate}
                                 className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                               >
                                 <RefreshCw className="w-4 h-4" /> Retry (1 left)
                               </button>
                             )}
                           </>
                         )}
                         {aiState === 'CONFIRMED' && (
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold border border-green-500">
                              Confirmed for Profile/Case
                            </span>
                         )}
                       </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="bg-mystery-900 p-4 rounded-lg border border-mystery-700">
               <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                 <DollarSign className="w-4 h-4 text-green-400" /> Initial Bounty / Reward (Optional)
               </label>
               <p className="text-xs text-gray-500 mb-4">Motivate investigators to prioritize your case. Reward will be deducted from your wallet when you submit.</p>
               <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                 <input
                  type="number"
                  min="0"
                  value={formData.reward}
                  onChange={(e) => setFormData({...formData, reward: parseInt(e.target.value) || 0})}
                  className="w-full bg-mystery-800 border border-mystery-600 rounded-lg pl-8 pr-4 py-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
               </div>
            </div>
          </div>

          {/* Language preference for case submission */}
          <div className="bg-mystery-900 p-4 rounded-lg border border-mystery-700">
            <label className="block text-sm font-medium text-gray-400 mb-3">🌍 Case Language:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="submitLanguage"
                  value="original"
                  defaultChecked
                  className="w-4 h-4 text-mystery-500 bg-mystery-800 border-mystery-700 focus:ring-mystery-500"
                />
                <span className="text-white text-sm">Keep original language</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="submitLanguage"
                  value="english"
                  className="w-4 h-4 text-mystery-500 bg-mystery-800 border-mystery-700 focus:ring-mystery-500"
                />
                <span className="text-white text-sm">Translate to English</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 English translation helps reach more investigators globally. Original text is always preserved.
            </p>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-mystery-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-mystery-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={aiState === 'GENERATING'}
              className="px-8 py-3 bg-mystery-500 hover:bg-mystery-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-lg shadow-mystery-500/25 transition-all"
            >
              Submit Case
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
