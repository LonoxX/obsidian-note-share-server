const express = require('express');
const router = express.Router();

// Basic debug endpoint for development
router.get('/debug/status', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

module.exports = router;
