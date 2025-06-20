// Frontend JavaScript für das Share Interface
class SecureNoteShareUI {
    constructor() {
        this.noteId = this.extractNoteId();
        this.noteData = null;
        this.currentContent = '';

        this.initializeTheme();
        this.setupEventListeners();
        this.initializeApp();
    }
    extractNoteId() {
        return window.noteId || this.extractNoteIdFromUrl();
    }

    extractNoteIdFromUrl() {
        const pathParts = window.location.pathname.split('/');
        return pathParts[pathParts.length - 1];
    }

    async initializeApp() {
        try {
            this.showLoading();
            await this.loadNote();
            const token = this.getTokenFromUrl();
            if (!token) {
                throw new Error('Kein Entschlüsselungs-Token in der URL gefunden');
            }

            if (this.noteData.hasPassword) {
                this.showPasswordPrompt(token);
            } else {
                await this.decryptNoteWithToken(token);
            }

        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.showError(error.message || 'Fehler beim Laden der Notiz');
        }
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('error').style.display = 'none';
        document.getElementById('content').style.display = 'none';
        document.getElementById('passwordPrompt').style.display = 'none';
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (systemPrefersDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        this.updateThemeToggleText();
    }

    setupEventListeners() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                this.updateThemeToggleText();
            }
        });
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeToggleText();
    }

    updateThemeToggleText() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const isDark = currentTheme === 'dark' || (!currentTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const toggleBtn = document.getElementById('themeToggle');

        if (toggleBtn) {
            toggleBtn.innerHTML = isDark ? '☀️ Light' : '🌙 Dark';
        }
    }

    getTokenFromUrl() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            return token;
        } catch (error) {
            console.error('Error getting token from URL:', error);
            return null;
        }
    }

    async loadNote() {
        try {
            const response = await fetch('/note/' + this.noteId);
            if (!response.ok) {
                throw new Error('Notiz nicht gefunden oder abgelaufen');
            }
            this.noteData = await response.json();
        } catch (error) {
            throw new Error('Fehler beim Laden der Notiz: ' + error.message);
        }
    }

    showError(message) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'none';
        document.getElementById('passwordPrompt').style.display = 'none';

        const errorDiv = document.getElementById('error');
        const errorMessage = document.getElementById('errorMessage');

        errorMessage.textContent = message;
        errorDiv.style.display = 'flex';
    }


    showPasswordPrompt(token) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        document.getElementById('content').style.display = 'none';

        const passwordPrompt = document.getElementById('passwordPrompt');
        passwordPrompt.style.display = 'flex';

        const passwordInput = document.getElementById('passwordInput');
        passwordInput.focus();

        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handlePasswordSubmit(token);
            }
        });
        const submitBtn = document.getElementById('submitPassword');
        submitBtn.onclick = () => this.handlePasswordSubmit(token);
    }

    async handlePasswordSubmit(token) {
        const passwordInput = document.getElementById('passwordInput');
        const password = passwordInput.value.trim();

        if (!password) {
            alert('Bitte geben Sie ein Passwort ein.');
            return;
        }

        try {
            this.showLoading();
            await this.decryptNoteWithToken(token, password);
        } catch (error) {
            console.error('❌ Password decryption error:', error);
            document.getElementById('passwordInput').value = '';
            this.showPasswordPrompt(token);

            const errorMsg = document.createElement('div');
            errorMsg.className = 'password-error';
            errorMsg.textContent = 'Falsches Passwort. Bitte versuchen Sie es erneut.';
            errorMsg.style.color = 'red';
            errorMsg.style.marginTop = '10px';

            const promptDiv = document.getElementById('passwordPrompt');
            const existingError = promptDiv.querySelector('.password-error');
            if (existingError) {
                existingError.remove();
            }
            promptDiv.appendChild(errorMsg);
        }
    }
    async decryptNoteWithToken(token, password = null) {
        if (!token || token.length === 0) {
            throw new Error('Ungültiger Entschlüsselungs-Token');
        }

        if (!this.noteData || !this.noteData.encryptedContent) {
            throw new Error('Keine verschlüsselten Daten verfügbar');
        }

        try {
            let decryptionKey = token;
            if (this.noteData.hasPassword && password) {
                const passwordHash = CryptoJS.SHA256(password).toString();
                decryptionKey = CryptoJS.PBKDF2(token, passwordHash, {
                    keySize: 256/32,
                    iterations: 10000
                }).toString();
            } else if (this.noteData.hasPassword && !password) {
                throw new Error('Passwort erforderlich');
            }

            const encData = this.noteData.encryptedContent;
            if (!encData.data || !encData.iv) {
                throw new Error('Ungültige verschlüsselte Daten');
            }

            const isValidHex = (str) => {
                return str && typeof str === 'string' && /^[0-9a-fA-F]*$/.test(str) && str.length % 2 === 0;
            };

            if (!isValidHex(encData.data) || !isValidHex(encData.iv) || !isValidHex(decryptionKey)) {
                throw new Error('Ungültiges Hex-Format in den Daten');
            }
            const ciphertext = CryptoJS.enc.Hex.parse(encData.data);
            const keyWordArray = CryptoJS.enc.Hex.parse(decryptionKey);
            const ivWordArray = CryptoJS.enc.Hex.parse(encData.iv);
            const cipherParams = CryptoJS.lib.CipherParams.create({
                ciphertext: ciphertext
            });

            const decrypted = CryptoJS.AES.decrypt(
                cipherParams,
                keyWordArray,
                {
                    iv: ivWordArray,
                    mode: CryptoJS.mode.CTR,
                    padding: CryptoJS.pad.NoPadding
                }
            );
            let decryptedContent;
            try {
                decryptedContent = decrypted.toString(CryptoJS.enc.Utf8);
            } catch (conversionError) {
                const bytes = [];
                for (let i = 0; i < decrypted.sigBytes; i++) {
                    const wordIndex = Math.floor(i / 4);
                    const byteIndex = i % 4;
                    const word = decrypted.words[wordIndex];
                    const byte = (word >>> (8 * (3 - byteIndex))) & 0xff;
                    bytes.push(byte);
                }

                const uint8Array = new Uint8Array(bytes);
                const decoder = new TextDecoder('utf-8');
                decryptedContent = decoder.decode(uint8Array);
            }

            if (!decryptedContent || decryptedContent.length === 0) {
                throw new Error('Entschlüsselung ergab leeren Inhalt - falscher Token');
            }
            this.displayContent(decryptedContent);

        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Entschlüsselung fehlgeschlagen: ' + error.message);
        }
    }
    displayContent(content) {
        this.currentContent = content;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        const contentDiv = document.getElementById('content');
        try {
            const processedContent = this.processObsidianLinks(content);
            const htmlContent = marked.parse(processedContent);
            contentDiv.innerHTML = htmlContent;
            this.handleBrokenImages(contentDiv);
        } catch (error) {
            console.error('Markdown parsing error:', error);
            contentDiv.textContent = content;
        }

        contentDiv.style.display = 'block';
    }
    handleBrokenImages(container) {
        const images = container.querySelectorAll('img');
        images.forEach(img => {
            img.addEventListener('error', function() {
                if (this.dataset.handled) return;
                this.dataset.handled = 'true';

                const altText = this.alt || 'Unbekanntes Bild';
                const placeholder = document.createElement('div');
                placeholder.className = 'broken-image-placeholder';
                placeholder.innerHTML = `
                    <div class="broken-image-content">
                        🖼️ <strong>${altText}</strong>
                        <p>Bild nicht verfügbar</p>
                        <small>Aktiviere "Anhänge einschließen" beim Teilen für eingebettete Bilder</small>
                    </div>
                `;

                this.parentNode.replaceChild(placeholder, this);
            });

            img.addEventListener('load', function() {
                console.log(`Bild erfolgreich geladen: ${this.src}`);
            });
        });
    }
    processObsidianLinks(content) {
        let processedContent = content;
        processedContent = processedContent.replace(
            /!\[\[([^|\]]+?)(?:\|([^\]]*))?\]\]/g,
            (match, fileName, altText) => {
                const alt = altText || fileName;
                if (fileName.startsWith('data:')) {
                    return `![${alt}](${fileName})`;
                }
                console.info(`Verarbeite Bild: ${fileName}`);
                if (fileName.match(/^https?:\/\//)) {
                    return `![${alt}](${fileName})`;
                }
                return `![${alt}](${fileName})`;
            }
        );
        processedContent = processedContent.replace(
            /(?<!\!)\[\[([^|\]]+?)(?:\|([^\]]*))?\]\]/g,
            (match, link, displayText) => {
                const text = displayText || link;
                return `[${text}](${link})`;
            }
        );

        return processedContent;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    new SecureNoteShareUI();
});
