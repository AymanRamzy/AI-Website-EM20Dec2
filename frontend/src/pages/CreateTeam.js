import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Trophy, Users, ArrowLeft, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function CreateTeam() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCompetitions();
  }, []);

  const loadCompetitions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/cfo/competitions`);
      
      // Check registration status for each competition
      const competitionsWithRegistration = await Promise.all(
        response.data.map(async (comp) => {
          try {
            const regResponse = await axios.get(
              `${API_URL}/api/cfo/competitions/${comp.id}/is-registered`
            );
            return { ...comp, isRegistered: regResponse.data.is_registered };
          } catch {
            return { ...comp, isRegistered: false };
          }
        })
      );
      
      // Filter: registered, open for registration, not full
      const availableCompetitions = competitionsWithRegistration.filter(
        (comp) => 
          comp.isRegistered &&
          comp.status === 'registration_open' && 
          comp.registered_teams < comp.max_teams
      );
      setCompetitions(availableCompetitions);
    } catch (error) {
      console.error('Failed to load competitions:', error);
      setError('Failed to load competitions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedCompetition) {
      setError('Please select a competition');
      return;
    }

    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }

    setSubmitting(true);

    try {
      const response = await axios.post(`${API_URL}/api/cfo/teams`, {
        competition_id: selectedCompetition,
        team_name: teamName.trim(),
      });

      // Redirect to team details page
      navigate(`/teams/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create team:', error);
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to create team. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCompetitionData = competitions.find(
    (comp) => comp.id === selectedCompetition
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-modex-secondary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Link
              to="/dashboard"
              className="text-modex-secondary hover:text-modex-primary transition-colors mr-4"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-bold text-modex-primary">
              Create New Team
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {competitions.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border-2 border-gray-200">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              No Competitions Available
            </h3>
            <p className="text-gray-600 mb-6">
              You haven't registered for any competitions yet, or all competitions are full.
              Please register for a competition first.
            </p>
            <Link
              to="/dashboard"
              className="inline-block bg-modex-secondary text-white px-6 py-3 rounded-lg font-bold hover:bg-modex-primary transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 border-2 border-gray-200">
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Competition Selection */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-modex-primary mb-2">
                  Select Competition *
                </label>
                <select
                  value={selectedCompetition}
                  onChange={(e) => setSelectedCompetition(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-modex-secondary focus:outline-none transition-colors"
                  required
                >
                  <option value="">-- Choose a competition --</option>
                  {competitions.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.title} ({comp.registered_teams}/{comp.max_teams} teams)
                    </option>
                  ))}
                </select>
              </div>

              {/* Competition Details */}
              {selectedCompetitionData && (
                <div className="mb-6 bg-modex-light p-4 rounded-lg">
                  <h4 className="font-bold text-modex-primary mb-2">
                    {selectedCompetitionData.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {selectedCompetitionData.description}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Registration Deadline:</span>
                      <p className="font-semibold text-modex-primary">
                        {new Date(selectedCompetitionData.registration_deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Available Slots:</span>
                      <p className="font-semibold text-modex-primary">
                        {selectedCompetitionData.max_teams - selectedCompetitionData.registered_teams} teams left
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Name */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-modex-primary mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter your team name"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-modex-secondary focus:outline-none transition-colors"
                  required
                  maxLength={50}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a unique and memorable name for your team
                </p>
              </div>

              {/* Info Box */}
              <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Team Information
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• You will be the team leader</li>
                  <li>• Maximum 5 members per team</li>
                  <li>• Share your team ID with others to invite them</li>
                  <li>• You can assign roles to team members</li>
                </ul>
              </div>

              {/* Buttons */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-modex-accent text-white rounded-lg font-bold hover:bg-modex-primary transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateTeam;
