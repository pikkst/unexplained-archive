
import React, { useState, useEffect } from 'react';
import { Case, User } from '../types';
import { Upload, Camera, MapPin, Calendar, FileText, DollarSign, Sparkles, RefreshCw, Check, Map as MapIcon, X, Clock, FileSearch, Coins, Navigation } from 'lucide-react';
import { CaseMap } from './CaseMap';
import { caseService } from '../services/caseService';
import { geocodingService } from '../services/geocodingService';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { CreditsDisplay } from './CreditsDisplay';

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
    mediaUrls: [] as string[],
    isAiGenerated: false,
    paymentMethod: 'credits' as 'credits' | 'wallet' | 'stripe'
  });

  const [aiState, setAiState] = useState<'IDLE' | 'GENERATING' | 'GENERATED' | 'CONFIRMED'>('IDLE');
  const [regenCount, setRegenCount] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<{url: string; name: string; size: number; type: string}[]>([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translatedPrompt, setTranslatedPrompt] = useState<string>('');
  const [userCredits, setUserCredits] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useCreditsForAI, setUseCreditsForAI] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showTemplateGuide, setShowTemplateGuide] = useState(false);
  
  useEffect(() => {
    loadTemplates();
    loadUserCredits();
    loadWalletBalance();
  }, []);
  
  const loadUserCredits = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', currentUser.id)
      .single();
    
    if (profile) {
      setUserCredits(profile.credits || 0);
    }
  };
  
  const loadWalletBalance = async () => {
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', currentUser.id)
        .single();
      
      if (wallet) {
        setWalletBalance(wallet.balance || 0);
      }
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    }
  };
  
  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('case_templates')
        .select('*')
        .eq('is_public', true)
        .order('usage_count', { ascending: false });
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };
  
  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplate('');
      setShowTemplateGuide(false);
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    setSelectedTemplate(templateId);
    setShowTemplateGuide(true);
    
    // Pre-fill category
    setFormData(prev => ({
      ...prev,
      category: template.category
    }));
  };

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
    
    // Check if using credits
    if (useCreditsForAI) {
      if (userCredits < 5) {
        alert('You need 5 credits to generate an AI image. Redeem a promo code to get credits!');
        return;
      }
      
      // Spend credits first
      const { data: spendResult } = await supabase.rpc('spend_user_credits', {
        p_user_id: currentUser.id,
        p_amount: 5,
        p_source: 'ai_generation',
        p_description: `AI image generation for case: ${formData.title || 'Untitled'}`,
        p_case_id: null
      });
      
      if (!spendResult?.success) {
        alert(spendResult?.error || 'Failed to spend credits');
        return;
      }
      
      setUserCredits(spendResult.new_balance);
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
      
      // Add AI generated image to media array
      const newMediaUrls = [...formData.mediaUrls, result.imageUrl];
      const newFiles = [...uploadedFiles, {
        url: result.imageUrl,
        name: 'AI Generated Image',
        size: 0,
        type: 'image/ai-generated'
      }];
      
      setFormData({ 
        ...formData, 
        mediaUrls: newMediaUrls,
        isAiGenerated: true 
      });
      setUploadedFiles(newFiles);
      setAiState('GENERATED');
      
      if (result.remaining === 0 && !useCreditsForAI) {
        setAiError('You have used all free AI generations for this case. Use credits for more!');
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit
    const currentFileCount = uploadedFiles.length;
    if (currentFileCount + files.length > 5) {
      alert(`You can only upload up to 5 files. You currently have ${currentFileCount} file(s). Please remove some files first.`);
      return;
    }

    // Calculate total size including existing files
    const currentTotalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
    const newFilesSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalSize = currentTotalSize + newFilesSize;

    if (totalSize > 50 * 1024 * 1024) {
      const currentSizeMB = (currentTotalSize / (1024 * 1024)).toFixed(1);
      const newSizeMB = (newFilesSize / (1024 * 1024)).toFixed(1);
      alert(`Total file size would exceed 50MB limit. Current: ${currentSizeMB}MB, Adding: ${newSizeMB}MB. Please select smaller files.`);
      return;
    }

    // Validate file types
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
    ];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        alert(`"${file.name}" is not a valid file type. Please upload images (JPEG, PNG, GIF, WebP) or videos (MP4, MOV, AVI, WebM).`);
        return;
      }
    }

    setUploadingFile(true);
    setAiError(null);

    try {
      const uploadedUrls: string[] = [];
      const newFileMetadata: {url: string; name: string; size: number; type: string}[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `case-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
        newFileMetadata.push({
          url: publicUrl,
          name: file.name,
          size: file.size,
          type: file.type
        });
      }

      // Update state with new files
      const allMediaUrls = [...formData.mediaUrls, ...uploadedUrls];
      const allFiles = [...uploadedFiles, ...newFileMetadata];

      setFormData({
        ...formData,
        mediaUrls: allMediaUrls,
        isAiGenerated: false
      });
      setUploadedFiles(allFiles);
      
      if (aiState === 'IDLE') {
        setAiState('CONFIRMED');
      }
      
    } catch (error: any) {
      console.error('File upload error:', error);
      setAiError(error.message || 'Failed to upload files');
    } finally {
      setUploadingFile(false);
      // Reset the input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    const newMediaUrls = formData.mediaUrls.filter((_, i) => i !== index);
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    
    setFormData({
      ...formData,
      mediaUrls: newMediaUrls
    });
    setUploadedFiles(newFiles);

    // Reset AI state if no files left
    if (newMediaUrls.length === 0 && aiState === 'CONFIRMED') {
      setAiState('IDLE');
    }
  };

  const handleGeocodeAddress = async () => {
    const address = formData.location.trim();
    
    if (!address) {
      setGeocodeError('Please enter an address');
      return;
    }

    // If it looks like coordinates already, parse them
    if (geocodingService.isCoordinates(address)) {
      const coords = geocodingService.parseCoordinates(address);
      if (coords) {
        setFormData({
          ...formData,
          coordinates: coords
        });
        setGeocodeError(null);
        return;
      }
    }

    setGeocoding(true);
    setGeocodeError(null);

    try {
      const result = await geocodingService.geocodeAddress(address);
      
      setFormData({
        ...formData,
        location: result.formattedAddress,
        coordinates: { lat: result.lat, lng: result.lng }
      });

      // Show success feedback
      setGeocodeError(null);
    } catch (error: any) {
      console.error('Geocoding error:', error);
      setGeocodeError(error.message || 'Could not find location. Try manual pin placement.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleLocationPick = async (lat: number, lng: number) => {
    // Try to reverse geocode the coordinates to get a readable address
    try {
      const address = await geocodingService.reverseGeocode(lat, lng);
      setFormData({
        ...formData,
        coordinates: { lat, lng },
        location: address
      });
    } catch (error) {
      // If reverse geocoding fails, just use coordinates
      setFormData({
        ...formData,
        coordinates: { lat, lng },
        location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.mediaUrls.length === 0 && aiState !== 'CONFIRMED') {
      alert("Please upload at least one media file or generate an AI visualization.");
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
          {/* Template Selector */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <FileSearch className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Use a Template (Optional)</h3>
            </div>
            <p className="text-sm text-gray-300 mb-3">
              Templates help you provide complete information for better investigations.
            </p>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
            >
              <option value="">Create from scratch</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} - {t.description}
                </option>
              ))}
            </select>
            
            {showTemplateGuide && selectedTemplate && (
              <div className="mt-4 bg-mystery-900/50 border border-mystery-700 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2 text-sm">Template Guide</h4>
                {(() => {
                  const template = templates.find(t => t.id === selectedTemplate);
                  if (!template) return null;
                  
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 mb-3">{template.guidance_text}</p>
                      <div className="text-xs text-gray-300 space-y-1">
                        <p className="font-semibold text-mystery-400">Required Information:</p>
                        {Object.entries(template.form_fields).map(([key, value]: [string, any]) => (
                          <div key={key} className="pl-2">
                            <span className="text-mystery-300">• {value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          
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
                    onChange={(e) => {
                      setFormData({...formData, location: e.target.value});
                      setGeocodeError(null);
                    }}
                    className="flex-1 bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
                    placeholder="Enter address or city (e.g., Tallinn, Estonia)"
                  />
                  <button 
                    type="button"
                    onClick={handleGeocodeAddress}
                    disabled={geocoding || !formData.location.trim()}
                    className="p-3 bg-mystery-700 hover:bg-mystery-600 rounded-lg text-white border border-mystery-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Find Location"
                  >
                    {geocoding ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Navigation className="w-5 h-5" />
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="p-3 bg-mystery-700 hover:bg-mystery-600 rounded-lg text-white border border-mystery-600"
                    title="Manual Pin on Map"
                  >
                    <MapIcon className="w-5 h-5" />
                  </button>
              </div>
              {geocodeError && (
                <p className="text-xs text-red-400 mt-1">{geocodeError}</p>
              )}
              {formData.coordinates.lat !== 0 && formData.coordinates.lng !== 0 && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Location set: {formData.coordinates.lat.toFixed(4)}, {formData.coordinates.lng.toFixed(4)}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Enter address for cities, or use manual pin for remote areas
              </p>
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
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-mystery-800 w-full max-w-4xl h-[600px] rounded-xl border border-mystery-600 flex flex-col overflow-hidden z-40">
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
              <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center justify-between">
                <span>Evidence Media ({uploadedFiles.length}/5)</span>
                <span className="text-xs text-gray-500">
                  {uploadedFiles.length > 0 && `Total: ${(uploadedFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(1)}MB / 50MB`}
                </span>
              </label>
              
              {/* Error message */}
              {aiError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                  {aiError}
                </div>
              )}

              {/* Uploaded Files Gallery */}
              {uploadedFiles.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-black rounded-lg overflow-hidden">
                        {file.type.startsWith('video/') ? (
                          <video src={file.url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                        <p className="text-white text-xs mb-2 text-center truncate w-full">{file.name}</p>
                        {file.type === 'image/ai-generated' && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs mb-2">AI Generated</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Upload Controls */}
              {uploadedFiles.length < 5 && (
                <>
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <label className="flex-1 w-full h-32 border-2 border-dashed border-mystery-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-mystery-500 hover:text-mystery-400 cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadingFile}
                      />
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-sm">{uploadingFile ? 'Uploading...' : 'Upload Images/Videos'}</span>
                      <span className="text-xs text-gray-600 mt-1">Up to {5 - uploadedFiles.length} more files</span>
                    </label>
                    <div className="text-gray-500 font-bold">OR</div>
                    <div 
                      onClick={handleGenerateAiImage}
                      className="flex-1 w-full h-32 border-2 border-mystery-600 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:border-mystery-accent hover:text-mystery-accent group"
                    >
                      <Sparkles className="w-8 h-8 mb-2 group-hover:animate-pulse" />
                      <span className="text-sm">Generate with AI</span>
                      <span className="text-xs text-gray-600 mt-1">
                        {useCreditsForAI ? '5 credits' : 'FREE - 2x per case'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Credits payment option */}
                  {userCredits >= 5 && (
                    <div className="mt-4 p-3 bg-purple-600/10 border border-purple-500/30 rounded-lg">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useCreditsForAI}
                          onChange={(e) => setUseCreditsForAI(e.target.checked)}
                          className="w-4 h-4 rounded bg-mystery-900 border-mystery-700 text-purple-500 focus:ring-purple-500"
                        />
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-purple-300">
                            Use 5 credits instead of free limit ({userCredits} available)
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* AI Generation in Progress */}
              {aiState === 'GENERATING' && (
                <div className="w-full h-32 bg-black rounded-lg flex items-center justify-center">
                  <div className="flex flex-col items-center text-mystery-accent animate-pulse">
                    <Sparkles className="w-8 h-8 mb-2" />
                    <span className="text-sm">
                      {translating ? 'Translating to English...' : 'Visualizing based on report...'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-mystery-900 p-6 rounded-lg border border-mystery-700 space-y-4">
               <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                 <DollarSign className="w-4 h-4 text-green-400" /> Initial Bounty / Reward (Optional)
               </label>
               <p className="text-xs text-gray-500 mb-4">Motivate investigators to solve your case faster!</p>
               
               {/* Payment Method Selection */}
               <div className="space-y-3">
                 <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Payment Method:</label>
                 
                 {/* Credits Option */}
                 <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                   formData.paymentMethod === 'credits' 
                     ? 'border-mystery-500 bg-mystery-800/50' 
                     : 'border-mystery-700 hover:border-mystery-600'
                 }`}>
                   <input
                     type="radio"
                     name="paymentMethod"
                     value="credits"
                     checked={formData.paymentMethod === 'credits'}
                     onChange={(e) => setFormData({...formData, paymentMethod: 'credits'})}
                     className="mt-1"
                   />
                   <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                       <Coins className="w-4 h-4 text-yellow-400" />
                       <span className="font-semibold text-white">Credits</span>
                       <span className="text-xs text-gray-500">(Available: {userCredits})</span>
                     </div>
                     <p className="text-xs text-gray-400">1 credit = €0.10 to investigator</p>
                     {formData.reward > 0 && (
                       <p className="text-xs text-mystery-300 mt-1">
                         Cost: <span className="font-bold text-yellow-400">{formData.reward * 10} credits</span> → 
                         Investigator gets: <span className="font-bold text-green-400">€{formData.reward.toFixed(2)}</span>
                       </p>
                     )}
                   </div>
                 </label>

                 {/* Wallet Option */}
                 <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                   formData.paymentMethod === 'wallet' 
                     ? 'border-mystery-500 bg-mystery-800/50' 
                     : 'border-mystery-700 hover:border-mystery-600'
                 }`}>
                   <input
                     type="radio"
                     name="paymentMethod"
                     value="wallet"
                     checked={formData.paymentMethod === 'wallet'}
                     onChange={(e) => setFormData({...formData, paymentMethod: 'wallet'})}
                     className="mt-1"
                   />
                   <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                       <DollarSign className="w-4 h-4 text-green-400" />
                       <span className="font-semibold text-white">Wallet Balance</span>
                       <span className="text-xs text-gray-500">(Available: €{walletBalance.toFixed(2)})</span>
                     </div>
                     <p className="text-xs text-gray-400">Direct payment from your wallet</p>
                     {formData.reward > 0 && (
                       <p className="text-xs text-mystery-300 mt-1">
                         Cost: <span className="font-bold text-green-400">€{formData.reward.toFixed(2)}</span> → 
                         Investigator gets: <span className="font-bold text-green-400">€{formData.reward.toFixed(2)}</span>
                       </p>
                     )}
                   </div>
                 </label>

                 {/* Stripe Option */}
                 <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                   formData.paymentMethod === 'stripe' 
                     ? 'border-mystery-500 bg-mystery-800/50' 
                     : 'border-mystery-700 hover:border-mystery-600'
                 }`}>
                   <input
                     type="radio"
                     name="paymentMethod"
                     value="stripe"
                     checked={formData.paymentMethod === 'stripe'}
                     onChange={(e) => setFormData({...formData, paymentMethod: 'stripe'})}
                     className="mt-1"
                   />
                   <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                       <DollarSign className="w-4 h-4 text-blue-400" />
                       <span className="font-semibold text-white">Pay with Card (Stripe)</span>
                     </div>
                     <p className="text-xs text-gray-400">Pay directly when submitting case</p>
                     {formData.reward > 0 && (
                       <p className="text-xs text-mystery-300 mt-1">
                         Cost: <span className="font-bold text-blue-400">€{formData.reward.toFixed(2)}</span> → 
                         Investigator gets: <span className="font-bold text-green-400">€{formData.reward.toFixed(2)}</span>
                       </p>
                     )}
                   </div>
                 </label>
               </div>

               {/* Reward Amount Input */}
               <div className="relative mt-4">
                 <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                   Reward Amount (€):
                 </label>
                 <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                   <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.reward}
                    onChange={(e) => setFormData({...formData, reward: parseInt(e.target.value) || 0})}
                    className="w-full bg-mystery-800 border border-mystery-600 rounded-lg pl-8 pr-4 py-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="0"
                  />
                 </div>
               </div>

               {/* Validation Messages */}
               {formData.reward > 0 && (
                 <div className="mt-3">
                   {formData.paymentMethod === 'credits' && formData.reward * 10 > userCredits && (
                     <p className="text-xs text-red-400 flex items-center gap-1">
                       ⚠️ Insufficient credits. You need {formData.reward * 10} credits but only have {userCredits}.
                     </p>
                   )}
                   {formData.paymentMethod === 'wallet' && formData.reward > walletBalance && (
                     <p className="text-xs text-red-400 flex items-center gap-1">
                       ⚠️ Insufficient wallet balance. You need €{formData.reward.toFixed(2)} but only have €{walletBalance.toFixed(2)}.
                     </p>
                   )}
                 </div>
               )}
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
