import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader,
  Award,
  Brain,
  TrendingUp,
  Shield,
  Send
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Step configurations
const STEPS = [
  { id: 1, title: 'Leadership Profile', icon: Award, description: 'Your experience and leadership readiness' },
  { id: 2, title: 'Judgment & Capital', icon: TrendingUp, description: 'Capital allocation and business judgment' },
  { id: 3, title: 'Financial Reality', icon: Brain, description: 'Decision-making under pressure' },
  { id: 4, title: 'Ethics & Ownership', icon: Shield, description: 'Values and final commitment' }
];

// Reusable RadioOption component
const RadioOption = ({ name, value, label, description, selected, onChange }) => (
  <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
    selected ? 'border-modex-secondary bg-modex-secondary/5' : 'border-gray-200 hover:border-gray-300'
  }`}>
    <div className="flex items-start">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="mt-1 text-modex-secondary focus:ring-modex-secondary"
      />
      <div className="ml-3">
        <span className="font-semibold text-gray-800">{label}</span>
        {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
      </div>
    </div>
  </label>
);

// Reusable TextArea component
const TextAreaField = ({ label, value, onChange, maxLength, minLength, placeholder, rows = 3 }) => (
  <div>
    <label className="block font-semibold text-gray-800 mb-2">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-modex-secondary focus:outline-none resize-none"
    />
    <div className="flex justify-between mt-1 text-xs text-gray-500">
      <span>{value.length < minLength ? `Minimum ${minLength} characters required` : ''}</span>
      <span>{value.length}/{maxLength}</span>
    </div>
  </div>
);

function CFOApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { competitionId } = useParams();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    // Step 1
    experience_years: '',
    leadership_exposure: '',
    decision_ownership: '',
    leadership_willingness: '',
    commitment_level: '',
    // Step 2
    capital_allocation: '',
    capital_justification: '',
    cash_vs_profit: '',
    kpi_prioritization: '',
    // Step 3
    dscr_choice: '',
    dscr_impact: '',
    cost_priority: '',
    cfo_mindset: '',
    mindset_explanation: '',
    // Step 4
    ethics_choice: '',
    culture_vs_results: '',
    why_top_100: ''
  });

  useEffect(() => {
    checkEligibility();
  }, [competitionId]);

  const checkEligibility = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cfo/applications/eligibility`, {
        params: { competition_id: competitionId }
      });
      setEligibility(response.data);
    } catch (err) {
      setError('Failed to check eligibility');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isStepValid = (step) => {
    switch (step) {
      case 1:
        return formData.experience_years && formData.leadership_exposure && 
               formData.decision_ownership && formData.leadership_willingness && 
               formData.commitment_level;
      case 2:
        return formData.capital_allocation && formData.capital_justification.length >= 50 &&
               formData.cash_vs_profit.length >= 50 && formData.kpi_prioritization.length >= 50;
      case 3:
        return formData.dscr_choice && formData.dscr_impact.length >= 30 &&
               formData.cost_priority && formData.cfo_mindset && 
               formData.mindset_explanation.length >= 30;
      case 4:
        return formData.ethics_choice && formData.culture_vs_results && 
               formData.why_top_100.length >= 100;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const applicationData = {
        competition_id: competitionId,
        step1: {
          experience_years: formData.experience_years,
          leadership_exposure: formData.leadership_exposure,
          decision_ownership: formData.decision_ownership,
          leadership_willingness: formData.leadership_willingness,
          commitment_level: formData.commitment_level
        },
        step2: {
          capital_allocation: formData.capital_allocation,
          capital_justification: formData.capital_justification,
          cash_vs_profit: formData.cash_vs_profit,
          kpi_prioritization: formData.kpi_prioritization
        },
        step3: {
          dscr_choice: formData.dscr_choice,
          dscr_impact: formData.dscr_impact,
          cost_priority: formData.cost_priority,
          cfo_mindset: formData.cfo_mindset,
          mindset_explanation: formData.mindset_explanation
        },
        step4: {
          ethics_choice: formData.ethics_choice,
          culture_vs_results: formData.culture_vs_results,
          why_top_100: formData.why_top_100
        }
      };

      await axios.post(`${API_URL}/api/cfo/applications/submit`, applicationData);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  // Render helpers
  const RadioOption = ({ name, value, label, description, selected, onChange }) => (
    <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
      selected ? 'border-modex-secondary bg-modex-secondary/5' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="flex items-start">
        <input
          type="radio"
          name={name}
          value={value}
          checked={selected}
          onChange={() => onChange(value)}
          className="mt-1 text-modex-secondary focus:ring-modex-secondary"
        />
        <div className="ml-3">
          <span className="font-semibold text-gray-800">{label}</span>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
      </div>
    </label>
  );

  const TextArea = ({ label, value, onChange, maxLength, minLength, placeholder, rows = 3 }) => (
    <div>
      <label className="block font-semibold text-gray-800 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-modex-secondary focus:outline-none resize-none"
      />
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>{value.length < minLength ? `Minimum ${minLength} characters required` : ''}</span>
        <span>{value.length}/{maxLength}</span>
      </div>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-modex-secondary mx-auto mb-4" />
          <p className="text-gray-600">Checking eligibility...</p>
        </div>
      </div>
    );
  }

  // Not eligible
  if (eligibility && !eligibility.eligible) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl p-8 shadow-sm border-2 border-red-200">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Not Eligible to Apply
            </h2>
            <div className="bg-red-50 rounded-lg p-4 mb-6">
              <ul className="space-y-2">
                {eligibility.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start text-red-800">
                    <span className="mr-2">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Requirements:</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className={eligibility.checks.is_team_leader ? 'text-green-600' : ''}>
                  {eligibility.checks.is_team_leader ? '✓' : '○'} You must be a team leader
                </li>
                <li className={eligibility.checks.team_complete ? 'text-green-600' : ''}>
                  {eligibility.checks.team_complete ? '✓' : '○'} Team must have 5 members
                </li>
                <li className={eligibility.checks.roles_assigned ? 'text-green-600' : ''}>
                  {eligibility.checks.roles_assigned ? '✓' : '○'} All team members must have roles
                </li>
                <li className={eligibility.checks.applications_open ? 'text-green-600' : ''}>
                  {eligibility.checks.applications_open ? '✓' : '○'} Applications must be open
                </li>
              </ul>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 w-full bg-modex-secondary text-white py-3 rounded-lg font-bold hover:bg-modex-primary transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Submitted successfully
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl p-8 shadow-sm border-2 border-green-200">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Application Submitted Successfully!
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Your CFO leadership application has been received and is under review.
              You will be notified of the results when applications close.
            </p>
            <div className="bg-modex-light rounded-lg p-4 mb-6">
              <p className="text-sm text-modex-primary text-center">
                <strong>Note:</strong> Top 100 qualified candidates will be announced after all applications are reviewed.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-modex-secondary text-white py-3 rounded-lg font-bold hover:bg-modex-primary transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center">
            <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-600 hover:text-modex-secondary">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-modex-primary">CFO Leadership Application</h1>
              <p className="text-sm text-gray-600">Complete all 4 sections • ~15-20 minutes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep;
              
              return (
                <div key={step.id} className={`flex-1 text-center ${step.id < 4 ? 'border-r border-gray-200' : ''}`}>
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 ${
                    isActive ? 'bg-modex-secondary text-white' :
                    isComplete ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isComplete ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <p className={`text-xs font-semibold ${isActive ? 'text-modex-secondary' : 'text-gray-500'}`}>
                    {step.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
          {/* Step 1: Leadership Profile */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-modex-primary mb-1">Leadership Profile</h2>
                <p className="text-gray-600">Tell us about your experience and readiness to lead.</p>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">Years of Professional Experience</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'less_than_2', label: 'Less than 2 years' },
                    { value: '2_to_5', label: '2-5 years' },
                    { value: '5_to_10', label: '5-10 years' },
                    { value: 'more_than_10', label: '10+ years' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="experience_years"
                      value={opt.value}
                      label={opt.label}
                      selected={formData.experience_years === opt.value}
                      onChange={(v) => handleInputChange('experience_years', v)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">Leadership Exposure</label>
                <div className="space-y-3">
                  {[
                    { value: 'none', label: 'No formal leadership role yet', description: 'Individual contributor' },
                    { value: 'team_lead', label: 'Team Lead', description: 'Led small teams or projects' },
                    { value: 'department_head', label: 'Department Head', description: 'Managed department or division' },
                    { value: 'c_suite', label: 'C-Suite / Executive', description: 'Senior executive experience' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="leadership_exposure"
                      value={opt.value}
                      label={opt.label}
                      description={opt.description}
                      selected={formData.leadership_exposure === opt.value}
                      onChange={(v) => handleInputChange('leadership_exposure', v)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">How do you typically handle critical decisions?</label>
                <div className="space-y-3">
                  {[
                    { value: 'avoid', label: 'I prefer to avoid making critical decisions' },
                    { value: 'delegate', label: 'I delegate to others who are more qualified' },
                    { value: 'own_with_support', label: 'I own decisions but seek input from others' },
                    { value: 'full_ownership', label: 'I take full ownership and accountability' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="decision_ownership"
                      value={opt.value}
                      label={opt.label}
                      selected={formData.decision_ownership === opt.value}
                      onChange={(v) => handleInputChange('decision_ownership', v)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">How ready are you to take on CFO-level responsibilities?</label>
                <div className="space-y-3">
                  {[
                    { value: 'not_interested', label: 'Not interested at this time' },
                    { value: 'maybe_later', label: 'Maybe in the future' },
                    { value: 'ready_with_guidance', label: 'Ready with mentorship and guidance' },
                    { value: 'fully_ready', label: 'Fully ready to lead now' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="leadership_willingness"
                      value={opt.value}
                      label={opt.label}
                      selected={formData.leadership_willingness === opt.value}
                      onChange={(v) => handleInputChange('leadership_willingness', v)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">What is your commitment level to this competition?</label>
                <div className="space-y-3">
                  {[
                    { value: 'exploring', label: 'Just exploring' },
                    { value: 'partially_committed', label: 'Partially committed' },
                    { value: 'highly_committed', label: 'Highly committed' },
                    { value: 'all_in', label: 'All in - this is my priority' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="commitment_level"
                      value={opt.value}
                      label={opt.label}
                      selected={formData.commitment_level === opt.value}
                      onChange={(v) => handleInputChange('commitment_level', v)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Judgment & Capital Allocation */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-modex-primary mb-1">Judgment & Capital Allocation</h2>
                <p className="text-gray-600">Demonstrate your business judgment and capital allocation thinking.</p>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">
                  Your company has $10M in excess cash. How would you allocate it?
                </label>
                <div className="space-y-3">
                  {[
                    { value: 'safe_investment', label: 'Safe investments (bonds, treasury)', description: 'Preserve capital, minimal risk' },
                    { value: 'moderate_risk', label: 'Balanced portfolio', description: 'Mix of growth and safety' },
                    { value: 'growth_investment', label: 'Growth investments', description: 'R&D, new markets, strategic initiatives' },
                    { value: 'aggressive_expansion', label: 'Aggressive expansion', description: 'Acquisitions, major market moves' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="capital_allocation"
                      value={opt.value}
                      label={opt.label}
                      description={opt.description}
                      selected={formData.capital_allocation === opt.value}
                      onChange={(v) => handleInputChange('capital_allocation', v)}
                    />
                  ))}
                </div>
              </div>

              <TextArea
                label="Justify your capital allocation choice (max 3 lines)"
                value={formData.capital_justification}
                onChange={(v) => handleInputChange('capital_justification', v)}
                maxLength={300}
                minLength={50}
                placeholder="Explain your reasoning for this allocation strategy..."
              />

              <TextArea
                label="A startup is profitable on paper but has negative cash flow. What's happening and what would you do?"
                value={formData.cash_vs_profit}
                onChange={(v) => handleInputChange('cash_vs_profit', v)}
                maxLength={500}
                minLength={50}
                placeholder="Explain the cash vs profit dynamics and your approach..."
                rows={4}
              />

              <TextArea
                label="Revenue dropped 20% this quarter. Which KPIs would you prioritize and why?"
                value={formData.kpi_prioritization}
                onChange={(v) => handleInputChange('kpi_prioritization', v)}
                maxLength={500}
                minLength={50}
                placeholder="Describe your KPI prioritization strategy..."
                rows={4}
              />
            </div>
          )}

          {/* Step 3: Financial Reality Under Pressure */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-modex-primary mb-1">Financial Reality Under Pressure</h2>
                <p className="text-gray-600">How do you make decisions when facing real financial constraints?</p>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">
                  Your DSCR is below covenant. Lenders are watching. What do you do?
                </label>
                <div className="space-y-3">
                  {[
                    { value: 'prioritize_debt', label: 'Prioritize debt payments', description: 'Cut all non-essential spending' },
                    { value: 'balance_both', label: 'Balance debt and operations', description: 'Careful trade-offs' },
                    { value: 'prioritize_growth', label: 'Prioritize growth', description: 'Debt can wait, growth cannot' },
                    { value: 'renegotiate', label: 'Renegotiate with lenders', description: 'Proactive communication and restructuring' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="dscr_choice"
                      value={opt.value}
                      label={opt.label}
                      description={opt.description}
                      selected={formData.dscr_choice === opt.value}
                      onChange={(v) => handleInputChange('dscr_choice', v)}
                    />
                  ))}
                </div>
              </div>

              <TextArea
                label="What is the short-term impact of your choice?"
                value={formData.dscr_impact}
                onChange={(v) => handleInputChange('dscr_impact', v)}
                maxLength={200}
                minLength={30}
                placeholder="Describe the immediate effects..."
                rows={2}
              />

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">
                  You must cut costs by 15% immediately. What&apos;s your first priority?
                </label>
                <div className="space-y-3">
                  {[
                    { value: 'cut_people', label: 'Reduce headcount', description: 'Layoffs and hiring freeze' },
                    { value: 'cut_marketing', label: 'Cut marketing spend', description: 'Reduce advertising and promotion' },
                    { value: 'optimize_operations', label: 'Optimize operations', description: 'Process improvements, automation' },
                    { value: 'renegotiate_vendors', label: 'Renegotiate vendor contracts', description: 'Better terms with suppliers' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="cost_priority"
                      value={opt.value}
                      label={opt.label}
                      description={opt.description}
                      selected={formData.cost_priority === opt.value}
                      onChange={(v) => handleInputChange('cost_priority', v)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">
                  How do you see the modern CFO role?
                </label>
                <div className="space-y-3">
                  {[
                    { value: 'number_cruncher', label: 'Number Cruncher', description: 'Focus on accuracy and compliance' },
                    { value: 'business_partner', label: 'Business Partner', description: 'Support other functions with data' },
                    { value: 'strategic_advisor', label: 'Strategic Advisor', description: 'Guide company strategy with financial insight' },
                    { value: 'chief_value_officer', label: 'Chief Value Officer', description: 'Drive value creation across the organization' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="cfo_mindset"
                      value={opt.value}
                      label={opt.label}
                      description={opt.description}
                      selected={formData.cfo_mindset === opt.value}
                      onChange={(v) => handleInputChange('cfo_mindset', v)}
                    />
                  ))}
                </div>
              </div>

              <TextArea
                label="Explain your view of the CFO role in one line"
                value={formData.mindset_explanation}
                onChange={(v) => handleInputChange('mindset_explanation', v)}
                maxLength={150}
                minLength={30}
                placeholder="What makes a great CFO..."
                rows={2}
              />
            </div>
          )}

          {/* Step 4: Ethics & Final Ownership */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-modex-primary mb-1">Ethics & Final Ownership</h2>
                <p className="text-gray-600">Your values and commitment to leadership integrity.</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> This section evaluates your ethical judgment. 
                  There are no trick questions - we&apos;re looking for leaders who do the right thing.
                </p>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">
                  You discover a financial irregularity that could impact the company&apos;s reported earnings. What do you do?
                </label>
                <div className="space-y-3">
                  {[
                    { value: 'report_immediately', label: 'Report immediately to the board and audit committee' },
                    { value: 'investigate_first', label: 'Investigate first, then report with findings' },
                    { value: 'consult_legal', label: 'Consult legal counsel before any action' },
                    { value: 'adjust_quietly', label: 'Adjust quietly if the impact is small' },
                    { value: 'do_nothing', label: 'Do nothing - not my direct responsibility' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="ethics_choice"
                      value={opt.value}
                      label={opt.label}
                      selected={formData.ethics_choice === opt.value}
                      onChange={(v) => handleInputChange('ethics_choice', v)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold text-gray-800 mb-2">
                  A high performer on your team consistently delivers results but creates a toxic environment. What do you prioritize?
                </label>
                <div className="space-y-3">
                  {[
                    { value: 'results_first', label: 'Results first - the numbers speak for themselves' },
                    { value: 'culture_first', label: 'Culture first - toxic behavior cannot be tolerated' },
                    { value: 'balance_both', label: 'Balance both - coach the behavior while retaining talent' },
                    { value: 'depends_on_situation', label: 'It depends on the specific situation' }
                  ].map(opt => (
                    <RadioOption
                      key={opt.value}
                      name="culture_vs_results"
                      value={opt.value}
                      label={opt.label}
                      selected={formData.culture_vs_results === opt.value}
                      onChange={(v) => handleInputChange('culture_vs_results', v)}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <TextArea
                  label="Why do you deserve to be among the Top 100 future CFO leaders? (Max 3 lines)"
                  value={formData.why_top_100}
                  onChange={(v) => handleInputChange('why_top_100', v)}
                  maxLength={300}
                  minLength={100}
                  placeholder="Tell us what makes you stand out as a future CFO leader..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="flex items-center px-6 py-3 text-gray-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:text-modex-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>

            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid(currentStep)}
                className="flex items-center px-6 py-3 bg-modex-secondary text-white font-bold rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-modex-primary transition-colors"
              >
                Next
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!isStepValid(4) || submitting}
                className="flex items-center px-8 py-3 bg-green-600 text-white font-bold rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Submit Application
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CFOApplication;
