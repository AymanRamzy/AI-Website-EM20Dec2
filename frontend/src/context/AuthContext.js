import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Create Supabase client for auth
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/cfo/auth/me`, {
            timeout: 5000
          });
          setUser(response.data);
        } catch (error) {
          console.error('Failed to load user:', error);
          logout();
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  // Login function - uses backend API for token + profile
  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/cfo/auth/login`, {
        email: email.trim().toLowerCase(),
        password,
      }, {
        timeout: 10000
      });
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Login failed';
      
      // Check if error is about email confirmation
      if (errorMessage.toLowerCase().includes('confirm') || 
          errorMessage.toLowerCase().includes('not confirmed') ||
          errorMessage.toLowerCase().includes('email not confirmed')) {
        return {
          success: false,
          error: 'Please verify your email before logging in. Check your inbox for the confirmation link.',
          requiresConfirmation: true
        };
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  // Register function - uses Supabase Auth directly
  // Does NOT auto-login, redirects to check-email page
  const register = async (email, password, full_name, role = 'participant') => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      // Use Supabase Auth signUp with email redirect
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            full_name: full_name,
            role: role
          }
        }
      });

      if (error) {
        // Handle specific Supabase errors
        if (error.message.includes('already registered')) {
          return {
            success: false,
            error: 'This email is already registered. Please sign in instead.'
          };
        }
        return {
          success: false,
          error: error.message || 'Registration failed'
        };
      }

      // Check if user was created (even if not confirmed)
      if (data?.user) {
        // Profile will be created by database trigger
        // No need to call backend API
        return { 
          success: true,
          email: normalizedEmail,
          message: 'Registration successful! Please check your email to confirm your account.'
        };
      }

      return {
        success: false,
        error: 'Registration failed. Please try again.'
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    // Also sign out from Supabase
    supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
