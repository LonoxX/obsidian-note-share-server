// Modularisierter Express Server für Secure Note Share
const express = require('express');
const path = require('path');
const { CronJob } = require('cron');
require('dotenv').config();

const { cleanupExpiredNotes } = require('./utils');

// Environment variable getters with defaults
const getPort = () => process.env.PORT || 3000;
const getStoragePath = () => process.env.STORAGE_PATH || './storage';
const getDefaultTtlMinutes = () => parseInt(process.env.DEFAULT_TTL_MINUTES) || 60;
const getCleanupIntervalMinutes = () => parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 10;
const getMaxContentSize = () => process.env.MAX_CONTENT_SIZE || '10mb';
const getCorsOrigins = () => {
    return process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
        'app://obsidian.md'
    ];
};

// Middleware imports
const securityMiddleware = require('./middleware/security');
const corsMiddleware = require('./middleware/cors');
const rateLimitMiddleware = require('./middleware/rateLimit');
const loggingMiddleware = require('./middleware/logging');

// Route imports
const apiRoutes = require('./routes/api');
const shareRoutes = require('./routes/share');
const debugRoutes = require('./routes/debug');

const app = express();

// Security middlewares
app.use(securityMiddleware);

// CORS configuration
app.use(corsMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// Body parser mit Größenlimit
app.use(express.json({ limit: getMaxContentSize() }));
app.use(express.urlencoded({ extended: true, limit: getMaxContentSize() }));

// Logging middleware
app.use(loggingMiddleware);

// Static files
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', apiRoutes);
app.use('/', shareRoutes);
app.use('/', debugRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Global error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Cleanup job - läuft alle X Minuten
const cleanupJob = new CronJob(
    `*/${getCleanupIntervalMinutes()} * * * *`,
    cleanupExpiredNotes,
    null,
    true
);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    cleanupJob.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    cleanupJob.stop();
    process.exit(0);
});

// Server starten
const port = getPort();
app.listen(port, () => {
    console.log(`🚀 Secure Note Share Server running on port ${port}`);
    console.log(`📁 Storage path: ${getStoragePath()}`);
    console.log(`⏰ Default TTL: ${getDefaultTtlMinutes()} minutes`);
    console.log(`🧹 Cleanup runs every ${getCleanupIntervalMinutes()} minutes`);
    console.log(`🌐 CORS origins: ${getCorsOrigins().join(', ')}`);
    console.log(`💾 Max content size: ${getMaxContentSize()}`);
    console.log(`🎨 Modular structure: Routes, Middleware, Templates`);
});
