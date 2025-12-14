import React, { useState } from 'react';
import { Mail, Shield, Users, FileText } from 'lucide-react';

export const AboutUs: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-12">
    <div className="text-center mb-12">
      <h1 className="text-4xl font-bold text-white mb-4">About Unexplained Archive</h1>
      <p className="text-xl text-gray-400">Illuminating the shadows through community collaboration and scientific rigor.</p>
    </div>
    
    <div className="space-y-12">
      <div className="bg-mystery-800 p-8 rounded-xl border border-mystery-700">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="text-mystery-accent" /> Our Mission
        </h2>
        <p className="text-gray-300 leading-relaxed">
          The Unexplained Archive (UA) was founded to create a centralized, trusted repository for phenomena that defy conventional explanation. 
          Unlike traditional forums, we bridge the gap between eyewitness accounts and professional investigation. By combining social connectivity 
          with structured case management, we aim to filter out noise and focus on finding the truth.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <Users className="w-8 h-8 text-mystery-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Community First</h3>
          <p className="text-gray-400">
            We believe that everyone's story matters. Our platform provides a safe, moderated space for witnesses to share their experiences without fear of ridicule.
          </p>
        </div>
        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <FileText className="w-8 h-8 text-green-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Rigorous Investigation</h3>
          <p className="text-gray-400">
            Verified investigators use our specialized tools to analyze evidence, correlate data points, and provide expert insights into submitted cases.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export const ContactUs: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    category: 'general',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-contact-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setSubmitted(true);
      setFormData({ name: '', email: '', message: '', category: 'general' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error sending message. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-mystery-800 p-8 rounded-xl border border-mystery-700 shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <Mail className="text-mystery-accent" /> Contact Us
        </h1>
        <p className="text-gray-400 mb-8">
          Have questions about the platform? Found a bug? Need to report an issue? Reach out to our team.
        </p>

        {submitted && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-600 rounded-lg text-green-300">
            ✓ Your message was sent successfully! We'll respond soon.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-600 rounded-lg text-red-300">
            ✗ Error: {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
              placeholder="your.email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
            >
              <option value="general">General Inquiry</option>
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="support">Technical Support</option>
              <option value="abuse">Report Abuse</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Message
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={5}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 outline-none resize-none"
              placeholder="How can we help?"
            ></textarea>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-mystery-500 hover:bg-mystery-400 disabled:bg-mystery-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const TermsAndConditions: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-12 text-gray-300">
    <h1 className="text-3xl font-bold text-white mb-8">Terms of Service & Privacy Policy</h1>
    
    <div className="space-y-8 bg-mystery-800 p-8 rounded-xl border border-mystery-700">
      <section>
        <h2 className="text-xl font-bold text-white mb-3">1. User Content & Submissions</h2>
        <p>
          By submitting a case, story, or media to Unexplained Archive, you grant us a license to display, distribute, and analyze the content. 
          You retain ownership of your original work. Falsified reports intended to deceive may result in account suspension.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">2. Privacy & Data</h2>
        <p>
          We take your privacy seriously. Location data is fuzzed for public view to protect privacy unless explicitly allowed. 
          We do not sell user data to third parties. All case data is stored securely.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">3. Community Guidelines</h2>
        <p>
          Harassment, hate speech, and trolling are strictly prohibited. This is a place for curiosity and investigation. 
          Admins reserve the right to ban users who violate these terms.
        </p>
      </section>
      
      <section>
        <h2 className="text-xl font-bold text-white mb-3">4. Disclaimer</h2>
        <p>
          Content on this site is user-generated. Unexplained Archive does not guarantee the authenticity of any case or the accuracy of investigator analysis.
        </p>
      </section>
    </div>
  </div>
);