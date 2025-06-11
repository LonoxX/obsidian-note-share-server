// CORS Middleware

// Get CORS origins from environment variables
const getCorsOrigins = () => {
    return process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
        'app://obsidian.md'
    ];
};

module.exports = (req, res, next) => {
    // CORS Headers setzen
    const origin = req.headers.origin;
    const corsOrigins = getCorsOrigins();

    // Headers für alle Requests setzen (wichtig für Preflight)
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Max-Age', '86400'); // 24 Stunden Cache für Preflight

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
        res.header('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        return next();
    }

    // Allow Obsidian app origins
    if (origin && (origin.startsWith('app://') || origin.startsWith('capacitor://'))) {
        res.header('Access-Control-Allow-Origin', origin);
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        return next();
    }

    // Check if origin is in allowed list
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        return next();
    }

    // Für nicht erlaubte Origins
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // CORS error für nicht erlaubte Origins bei tatsächlichen Requests
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
};
