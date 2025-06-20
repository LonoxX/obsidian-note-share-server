// Share Routes für Web Interface
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Share-Seite anzeigen
router.get('/share/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const templatePath = path.join(__dirname, '..', 'views', 'share.html');
        let html = await fs.readFile(templatePath, 'utf8');
        html = html.replace('{{NOTE_ID}}', id);
        html = html.replace('{{HAS_PASSWORD}}', 'false');

        res.send(html);
    } catch (error) {
        console.error('❌ Template error:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;
