import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  Award,
  User,
  Mail,
  Trophy,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader,
  Eye,
  Users,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function CFOApplicationsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadApplications();
  }, [competitionId]);

  const loadApplications = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/competitions/${competitionId}/cfo-applications`
      );
      setData(response.data);
    } catch (err) {
      console.error('Failed to load applications:', err);
      if (err.response?.status === 403) {
        setError('You do not have permission to view this page');
      } else {
        setError('Failed to load applications');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      qualified: 'bg-green-100 text-green-800',
      reserve: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-blue-100 text-blue-800',
      not_selected: 'bg-gray-100 text-gray-800',
      excluded: 'bg-red-100 text-red-800',
    };

    const labels = {
      qualified: 'Qualified',
      reserve: 'Reserve',
      pending: 'Pending',
      not_selected: 'Not Selected',
      excluded: 'Excluded',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'qualified':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'reserve':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'excluded':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-modex-secondary mx-auto mb-4" />
          <p className="text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/dashboard"
            className="inline-block bg-modex-secondary text-white px-6 py-3 rounded-lg font-bold hover:bg-modex-primary transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link
                to={`/competitions/${competitionId}`}
                className="text-modex-secondary hover:text-modex-primary transition-colors mr-4"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-modex-primary">CFO Applications</h1>
                <p className="text-sm text-gray-600">{data?.competition?.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-modex-light px-4 py-2 rounded-lg">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="ml-2 font-bold text-modex-primary">{data?.total_count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total</span>
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-modex-primary mt-1">{data?.total_count || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600">Qualified</span>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {data?.applications?.filter(a => a.status === 'qualified').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-yellow-600">Reserve</span>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {data?.applications?.filter(a => a.status === 'reserve').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-600">Pending</span>
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {data?.applications?.filter(a => a.status === 'pending').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-600">Excluded</span>
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {data?.applications?.filter(a => a.status === 'excluded').length || 0}
            </p>
          </div>
        </div>

        {/* Applications List */}
        {data?.applications?.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Applications Yet</h3>
            <p className="text-gray-600">No CFO applications have been submitted for this competition.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Applicant
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {app.rank ? (
                        <span className={`font-bold ${app.rank <= 100 ? 'text-green-600' : app.rank <= 150 ? 'text-yellow-600' : 'text-gray-600'}`}>
                          #{app.rank}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="bg-gradient-to-br from-modex-secondary to-modex-accent w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3">
                          {app.user_profiles?.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {app.user_profiles?.full_name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {app.user_profiles?.email || ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-modex-primary">
                        {app.total_score?.toFixed(1) || '0.0'}
                      </span>
                      {app.red_flag_count > 0 && (
                        <span className="ml-2 text-xs text-red-600">
                          ({app.red_flag_count} flags)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(app.status)}
                        {getStatusBadge(app.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {app.submitted_at
                        ? new Date(app.submitted_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        to={`/competitions/${competitionId}/applications/${app.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-modex-secondary/10 text-modex-secondary rounded-lg hover:bg-modex-secondary hover:text-white transition-colors text-sm font-semibold"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CFOApplicationsList;
