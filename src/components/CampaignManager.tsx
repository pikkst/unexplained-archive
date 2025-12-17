import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Gift, Plus, Edit2, Trash2, Play, Pause, TrendingUp, Users, DollarSign, Target, Sparkles, Image as ImageIcon, Type, Copy, Check, Calendar, Tag } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  description: string;
  campaign_type: string;
  status: string;
  max_redemptions: number | null;
  current_redemptions: number;
  start_date: string;
  end_date: string;
  discount_percentage: number | null;
  discount_amount: number | null;
  free_credits: number | null;
  trial_days: number | null;
  target_user_segment: string;
  requires_code: boolean;
  banner_image_url: string | null;
  banner_text: string | null;
  landing_page_text: string | null;
  cta_button_text: string | null;
  ai_generated_content: any;
  created_at: string;
}

interface PromoCode {
  id: string;
  code: string;
  campaign_id: string;
  max_uses: number | null;
  current_uses: number;
  max_uses_per_user: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

interface CampaignStats {
  total_impressions: number;
  total_clicks: number;
  total_redemptions: number;
  total_conversions: number;
  conversion_rate: number;
  revenue_generated: number;
  discount_given: number;
}

export const CampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state for new campaign
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campaign_type: 'free_credits',
    max_redemptions: '',
    start_date: '',
    end_date: '',
    discount_percentage: '',
    discount_amount: '',
    free_credits: '',
    trial_days: '',
    target_user_segment: 'new_users',
    requires_code: false,
    banner_text: '',
    landing_page_text: '',
    cta_button_text: 'Claim Now'
  });

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiContentType, setAiContentType] = useState<'banner_image' | 'banner_text' | 'landing_text' | 'ad_copy'>('banner_text');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');

  // Promo code form
  const [codeFormData, setCodeFormData] = useState({
    code: '',
    max_uses: '',
    max_uses_per_user: '1',
    valid_from: '',
    valid_until: ''
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('promotional_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);

      // Load stats for each campaign
      for (const campaign of data || []) {
        await loadCampaignStats(campaign.id);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignStats = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('campaign_analytics')
        .select('*')
        .eq('campaign_id', campaignId);

      if (error) throw error;

      const totals = (data || []).reduce((acc, day) => ({
        total_impressions: acc.total_impressions + (day.impressions || 0),
        total_clicks: acc.total_clicks + (day.clicks || 0),
        total_redemptions: acc.total_redemptions + (day.redemptions || 0),
        total_conversions: acc.total_conversions + (day.conversions || 0),
        revenue_generated: acc.revenue_generated + parseFloat(day.revenue_generated || 0),
        discount_given: acc.discount_given + parseFloat(day.discount_given || 0),
        conversion_rate: 0
      }), {
        total_impressions: 0,
        total_clicks: 0,
        total_redemptions: 0,
        total_conversions: 0,
        revenue_generated: 0,
        discount_given: 0,
        conversion_rate: 0
      });

      totals.conversion_rate = totals.total_clicks > 0 
        ? (totals.total_conversions / totals.total_clicks) * 100 
        : 0;

      setStats(prev => ({ ...prev, [campaignId]: totals }));
    } catch (error) {
      console.error('Error loading campaign stats:', error);
    }
  };

  const loadPromoCodes = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromoCodes(data || []);
    } catch (error) {
      console.error('Error loading promo codes:', error);
    }
  };

  const createCampaign = async () => {
    try {
      const campaignData = {
        ...formData,
        max_redemptions: formData.max_redemptions ? parseInt(formData.max_redemptions) : null,
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
        discount_amount: formData.discount_amount ? parseFloat(formData.discount_amount) : null,
        free_credits: formData.free_credits ? parseInt(formData.free_credits) : null,
        trial_days: formData.trial_days ? parseInt(formData.trial_days) : null,
        status: 'draft',
        start_date: formData.start_date || new Date().toISOString(),
        end_date: formData.end_date || null
      };

      const { data, error } = await supabase
        .from('promotional_campaigns')
        .insert([campaignData])
        .select()
        .single();

      if (error) throw error;

      alert('✅ Campaign created successfully!');
      setShowCreateModal(false);
      loadCampaigns();
      resetForm();
    } catch (error: any) {
      alert('❌ Error creating campaign: ' + error.message);
    }
  };

  const updateCampaignStatus = async (campaignId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('promotional_campaigns')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) throw error;

      alert(`✅ Campaign ${newStatus}!`);
      loadCampaigns();
    } catch (error: any) {
      alert('❌ Error updating campaign: ' + error.message);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This will also delete all associated promo codes and redemptions.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('promotional_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      alert('✅ Campaign deleted successfully!');
      loadCampaigns();
    } catch (error: any) {
      alert('❌ Error deleting campaign: ' + error.message);
    }
  };

  const createPromoCode = async () => {
    if (!selectedCampaign) return;

    try {
      const codeData = {
        campaign_id: selectedCampaign.id,
        code: codeFormData.code.toUpperCase(),
        max_uses: codeFormData.max_uses ? parseInt(codeFormData.max_uses) : null,
        max_uses_per_user: parseInt(codeFormData.max_uses_per_user),
        valid_from: codeFormData.valid_from || selectedCampaign.start_date,
        valid_until: codeFormData.valid_until || selectedCampaign.end_date,
        is_active: true
      };

      const { error } = await supabase
        .from('promo_codes')
        .insert([codeData]);

      if (error) throw error;

      alert('✅ Promo code created successfully!');
      setShowCodeModal(false);
      loadPromoCodes(selectedCampaign.id);
      setCodeFormData({
        code: '',
        max_uses: '',
        max_uses_per_user: '1',
        valid_from: '',
        valid_until: ''
      });
    } catch (error: any) {
      alert('❌ Error creating promo code: ' + error.message);
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      alert('Please enter a prompt for AI generation');
      return;
    }

    setGeneratingAI(true);
    try {
      // Call Gemini API through Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('generate-campaign-content', {
        body: {
          prompt: aiPrompt,
          contentType: aiContentType,
          campaignData: selectedCampaign ? {
            name: selectedCampaign.name,
            type: selectedCampaign.campaign_type,
            description: selectedCampaign.description
          } : formData
        }
      });

      if (error) throw error;

      setGeneratedContent(data.content);

      // Save to AI content log
      if (selectedCampaign) {
        await supabase.from('campaign_ai_content').insert([{
          campaign_id: selectedCampaign.id,
          content_type: aiContentType,
          prompt: aiPrompt,
          generated_content: data.content,
          image_url: data.imageUrl || null,
          ai_model: 'gemini-2.0-flash-exp'
        }]);
      }

      alert('✅ Content generated successfully!');
    } catch (error: any) {
      alert('❌ Error generating content: ' + error.message);
    } finally {
      setGeneratingAI(false);
    }
  };

  const applyAIContent = () => {
    if (aiContentType === 'banner_text') {
      setFormData(prev => ({ ...prev, banner_text: generatedContent }));
    } else if (aiContentType === 'landing_text') {
      setFormData(prev => ({ ...prev, landing_page_text: generatedContent }));
    }
    setShowAIModal(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      campaign_type: 'free_credits',
      max_redemptions: '',
      start_date: '',
      end_date: '',
      discount_percentage: '',
      discount_amount: '',
      free_credits: '',
      trial_days: '',
      target_user_segment: 'new_users',
      requires_code: false,
      banner_text: '',
      landing_page_text: '',
      cta_button_text: 'Claim Now'
    });
  };

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'free_credits': return <Gift className="w-5 h-5" />;
      case 'trial': return <Calendar className="w-5 h-5" />;
      case 'discount': return <Tag className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getCampaignTypeColor = (type: string) => {
    switch (type) {
      case 'free_credits': return 'text-green-400 bg-green-500/20';
      case 'trial': return 'text-blue-400 bg-blue-500/20';
      case 'discount': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'paused': return 'text-yellow-400 bg-yellow-500/20';
      case 'completed': return 'text-blue-400 bg-blue-500/20';
      case 'expired': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-mystery-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Gift className="w-8 h-8 text-mystery-500" />
            Campaign Manager
          </h1>
          <p className="text-gray-400 mt-2">Create and manage promotional campaigns, discounts, and trial offers</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Campaign
        </button>
      </div>

      {/* Campaign List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {campaigns.map(campaign => {
          const campaignStats = stats[campaign.id] || {
            total_impressions: 0,
            total_clicks: 0,
            total_redemptions: 0,
            total_conversions: 0,
            conversion_rate: 0,
            revenue_generated: 0,
            discount_given: 0
          };

          return (
            <div
              key={campaign.id}
              className="bg-mystery-800 border border-mystery-700 rounded-lg p-6 hover:border-mystery-500 transition-colors"
            >
              {/* Campaign Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${getCampaignTypeColor(campaign.campaign_type)}`}>
                    {getCampaignTypeIcon(campaign.campaign_type)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{campaign.name}</h3>
                    <p className="text-sm text-gray-400">{campaign.description}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(campaign.status)}`}>
                  {campaign.status.toUpperCase()}
                </span>
              </div>

              {/* Campaign Details */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-mystery-900/50 p-3 rounded-lg">
                  <div className="text-sm text-gray-400">Redemptions</div>
                  <div className="text-lg font-semibold text-white">
                    {campaign.current_redemptions} / {campaign.max_redemptions || '∞'}
                  </div>
                </div>
                <div className="bg-mystery-900/50 p-3 rounded-lg">
                  <div className="text-sm text-gray-400">Benefit</div>
                  <div className="text-lg font-semibold text-mystery-400">
                    {campaign.free_credits && `${campaign.free_credits} Credits`}
                    {campaign.trial_days && `${campaign.trial_days} Days Trial`}
                    {campaign.discount_percentage && `${campaign.discount_percentage}% Off`}
                    {campaign.discount_amount && `$${campaign.discount_amount} Off`}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                <div className="bg-mystery-900/50 p-2 rounded">
                  <div className="text-xs text-gray-400">Views</div>
                  <div className="text-sm font-semibold text-white">{campaignStats.total_impressions}</div>
                </div>
                <div className="bg-mystery-900/50 p-2 rounded">
                  <div className="text-xs text-gray-400">Clicks</div>
                  <div className="text-sm font-semibold text-white">{campaignStats.total_clicks}</div>
                </div>
                <div className="bg-mystery-900/50 p-2 rounded">
                  <div className="text-xs text-gray-400">Used</div>
                  <div className="text-sm font-semibold text-white">{campaignStats.total_redemptions}</div>
                </div>
                <div className="bg-mystery-900/50 p-2 rounded">
                  <div className="text-xs text-gray-400">CVR</div>
                  <div className="text-sm font-semibold text-green-400">{campaignStats.conversion_rate.toFixed(1)}%</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-mystery-700">
                {campaign.status === 'draft' && (
                  <button
                    onClick={() => updateCampaignStatus(campaign.id, 'active')}
                    className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Launch
                  </button>
                )}
                {campaign.status === 'active' && (
                  <button
                    onClick={() => updateCampaignStatus(campaign.id, 'paused')}
                    className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}
                {campaign.status === 'paused' && (
                  <button
                    onClick={() => updateCampaignStatus(campaign.id, 'active')}
                    className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedCampaign(campaign);
                    loadPromoCodes(campaign.id);
                    setShowCodeModal(true);
                  }}
                  className="flex-1 bg-mystery-700 hover:bg-mystery-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Tag className="w-4 h-4" />
                  Codes
                </button>
                <button
                  onClick={() => deleteCampaign(campaign.id)}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-mystery-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-mystery-800 border-b border-mystery-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Plus className="w-6 h-6 text-mystery-500" />
                Create New Campaign
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., First 100 Users Promotion"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                  rows={3}
                  placeholder="Brief description of the campaign"
                />
              </div>

              {/* Campaign Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Type *</label>
                <select
                  value={formData.campaign_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, campaign_type: e.target.value }))}
                  className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="free_credits">Free Credits</option>
                  <option value="trial">Free Trial Period</option>
                  <option value="discount">Percentage Discount</option>
                  <option value="free_ticket">Free Investigation Ticket</option>
                </select>
              </div>

              {/* Benefits based on type */}
              <div className="grid grid-cols-2 gap-4">
                {formData.campaign_type === 'free_credits' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Free Credits *</label>
                    <input
                      type="number"
                      value={formData.free_credits}
                      onChange={(e) => setFormData(prev => ({ ...prev, free_credits: e.target.value }))}
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                      placeholder="10"
                    />
                  </div>
                )}
                {formData.campaign_type === 'trial' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Trial Days *</label>
                    <input
                      type="number"
                      value={formData.trial_days}
                      onChange={(e) => setFormData(prev => ({ ...prev, trial_days: e.target.value }))}
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                      placeholder="30"
                    />
                  </div>
                )}
                {formData.campaign_type === 'discount' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Discount %</label>
                      <input
                        type="number"
                        value={formData.discount_percentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount_percentage: e.target.value }))}
                        className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                        placeholder="20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Or Fixed Amount ($)</label>
                      <input
                        type="number"
                        value={formData.discount_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount_amount: e.target.value }))}
                        className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                        placeholder="5.00"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max Redemptions</label>
                  <input
                    type="number"
                    value={formData.max_redemptions}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_redemptions: e.target.value }))}
                    className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                    placeholder="100 (leave empty for unlimited)"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Start Date</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target Audience</label>
                <select
                  value={formData.target_user_segment}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_user_segment: e.target.value }))}
                  className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="new_users">New Users Only</option>
                  <option value="all_users">All Users</option>
                  <option value="investigators">Investigators Only</option>
                  <option value="first_100">First 100 Users</option>
                </select>
              </div>

              {/* Marketing Content */}
              <div className="border-t border-mystery-700 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Marketing Content</h3>
                  <button
                    onClick={() => {
                      setSelectedCampaign(null);
                      setShowAIModal(true);
                    }}
                    className="bg-mystery-700 hover:bg-mystery-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate with AI
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Banner Text</label>
                    <input
                      type="text"
                      value={formData.banner_text}
                      onChange={(e) => setFormData(prev => ({ ...prev, banner_text: e.target.value }))}
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                      placeholder="🎉 Special offer for early users!"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Landing Page Text</label>
                    <textarea
                      value={formData.landing_page_text}
                      onChange={(e) => setFormData(prev => ({ ...prev, landing_page_text: e.target.value }))}
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                      rows={3}
                      placeholder="Detailed description for the landing page..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">CTA Button Text</label>
                    <input
                      type="text"
                      value={formData.cta_button_text}
                      onChange={(e) => setFormData(prev => ({ ...prev, cta_button_text: e.target.value }))}
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                      placeholder="Claim Now"
                    />
                  </div>
                </div>
              </div>

              {/* Promo Code Requirement */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requires_code"
                  checked={formData.requires_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, requires_code: e.target.checked }))}
                  className="w-4 h-4 text-mystery-500 bg-mystery-900 border-mystery-700 rounded focus:ring-mystery-500"
                />
                <label htmlFor="requires_code" className="text-sm text-gray-300">
                  Requires promo code to redeem
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-6 border-t border-mystery-700">
                <button
                  onClick={createCampaign}
                  className="flex-1 bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Create Campaign
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-6 py-3 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promo Codes Modal */}
      {showCodeModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-mystery-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-mystery-800 border-b border-mystery-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Tag className="w-6 h-6 text-mystery-500" />
                Promo Codes: {selectedCampaign.name}
              </h2>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Create New Code Form */}
              <div className="bg-mystery-900/50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-white mb-4">Create New Promo Code</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Code *</label>
                    <input
                      type="text"
                      value={codeFormData.code}
                      onChange={(e) => setCodeFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white uppercase"
                      placeholder="WELCOME100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Max Total Uses</label>
                    <input
                      type="number"
                      value={codeFormData.max_uses}
                      onChange={(e) => setCodeFormData(prev => ({ ...prev, max_uses: e.target.value }))}
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Max Uses Per User</label>
                    <input
                      type="number"
                      value={codeFormData.max_uses_per_user}
                      onChange={(e) => setCodeFormData(prev => ({ ...prev, max_uses_per_user: e.target.value }))}
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                </div>
                <button
                  onClick={createPromoCode}
                  className="w-full bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Create Promo Code
                </button>
              </div>

              {/* Existing Codes List */}
              <div>
                <h3 className="font-semibold text-white mb-4">Existing Promo Codes</h3>
                {promoCodes.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No promo codes yet. Create one above!</p>
                ) : (
                  <div className="space-y-3">
                    {promoCodes.map(code => (
                      <div
                        key={code.id}
                        className="bg-mystery-900/50 p-4 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <code className="text-lg font-mono font-bold text-mystery-400">{code.code}</code>
                            {code.is_active ? (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                            ) : (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Inactive</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400">
                            Uses: {code.current_uses} / {code.max_uses || '∞'} 
                            {' • '}
                            Max per user: {code.max_uses_per_user}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(code.code, code.id)}
                          className="bg-mystery-700 hover:bg-mystery-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          {copiedCode === code.id ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Generation Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-mystery-800 rounded-lg max-w-2xl w-full">
            <div className="border-b border-mystery-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-mystery-500" />
                AI Content Generator
              </h2>
              <button
                onClick={() => setShowAIModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
                <select
                  value={aiContentType}
                  onChange={(e) => setAiContentType(e.target.value as any)}
                  className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="banner_text">Banner Text</option>
                  <option value="landing_text">Landing Page Text</option>
                  <option value="ad_copy">Ad Copy</option>
                  <option value="banner_image">Banner Image (Coming Soon)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Prompt</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-2 text-white"
                  rows={4}
                  placeholder="e.g., Create an exciting banner text for a first 100 users promotion offering 10 free investigation credits"
                />
              </div>

              {generatedContent && (
                <div className="bg-mystery-900/50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Generated Content</label>
                  <div className="text-white whitespace-pre-wrap">{generatedContent}</div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <button
                  onClick={generateWithAI}
                  disabled={generatingAI}
                  className="flex-1 bg-mystery-500 hover:bg-mystery-600 disabled:bg-mystery-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {generatingAI ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate
                    </>
                  )}
                </button>
                {generatedContent && (
                  <button
                    onClick={applyAIContent}
                    className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-semibold transition-colors"
                  >
                    Apply to Campaign
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
