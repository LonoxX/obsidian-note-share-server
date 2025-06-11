// Security Middleware
const helmet = require('helmet');

module.exports = helmet({
    contentSecurityPolicy: false, // Allow für die Share-Seite
    crossOriginEmbedderPolicy: false
});
