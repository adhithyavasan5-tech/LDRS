const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('⚠️  MONGODB_URI not set. Running without database connection.');
    console.warn('   Set MONGODB_URI in server/.env to enable database features.\n');
    return;
  }

  let retries = 3;
  while (retries > 0 && !isConnected) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
      });

      isConnected = true;
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      break;
    } catch (error) {
      retries--;
      console.error(`❌ MongoDB connection attempt failed: ${error.message}`);
      if (retries === 0) {
        console.warn('   Server will continue without database. Some features will be unavailable.\n');
      } else {
        console.log(`   Retrying connection in 3 seconds... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
};

module.exports = connectDB;
