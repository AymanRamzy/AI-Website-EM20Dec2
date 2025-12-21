import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import FMVA from './pages/FMVA';
import HundredFM from './pages/HundredFM';
import Services from './pages/Services';
import Competitions from './pages/Competitions';
import About from './pages/About';
import Contact from './pages/Contact';
import Testimonials from './pages/Testimonials';
import FAQ from './pages/FAQ';
import Community from './pages/Community';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateTeam from './pages/CreateTeam';
import JoinTeam from './pages/JoinTeam';
import TeamDetails from './pages/TeamDetails';
import CompetitionDetails from './pages/CompetitionDetails';
import AdminDashboard from './pages/AdminDashboard';
import CFOApplication from './pages/CFOApplication';
import CFOApplicationsList from './pages/CFOApplicationsList';
import CFOApplicationDetail from './pages/CFOApplicationDetail';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes with layout */}
          <Route element={<Layout><Home /></Layout>} path="/" />
          <Route element={<Layout><FMVA /></Layout>} path="/fmva" />
          <Route element={<Layout><HundredFM /></Layout>} path="/100fm" />
          <Route element={<Layout><Services /></Layout>} path="/services" />
          <Route element={<Layout><Competitions /></Layout>} path="/competitions" />
          <Route element={<Layout><About /></Layout>} path="/about" />
          <Route element={<Layout><Contact /></Layout>} path="/contact" />
          <Route element={<Layout><Testimonials /></Layout>} path="/testimonials" />
          <Route element={<Layout><FAQ /></Layout>} path="/faq" />
          <Route element={<Layout><Community /></Layout>} path="/community" />
          
          {/* Auth routes (no layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes (no layout) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/create"
            element={
              <ProtectedRoute>
                <CreateTeam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/join"
            element={
              <ProtectedRoute>
                <JoinTeam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamId"
            element={
              <ProtectedRoute>
                <TeamDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitions/:competitionId"
            element={
              <ProtectedRoute>
                <CompetitionDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cfo-application/:competitionId"
            element={
              <ProtectedRoute>
                <CFOApplication />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitions/:competitionId/applications"
            element={
              <ProtectedRoute>
                <CFOApplicationsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitions/:competitionId/applications/:applicationId"
            element={
              <ProtectedRoute>
                <CFOApplicationDetail />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;