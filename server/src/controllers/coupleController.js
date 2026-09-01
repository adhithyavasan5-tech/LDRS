const CoupleProfile = require('../models/CoupleProfile');
const User = require('../models/User');

/**
 * GET /api/couple/profile
 * Get the couple profile for the current user
 */
const getCoupleProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.coupleProfileId) {
      return res.json({
        success: true,
        coupleProfile: null,
        message: 'No couple profile yet. Create a room and have your partner join.',
      });
    }

    const coupleProfile = await CoupleProfile.findById(user.coupleProfileId)
      .populate('user1Id', 'name gender age')
      .populate('user2Id', 'name gender age')
      .populate('watchlist.addedBy', 'name');

    if (!coupleProfile) {
      return res.status(404).json({ success: false, message: 'Couple profile not found' });
    }

    res.json({
      success: true,
      coupleProfile: {
        ...coupleProfile.toJSON(),
        daysTogether: coupleProfile.daysTogether,
      },
    });
  } catch (error) {
    console.error('[getCoupleProfile]', error);
    res.status(500).json({ success: false, message: 'Error fetching couple profile' });
  }
};

/**
 * PUT /api/couple/profile
 * Update couple profile (nickname, relationship start date, etc.)
 */
const updateCoupleProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.coupleProfileId) {
      return res.status(404).json({ success: false, message: 'No couple profile found' });
    }

    const { coupleNickname, relationshipStartDate, preferences } = req.body;
    const update = {};

    if (coupleNickname !== undefined) update.coupleNickname = coupleNickname;
    if (relationshipStartDate) update.relationshipStartDate = new Date(relationshipStartDate);
    if (preferences) update.preferences = preferences;

    const coupleProfile = await CoupleProfile.findByIdAndUpdate(
      user.coupleProfileId,
      { $set: update },
      { new: true }
    )
      .populate('user1Id', 'name gender age')
      .populate('user2Id', 'name gender age');

    res.json({ success: true, coupleProfile });
  } catch (error) {
    console.error('[updateCoupleProfile]', error);
    res.status(500).json({ success: false, message: 'Error updating couple profile' });
  }
};

/**
 * GET /api/couple/watchlist
 * Get the shared watchlist
 */
const getWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.coupleProfileId) {
      return res.json({ success: true, watchlist: [] });
    }

    const coupleProfile = await CoupleProfile.findById(user.coupleProfileId).populate(
      'watchlist.addedBy',
      'name'
    );

    res.json({ success: true, watchlist: coupleProfile?.watchlist || [] });
  } catch (error) {
    console.error('[getWatchlist]', error);
    res.status(500).json({ success: false, message: 'Error fetching watchlist' });
  }
};

/**
 * POST /api/couple/watchlist
 * Add a movie to the watchlist
 */
const addToWatchlist = async (req, res) => {
  try {
    const { movieTitle, notes } = req.body;

    if (!movieTitle?.trim()) {
      return res.status(400).json({ success: false, message: 'Movie title is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user.coupleProfileId) {
      return res.status(404).json({ success: false, message: 'No couple profile found' });
    }

    const coupleProfile = await CoupleProfile.findByIdAndUpdate(
      user.coupleProfileId,
      {
        $push: {
          watchlist: {
            movieTitle: movieTitle.trim(),
            addedBy: req.user._id,
            notes: notes?.trim() || null,
          },
        },
      },
      { new: true }
    ).populate('watchlist.addedBy', 'name');

    res.status(201).json({
      success: true,
      message: `"${movieTitle}" added to watchlist!`,
      watchlist: coupleProfile.watchlist,
    });
  } catch (error) {
    console.error('[addToWatchlist]', error);
    res.status(500).json({ success: false, message: 'Error adding to watchlist' });
  }
};

/**
 * PUT /api/couple/watchlist/:itemId
 * Mark a watchlist item as watched or update it
 */
const updateWatchlistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { isWatched } = req.body;

    const user = await User.findById(req.user._id);
    if (!user.coupleProfileId) {
      return res.status(404).json({ success: false, message: 'No couple profile found' });
    }

    const update = {
      'watchlist.$.isWatched': isWatched,
    };
    if (isWatched) update['watchlist.$.watchedAt'] = new Date();

    const coupleProfile = await CoupleProfile.findOneAndUpdate(
      { _id: user.coupleProfileId, 'watchlist._id': itemId },
      { $set: update },
      { new: true }
    ).populate('watchlist.addedBy', 'name');

    if (!coupleProfile) {
      return res.status(404).json({ success: false, message: 'Watchlist item not found' });
    }

    res.json({ success: true, watchlist: coupleProfile.watchlist });
  } catch (error) {
    console.error('[updateWatchlistItem]', error);
    res.status(500).json({ success: false, message: 'Error updating watchlist item' });
  }
};

/**
 * DELETE /api/couple/watchlist/:itemId
 * Remove a movie from the watchlist
 */
const removeFromWatchlist = async (req, res) => {
  try {
    const { itemId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user.coupleProfileId) {
      return res.status(404).json({ success: false, message: 'No couple profile found' });
    }

    const coupleProfile = await CoupleProfile.findByIdAndUpdate(
      user.coupleProfileId,
      { $pull: { watchlist: { _id: itemId } } },
      { new: true }
    );

    res.json({ success: true, watchlist: coupleProfile.watchlist });
  } catch (error) {
    console.error('[removeFromWatchlist]', error);
    res.status(500).json({ success: false, message: 'Error removing from watchlist' });
  }
};

/**
 * POST /api/couple/reminders
 * Add a reminder (anniversary, birthday, custom)
 */
const addReminder = async (req, res) => {
  try {
    const { type, title, date, notifyDaysBefore, isRecurring } = req.body;

    if (!type || !date) {
      return res.status(400).json({ success: false, message: 'Type and date are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user.coupleProfileId) {
      return res.status(404).json({ success: false, message: 'No couple profile found' });
    }

    const coupleProfile = await CoupleProfile.findByIdAndUpdate(
      user.coupleProfileId,
      {
        $push: {
          reminders: { type, title, date: new Date(date), notifyDaysBefore, isRecurring },
        },
      },
      { new: true }
    );

    res.status(201).json({ success: true, reminders: coupleProfile.reminders });
  } catch (error) {
    console.error('[addReminder]', error);
    res.status(500).json({ success: false, message: 'Error adding reminder' });
  }
};

module.exports = {
  getCoupleProfile,
  updateCoupleProfile,
  getWatchlist,
  addToWatchlist,
  updateWatchlistItem,
  removeFromWatchlist,
  addReminder,
};
