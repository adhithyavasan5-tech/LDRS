import api from './api';

export const userService = {
  /**
   * Create a new user profile (no email/password)
   */
  createProfile: async (data) => {
    const res = await api.post('/users/register', data);
    return res.data;
  },

  /**
   * Login with email + password
   */
  login: async (data) => {
    const res = await api.post('/users/login', data);
    return res.data;
  },

  /**
   * Get current user profile
   */
  getMyProfile: async () => {
    const res = await api.get('/users/me');
    return res.data;
  },

  /**
   * Get a user by ID
   */
  getUserById: async (id) => {
    const res = await api.get(`/users/${id}`);
    return res.data;
  },

  /**
   * Update preferences (theme, notifications, fcmToken)
   */
  updatePreferences: async (data) => {
    const res = await api.put('/users/preferences', data);
    return res.data;
  },
};
