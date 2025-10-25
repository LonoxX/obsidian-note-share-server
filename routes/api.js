// API Routes für Notizen
const express = require('express');
const router = express.Router();
const { saveNote, loadNote, deleteNote, getStorageStats } = require('../utils');

const getDefaultTtlMinutes = () => parseInt(process.env.DEFAULT_TTL_MINUTES) || 60;
const getMaxTtlMinutes = () => parseInt(process.env.MAX_TTL_MINUTES) || 10080; // 7 days
const getMaxSize = () => {
    const envValue = process.env.MAX_CONTENT_SIZE;
    if (!envValue) return 1024 * 1024; // 1MB default

    // Parse size strings like "10mb", "1kb", etc.
    const match = envValue.toLowerCase().match(/^(\d+)(mb|kb|gb|b)?$/);
    if (!match) return 1024 * 1024; // fallback to 1MB

    const value = parseInt(match[1]);
    const unit = match[2] || 'b';

    switch (unit) {
        case 'gb': return value * 1024 * 1024 * 1024;
        case 'mb': return value * 1024 * 1024;
        case 'kb': return value * 1024;
        case 'b':
        default: return value;
    }
};

router.get('/health', async (req, res) => {
    try {
        const stats = await getStorageStats();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: require('../package.json').version
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});


router.post('/upload', async (req, res) => {
    try {
        const { encryptedContent, ttlMinutes, oneTimeView, hasPassword } = req.body;
        if (!encryptedContent || !encryptedContent.data || !encryptedContent.iv || !encryptedContent.tag) {
            return res.status(400).json({
                error: 'Missing required fields: encryptedContent with data, iv, and tag'
            });
        }

        const requestedTtl = ttlMinutes || getDefaultTtlMinutes();
        let isUnlimited = false;
        let finalTtl = requestedTtl;

        if (ttlMinutes === -1) {
            isUnlimited = true;
            finalTtl = -1;
        } else if (requestedTtl > getMaxTtlMinutes()) {
            return res.status(400).json({
                error: `TTL cannot exceed ${getMaxTtlMinutes()} minutes`
            });
        }

        // Content-Größe prüfen
        const contentString = JSON.stringify(encryptedContent);
        const contentSize = contentString.length;


        if (contentSize > getMaxSize()) {
            return res.status(400).json({
                error: 'Content too large'
            });
        }

        const { v4: uuidv4 } = await import('uuid');
        const id = uuidv4();

        let expiresAt;
        if (isUnlimited) {
            expiresAt = new Date('2099-12-31T23:59:59.999Z');
        } else {
            expiresAt = new Date(Date.now() + finalTtl * 60 * 1000);
        }

        // Notiz-Daten strukturieren
        const noteData = {
            id,
            encryptedContent,
            expiresAt: expiresAt.toISOString(),
            oneTimeView: !!oneTimeView,
            hasPassword: !!hasPassword,
            createdAt: new Date().toISOString(),
            viewCount: 0
        };

        await saveNote(id, noteData);

        const shareUrl = `${req.protocol}://${req.get('host')}/share/${id}`;

        res.json({
            id,
            shareUrl,
            expiresAt: expiresAt.toISOString(),
            ttlMinutes: requestedTtl
        });
    } catch (error) {
        console.error('❌ Upload error:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            code: error.code
        });
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.get('/note/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const noteData = await loadNote(id);
        if (!noteData) {
            return res.status(404).json({
                error: 'Note not found or expired'
            });
        }
        noteData.viewCount = (noteData.viewCount || 0) + 1;

        if (noteData.oneTimeView && noteData.viewCount > 1) {
            await deleteNote(id);
            return res.status(404).json({
                error: 'Note was deleted after first view'
            });
        }
        await saveNote(id, noteData);

        console.log(`📖 Note accessed: ${id} (views: ${noteData.viewCount})`);

        res.json({
            id: noteData.id,
            encryptedContent: noteData.encryptedContent,
            hasPassword: noteData.hasPassword,
            oneTimeView: noteData.oneTimeView,
            expiresAt: noteData.expiresAt,
            viewCount: noteData.viewCount
        });
    } catch (error) {
        console.error('❌ Note access error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.delete('/note/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const noteData = await loadNote(id);
        if (!noteData) {
            return res.status(404).json({
                error: 'Note not found'
            });
        }

        await deleteNote(id);
        console.log(`🗑️ Note deleted: ${id}`);

        res.json({
            message: 'Note deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.delete('/revoke/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteNote(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Note not found' });
        }
        console.log(`🗑️ Note revoked: ${id}`);
        res.json({ message: 'Note revoked successfully' });
    } catch (error) {
        console.error('❌ Revoke error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
