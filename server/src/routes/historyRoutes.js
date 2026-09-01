const express = require('express');
const router = express.Router();
const { getWatchHistory, addWatchHistory, rateMovie } = require('../controllers/historyController');
const { protect } = require('../middleware/auth');

// All history routes require authentication
router.use(protect);

router.get('/', getWatchHistory);
router.post('/', addWatchHistory);
router.put('/:id/rate', rateMovie);

module.exports = router;
