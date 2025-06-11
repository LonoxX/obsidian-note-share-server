// API Routes für Notizen
const express = require('express');
const router = express.Router();
const { saveNote, loadNote, deleteNote, getStorageStats } = require('../utils');
const { v4: uuidv4 } = require('uuid');

// Environment variable getters with defaults
const getDefaultTtlMinutes = () => parseInt(process.env.DEFAULT_TTL_MINUTES) || 60;
const getMaxTtlMinutes = () => parseInt(process.env.MAX_TTL_MINUTES) || 10080; // 7 days

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const stats = await getStorageStats();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            storage: stats,
            version: require('../package.json').version
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Upload endpoint - Verschlüsselte Notiz speichern
router.post('/upload', async (req, res) => {
    try {
        const { encryptedContent, ttlMinutes, oneTimeView, hasPassword } = req.body;

        // Validierung
        if (!encryptedContent || !encryptedContent.data || !encryptedContent.iv || !encryptedContent.tag) {
            return res.status(400).json({
                error: 'Missing required fields: encryptedContent with data, iv, and tag'
            });
        }

        // TTL validieren
        const requestedTtl = ttlMinutes || getDefaultTtlMinutes();
        if (requestedTtl > getMaxTtlMinutes()) {
            return res.status(400).json({
                error: `TTL cannot exceed ${getMaxTtlMinutes()} minutes`
            });
        }

        // Content-Größe prüfen
        const contentString = JSON.stringify(encryptedContent);
        if (contentString.length > 1024 * 1024) { // 1MB limit
            return res.status(400).json({
                error: 'Content too large'
            });
        }

        // Eindeutige ID generieren
        const id = uuidv4();

        // Ablaufzeit berechnen
        const expiresAt = new Date(Date.now() + requestedTtl * 60 * 1000);

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

        // Speichern
        await saveNote(id, noteData);

        console.log(`✅ Note created: ${id} (expires: ${expiresAt.toISOString()})`);

        res.json({
            id,
            shareUrl: `${req.protocol}://${req.get('host')}/share/${id}`,
            expiresAt: expiresAt.toISOString(),
            ttlMinutes: requestedTtl
        });
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Note laden
router.get('/note/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const noteData = await loadNote(id);
        if (!noteData) {
            return res.status(404).json({
                error: 'Note not found or expired'
            });
        }

        // View Count erhöhen
        noteData.viewCount = (noteData.viewCount || 0) + 1;

        // Bei One-Time View nach dem ersten Abruf löschen
        if (noteData.oneTimeView && noteData.viewCount > 1) {
            await deleteNote(id);
            return res.status(404).json({
                error: 'Note was deleted after first view'
            });
        }

        // Notiz aktualisieren (View Count)
        await saveNote(id, noteData);

        console.log(`📖 Note accessed: ${id} (views: ${noteData.viewCount})`);

        // Nur Metadaten zurückgeben, nicht den verschlüsselten Inhalt
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

// Note manuell löschen
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

// Freigabe widerrufen - Notiz löschen
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
