const WatchHistory = require('../models/WatchHistory');
const User = require('../models/User');
const CoupleProfile = require('../models/CoupleProfile');

/**
 * GET /api/history
 * Get watch history for the current couple
 */
const getWatchHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.coupleProfileId) {
      return res.json({ success: true, history: [], total: 0 });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      WatchHistory.find({ coupleProfileId: user.coupleProfileId })
        .sort({ watchedDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user1Id', 'name')
        .populate('user2Id', 'name'),
      WatchHistory.countDocuments({ coupleProfileId: user.coupleProfileId }),
    ]);

    res.json({
      success: true,
      history,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[getWatchHistory]', error);
    res.status(500).json({ success: false, message: 'Error fetching watch history' });
  }
};

/**
 * POST /api/history
 * Add a new watch history entry (called when a movie session ends)
 */
const addWatchHistory = async (req, res) => {
  try {
    const { movieName, movieUrl, duration, completionStatus } = req.body;

    if (!movieName) {
      return res.status(400).json({ success: false, message: 'Movie name is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user.coupleProfileId) {
      return res.status(404).json({ success: false, message: 'No couple profile found' });
    }

    const coupleProfile = await CoupleProfile.findById(user.coupleProfileId);

    const historyEntry = await WatchHistory.create({
      coupleProfileId: user.coupleProfileId,
      movieName,
      movieUrl: movieUrl || null,
      duration: duration || 0,
      user1Id: coupleProfile.user1Id,
      user2Id: coupleProfile.user2Id,
      completionStatus: completionStatus || 'partial',
    });

    // Update couple profile stats
    await CoupleProfile.findByIdAndUpdate(user.coupleProfileId, {
      $inc: { totalMoviesWatched: 1 },
      $set: { lastMovieWatched: movieName, lastWatchedAt: new Date() },
    });

    res.status(201).json({ success: true, history: historyEntry });
  } catch (error) {
    console.error('[addWatchHistory]', error);
    res.status(500).json({ success: false, message: 'Error adding watch history' });
  }
};

/**
 * PUT /api/history/:id/rate
 * Add or update a rating/review for a history entry
 */
const rateMovie = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const { id } = req.params;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const historyEntry = await WatchHistory.findById(id);
    if (!historyEntry) {
      return res.status(404).json({ success: false, message: 'History entry not found' });
    }

    const userId = req.user._id.toString();
    const isUser1 = historyEntry.user1Id.toString() === userId;
    const isUser2 = historyEntry.user2Id?.toString() === userId;

    if (!isUser1 && !isUser2) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const update = isUser1
      ? { rating1: rating, review1: review || null }
      : { rating2: rating, review2: review || null };

    const updated = await WatchHistory.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('user1Id', 'name')
      .populate('user2Id', 'name');

    res.json({ success: true, history: updated });
  } catch (error) {
    console.error('[rateMovie]', error);
    res.status(500).json({ success: false, message: 'Error saving rating' });
  }
};

module.exports = { getWatchHistory, addWatchHistory, rateMovie };
