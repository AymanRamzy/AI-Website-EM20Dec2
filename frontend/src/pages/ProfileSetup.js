import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  User, Globe, Phone, Briefcase, Linkedin, Award, 
  ChevronRight, Check, Loader, AlertCircle 
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Certification options
const CERTIFICATIONS = [
  { value: 'CMA', label: 'CMA – Certified Management Accountant' },
  { value: 'CFA', label: 'CFA – Chartered Financial Analyst' },
  { value: 'CPA', label: 'CPA – Certified Public Accountant' },
  { value: 'ACCA', label: 'ACCA – Association of Chartered Certified Accountants' },
  { value: 'CIMA', label: 'CIMA – Chartered Institute of Management Accountants' },
  { value: 'FMVA', label: 'FMVA – Financial Modeling & Valuation Analyst' },
  { value: 'AFM', label: 'AFM – Advanced Financial Modeler' },
  { value: 'CFM', label: 'CFM – Chartered Financial Modeler' },
  { value: 'FRM', label: 'FRM – Financial Risk Manager' },
  { value: 'CIA', label: 'CIA – Certified Internal Auditor' },
  { value: 'SOCPA', label: 'SOCPA – Saudi Organization for Chartered and Professional Accountants' },
  { value: 'CA', label: 'CA – Chartered Accountant' },
  { value: 'Other', label: 'Other' }
];

const INDUSTRIES = [
  { value: 'banking', label: 'Banking' },
  { value: 'investment', label: 'Investment' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'corporate_finance', label: 'Corporate Finance' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'energy', label: 'Energy' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'government', label: 'Government' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' }
];

const EXPERIENCE_LEVELS = [
  { value: '0-1', label: 'Less than 1 year' },
  { value: '1-3', label: '1-3 years' },
  { value: '3-5', label: '3-5 years' },
  { value: '5-10', label: '5-10 years' },
  { value: '10+', label: '10+ years' }
];

const CERT_STATUS = [
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'level_passed', label: 'Level Passed' }
];

function ProfileSetup() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState({
    country: '',
    preferred_language: 'en',
    mobile_number: '',
    whatsapp_enabled: false,
    job_title: '',
    company_name: '',
    industry: '',
    years_of_experience: '',
    linkedin_url: '',
    certifications: []
  });

  // Check if profile already completed
  useEffect(() => {
    const checkProfile = async () => {
      if (!token) return;
      try {
        const response = await axios.get(`${API_URL}/api/cfo/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.profile_completed) {
          navigate('/dashboard');
        } else {
          // Pre-fill existing data
          const profile = response.data;
          setFormData(prev => ({
            ...prev,
            country: profile.country || '',
            preferred_language: profile.preferred_language || 'en',
            mobile_number: profile.mobile_number || '',
            whatsapp_enabled: profile.whatsapp_enabled || false,
            job_title: profile.job_title || '',
            company_name: profile.company_name || '',
            industry: profile.industry || '',
            years_of_experience: profile.years_of_experience || '',
            linkedin_url: profile.linkedin_url || '',
            certifications: profile.certifications || []
          }));
        }
      } catch (err) {
        console.error('Failed to check profile:', err);
      }
    };
    checkProfile();
  }, [token, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const addCertification = () => {
    setFormData(prev => ({
      ...prev,
      certifications: [...prev.certifications, { name: '', status: 'completed', year: null }]
    }));
  };

  const updateCertification = (index, field, value) => {
    setFormData(prev => {
      const newCerts = [...prev.certifications];
      newCerts[index] = { ...newCerts[index], [field]: value };
      return { ...prev, certifications: newCerts };
    });
  };

  const removeCertification = (index) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };

  const validateStep = (stepNum) => {
    switch (stepNum) {
      case 1:
        return formData.country && formData.preferred_language && formData.mobile_number;
      case 2:
        return formData.job_title && formData.company_name && formData.industry && formData.years_of_experience;
      case 3:
        return true; // Optional step
      default:
        return true;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Filter out empty certifications
      const validCerts = formData.certifications.filter(c => c.name);
      
      const payload = {
        ...formData,
        certifications: validCerts
      };

      await axios.put(`${API_URL}/api/cfo/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Force reload user data and redirect
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.detail || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-modex-primary via-modex-secondary to-modex-accent py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-2">
            Mod<span className="text-yellow-400">EX</span>
          </h1>
          <h2 className="text-xl font-bold text-white/90">Complete Your Profile</h2>
          <p className="text-white/70 mt-2">
            Welcome{user?.full_name ? `, ${user.full_name}` : ''}! Please complete your profile to continue.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                  step >= s 
                    ? 'bg-yellow-400 text-modex-primary' 
                    : 'bg-white/20 text-white/50'
                }`}
              >
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-1 mx-2 ${step > s ? 'bg-yellow-400' : 'bg-white/20'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Personal & Contact */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <Globe className="w-6 h-6 text-modex-secondary" />
                  <h3 className="text-xl font-bold text-modex-primary">Personal & Contact</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Saudi Arabia"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-modex-secondary focus:border-transparent"
                    data-testid="country-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language *</label>
                  <select
                    name="preferred_language"
                    value={formData.preferred_language}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-modex-secondary focus:border-transparent"
                    data-testid="language-select"
                  >
                    <option value="en">English</option>
                    <option value="ar">العربية (Arabic)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    name="mobile_number"
                    value={formData.mobile_number}
                    onChange={handleChange}
                    required
                    placeholder="+966 5X XXX XXXX"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-modex-secondary focus:border-transparent"
                    data-testid="mobile-input"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="whatsapp_enabled"
                    name="whatsapp_enabled"
                    checked={formData.whatsapp_enabled}
                    onChange={handleChange}
                    className="w-5 h-5 text-modex-secondary rounded focus:ring-modex-secondary"
                    data-testid="whatsapp-checkbox"
                  />
                  <label htmlFor="whatsapp_enabled" className="text-sm text-gray-700">
                    <Phone className="w-4 h-4 inline mr-1 text-green-500" />
                    This number is on WhatsApp
                  </label>
                </div>
              </div>
            )}

            {/* Step 2: Professional Info */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <Briefcase className="w-6 h-6 text-modex-secondary" />
                  <h3 className="text-xl font-bold text-modex-primary">Professional Information</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                  <input
                    type="text"
                    name="job_title"
                    value={formData.job_title}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Financial Analyst"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-modex-secondary focus:border-transparent"
                    data-testid="job-title-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Saudi Aramco"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-modex-secondary focus:border-transparent"
                    data-testid="company-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry *</label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-modex-secondary focus:border-transparent"
                    data-testid="industry-select"
                  >
                    <option value="">Select Industry</option>
                    {INDUSTRIES.map(ind => (
                      <option key={ind.value} value={ind.value}>{ind.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience *</label>
                  <select
                    name="years_of_experience"
                    value={formData.years_of_experience}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-modex-secondary focus:border-transparent"
                    data-testid="experience-select"
                  >
                    <option value="">Select Experience</option>
                    {EXPERIENCE_LEVELS.map(exp => (
                      <option key={exp.value} value={exp.value}>{exp.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Linkedin className="w-4 h-4 inline mr-1 text-blue-600" />
                    LinkedIn Profile (Optional)
                  </label>
                  <input
                    type="url"
                    name="linkedin_url"
                    value={formData.linkedin_url}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-modex-secondary focus:border-transparent"
                    data-testid="linkedin-input"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Certifications (Optional) */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <Award className="w-6 h-6 text-modex-secondary" />
                  <h3 className="text-xl font-bold text-modex-primary">Professional Certifications</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  This section is optional. Add any professional financial certifications you hold or are pursuing.
                </p>

                {formData.certifications.map((cert, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Certification #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeCertification(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <select
                      value={cert.name}
                      onChange={(e) => updateCertification(index, 'name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      data-testid={`cert-name-${index}`}
                    >
                      <option value="">Select Certification</option>
                      {CERTIFICATIONS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={cert.status}
                        onChange={(e) => updateCertification(index, 'status', e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg"
                        data-testid={`cert-status-${index}`}
                      >
                        {CERT_STATUS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        value={cert.year || ''}
                        onChange={(e) => updateCertification(index, 'year', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Year (optional)"
                        min="1990"
                        max={new Date().getFullYear()}
                        className="px-4 py-2 border border-gray-300 rounded-lg"
                        data-testid={`cert-year-${index}`}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addCertification}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-modex-secondary hover:text-modex-secondary transition-colors"
                  data-testid="add-certification-btn"
                >
                  + Add Certification
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 text-gray-600 hover:text-modex-primary font-medium"
                >
                  ← Back
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!validateStep(step)}
                  className="px-8 py-3 bg-modex-secondary text-white rounded-lg font-bold hover:bg-modex-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  data-testid="next-step-btn"
                >
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-modex-secondary text-white rounded-lg font-bold hover:bg-modex-primary transition-colors disabled:opacity-50 flex items-center gap-2"
                  data-testid="complete-profile-btn"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Complete Profile <Check className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Footer Note */}
        <p className="text-center text-white/60 text-sm mt-6">
          Your information is secure and will only be used for ModEX platform purposes.
        </p>
      </div>
    </div>
  );
}

export default ProfileSetup;
