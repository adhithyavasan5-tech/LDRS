const express = require('express');
const router = express.Router();
const {
  getCoupleProfile,
  updateCoupleProfile,
  getWatchlist,
  addToWatchlist,
  updateWatchlistItem,
  removeFromWatchlist,
  addReminder,
} = require('../controllers/coupleController');
const { protect } = require('../middleware/auth');

// All couple routes require authentication
router.use(protect);

router.get('/profile', getCoupleProfile);
router.put('/profile', updateCoupleProfile);

router.get('/watchlist', getWatchlist);
router.post('/watchlist', addToWatchlist);
router.put('/watchlist/:itemId', updateWatchlistItem);
router.delete('/watchlist/:itemId', removeFromWatchlist);

router.post('/reminders', addReminder);

module.exports = router;
