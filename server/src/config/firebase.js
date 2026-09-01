/**
 * Firebase Admin SDK configuration
 * Used for Firebase Cloud Messaging (push notifications)
 *
 * To enable:
 * 1. Go to Firebase Console → Project Settings → Service Accounts
 * 2. Generate a new private key
 * 3. Set the environment variables in server/.env
 */

let firebaseAdmin = null;
let isFirebaseConfigured = false;

const initFirebase = () => {
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn('⚠️  Firebase credentials not set. Push notifications will be unavailable.');
    return false;
  }

  try {
    const admin = require('firebase-admin');

    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });

    isFirebaseConfigured = true;
    console.log('✅ Firebase Admin initialized');
    return true;
  } catch (error) {
    console.warn(`⚠️  Firebase initialization failed: ${error.message}`);
    return false;
  }
};

/**
 * Send a push notification via FCM
 * @param {string} fcmToken - The device FCM token
 * @param {object} notification - { title, body }
 * @param {object} data - Additional data payload
 */
const sendNotification = async (fcmToken, notification, data = {}) => {
  if (!isFirebaseConfigured || !firebaseAdmin) {
    console.warn('Firebase not configured. Notification not sent.');
    return null;
  }

  try {
    const admin = require('firebase-admin');
    const message = {
      token: fcmToken,
      notification,
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    };

    const response = await admin.messaging().send(message);
    return response;
  } catch (error) {
    console.error('FCM send error:', error.message);
    return null;
  }
};

module.exports = { initFirebase, sendNotification, isFirebaseConfigured: () => isFirebaseConfigured };
