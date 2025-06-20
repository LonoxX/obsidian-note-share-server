const fs = require('fs-extra');
const path = require('path');

const getStoragePath = () => process.env.STORAGE_PATH || './storage';

const getNotePath = (id) => path.join(getStoragePath(), `${id}.json`);

async function saveNote(id, noteData) {
  try {
    const storagePath = getStoragePath();
    await fs.ensureDir(storagePath);
    if (noteData.expiresAt) {
      const expiresDate = new Date(noteData.expiresAt);
      if (isNaN(expiresDate.getTime())) {
        throw new Error('Invalid expiresAt date');
      }
    }

    await fs.outputJson(getNotePath(id), noteData, { spaces: 2 });
    console.log(`📝 Note saved: ${id}, expires: ${noteData.expiresAt}`);

    return true;
  } catch (error) {
    console.error(`❌ Error saving note ${id}:`, error);
    throw new Error('Failed to save note');
  }
}

async function loadNote(id, incrementViewCount = false) {
  try {
    const notePath = getNotePath(id);

    if (!await fs.pathExists(notePath)) {
      return null;
    }

    const data = await fs.readJson(notePath);
    const now = new Date();
    const expiresAt = new Date(data.expiresAt);

    if (now > expiresAt) {
      await fs.remove(notePath);
      console.log(`🗑️ Expired note removed: ${id}`);
      return null;
    }

    // One-time view prüfen
    if (data.oneTimeView && data.viewCount > 0) {
      await fs.remove(notePath);
      console.log(`🗑️ One-time note removed after view: ${id}`);
      return null;
    }

    if (incrementViewCount) {
      data.viewCount++;
      await fs.outputJson(notePath, data, { spaces: 2 });

      if (data.oneTimeView) {
        await fs.remove(notePath);
        console.log(`🗑️ One-time note removed after increment: ${id}`);
      }
    }    return data;
  } catch (error) {
    console.error(`❌ Error loading note ${id}:`, error);
    return null;
  }
}

async function deleteNote(id) {
  try {
    const notePath = getNotePath(id);

    if (await fs.pathExists(notePath)) {
      await fs.remove(notePath);
      console.log(`🗑️ Note manually deleted: ${id}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error deleting note ${id}:`, error);
    throw new Error('Failed to delete note');
  }
}

async function cleanupExpiredNotes() {
  try {
    const storagePath = getStoragePath();
    if (!await fs.pathExists(storagePath)) {
      return 0;
    }

    const files = await fs.readdir(storagePath);
    let cleanedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const fullPath = path.join(storagePath, file);

      try {
        const data = await fs.readJson(fullPath);

        if (Date.now() > data.expiresAt) {
          await fs.remove(fullPath);
          cleanedCount++;
        }
      } catch (error) {
        console.log(`🗑️ Removing malformed file: ${file}`);
        await fs.remove(fullPath);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleanup completed: ${cleanedCount} files removed`);
    }

    return cleanedCount;
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    return 0;
  }
}

async function getStorageStats() {
  try {
    const storagePath = getStoragePath();
    if (!await fs.pathExists(storagePath)) {
      return { totalNotes: 0, totalSize: 0 };
    }

    const files = await fs.readdir(storagePath);
    let totalNotes = 0;
    let totalSize = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const fullPath = path.join(storagePath, file);
      const stats = await fs.stat(fullPath);

      totalNotes++;
      totalSize += stats.size;
    }

    return { totalNotes, totalSize };
  } catch (error) {
    console.error('❌ Error getting storage stats:', error);
    return { totalNotes: 0, totalSize: 0 };
  }
}

module.exports = {
  saveNote,
  loadNote,
  deleteNote,
  cleanupExpiredNotes,
  getStorageStats
};
