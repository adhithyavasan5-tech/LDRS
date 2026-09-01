import api from './api';

export const coupleService = {
  getProfile: async () => {
    const res = await api.get('/couple/profile');
    return res.data;
  },

  updateProfile: async (data) => {
    const res = await api.put('/couple/profile', data);
    return res.data;
  },

  getWatchlist: async () => {
    const res = await api.get('/couple/watchlist');
    return res.data;
  },

  addToWatchlist: async (data) => {
    const res = await api.post('/couple/watchlist', data);
    return res.data;
  },

  updateWatchlistItem: async (itemId, data) => {
    const res = await api.put(`/couple/watchlist/${itemId}`, data);
    return res.data;
  },

  removeFromWatchlist: async (itemId) => {
    const res = await api.delete(`/couple/watchlist/${itemId}`);
    return res.data;
  },

  addReminder: async (data) => {
    const res = await api.post('/couple/reminders', data);
    return res.data;
  },
};