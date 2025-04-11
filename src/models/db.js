const mongoose = require('mongoose');

// MongoDB connection options
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 15000, // Timeout after 15 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4 // Use IPv4, skip trying IPv6
};

// Connection retry settings
const MAX_RETRIES = 3;
const RETRY_INTERVAL = 5000; // 5 seconds

// Connect to MongoDB with retries
async function connectWithRetry(retries = MAX_RETRIES) {
    try {
        await mongoose.connect(process.env.MONGODB_URI, options);
        console.log('MongoDB connected successfully');
        
        // Handle connection events
        mongoose.connection.on('error', err => {
            console.error('MongoDB connection error:', err);
            if (retries > 0) {
                console.log(`Retrying connection in ${RETRY_INTERVAL/1000} seconds...`);
                setTimeout(() => connectWithRetry(retries - 1), RETRY_INTERVAL);
            }
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected. Attempting to reconnect...');
            if (retries > 0) {
                setTimeout(() => connectWithRetry(retries - 1), RETRY_INTERVAL);
            }
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                console.log('MongoDB connection closed through app termination');
                process.exit(0);
            } catch (err) {
                console.error('Error closing MongoDB connection:', err);
                process.exit(1);
            }
        });

    } catch (err) {
        console.error('MongoDB connection error:', err);
        if (retries > 0) {
            console.log(`Retrying connection in ${RETRY_INTERVAL/1000} seconds...`);
            setTimeout(() => connectWithRetry(retries - 1), RETRY_INTERVAL);
        } else {
            console.error('Failed to connect to MongoDB after all retries');
            throw err;
        }
    }
}

module.exports = { connectWithRetry };
