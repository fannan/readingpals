class GoogleCloudStorage {
    constructor(config) {
        this.config = config;
        this.accessToken = null;
        this.isAuthenticated = false;
    }

    /**
     * Initialize Google Cloud Storage connection
     * This method handles OAuth authentication
     */
    async initialize() {
        try {
            if (this.config.oauth.clientId) {
                await this.initializeOAuth();
            } else {
                console.warn('No OAuth client ID configured. Upload will be simulated.');
            }
        } catch (error) {
            console.error('Failed to initialize Google Cloud Storage:', error);
            throw error;
        }
    }

    /**
     * Initialize OAuth 2.0 authentication
     */
    async initializeOAuth() {
        return new Promise((resolve, reject) => {
            // Load Google Identity Services
            if (!window.google) {
                this.loadGoogleIdentityScript().then(() => {
                    this.setupOAuth(resolve, reject);
                }).catch(reject);
            } else {
                this.setupOAuth(resolve, reject);
            }
        });
    }

    /**
     * Load Google Identity Services script
     */
    loadGoogleIdentityScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Setup OAuth configuration
     */
    setupOAuth(resolve, reject) {
        try {
            google.accounts.id.initialize({
                client_id: this.config.oauth.clientId,
                callback: (response) => {
                    this.handleOAuthCallback(response, resolve, reject);
                }
            });

            // Initialize token client for getting access tokens
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.config.oauth.clientId,
                scope: this.config.oauth.scope,
                callback: (response) => {
                    this.accessToken = response.access_token;
                    this.isAuthenticated = true;
                    resolve();
                }
            });

            resolve();
        } catch (error) {
            reject(error);
        }
    }

    /**
     * Handle OAuth callback
     */
    handleOAuthCallback(response, resolve, reject) {
        if (response.error) {
            reject(new Error(`OAuth error: ${response.error}`));
            return;
        }

        // Store the credential
        this.credential = response.credential;
        resolve();
    }

    /**
     * Request access token for API calls
     */
    async requestAccessToken() {
        return new Promise((resolve, reject) => {
            if (!this.tokenClient) {
                reject(new Error('OAuth not initialized'));
                return;
            }

            this.tokenClient.callback = (response) => {
                if (response.error) {
                    reject(new Error(`Token error: ${response.error}`));
                    return;
                }

                this.accessToken = response.access_token;
                this.isAuthenticated = true;
                resolve(response.access_token);
            };

            this.tokenClient.requestAccessToken();
        });
    }

    /**
     * Upload audio file to Google Cloud Storage
     */
    async uploadAudioFile(audioBlob, volunteerName) {
        // For development/demo, simulate upload
        if (!this.config.oauth.clientId || this.config.oauth.clientId === 'YOUR_OAUTH_CLIENT_ID') {
            return this.simulateUpload(audioBlob, volunteerName);
        }

        try {
            // Ensure we have an access token
            if (!this.accessToken) {
                await this.requestAccessToken();
            }

            const fileName = this.generateFileName(volunteerName);
            const uploadUrl = this.buildUploadUrl(fileName);

            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': audioBlob.type,
                    'Content-Length': audioBlob.size.toString()
                },
                body: audioBlob
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            return {
                success: true,
                fileName: fileName,
                fileUrl: `https://storage.googleapis.com/${this.config.bucketName}/${fileName}`,
                metadata: result
            };

        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    /**
     * Simulate upload for development/demo purposes
     */
    async simulateUpload(audioBlob, volunteerName) {
        const fileName = this.generateFileName(volunteerName);

        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log('Simulated upload:', {
            fileName,
            size: audioBlob.size,
            type: audioBlob.type,
            volunteer: volunteerName,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            fileName: fileName,
            fileUrl: `https://storage.googleapis.com/${this.config.bucketName}/${fileName}`,
            simulated: true
        };
    }

    /**
     * Generate unique filename for audio recording
     */
    generateFileName(volunteerName) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
        const timestamp = now.getTime();

        return `${dateStr}/${volunteerName}-${timeStr}-${timestamp}.webm`;
    }

    /**
     * Build upload URL for Google Cloud Storage
     */
    buildUploadUrl(fileName) {
        const encodedFileName = encodeURIComponent(fileName);
        return `${this.config.apiEndpoint}/${this.config.bucketName}/o?uploadType=media&name=${encodedFileName}`;
    }

    /**
     * Validate audio file before upload
     */
    validateAudioFile(audioBlob) {
        // Check file size - use window.CONFIG to access the global config
        const maxSizeBytes = window.CONFIG.upload.maxFileSizeMB * 1024 * 1024;
        if (audioBlob.size > maxSizeBytes) {
            throw new Error(`File too large. Maximum size: ${window.CONFIG.upload.maxFileSizeMB}MB`);
        }

        // Check MIME type
        if (!window.CONFIG.upload.allowedMimeTypes.includes(audioBlob.type)) {
            throw new Error(`Unsupported file type: ${audioBlob.type}`);
        }

        return true;
    }

    /**
     * Get authentication status
     */
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            hasAccessToken: !!this.accessToken,
            isConfigured: !!(this.config.oauth.clientId && this.config.oauth.clientId !== 'YOUR_OAUTH_CLIENT_ID')
        };
    }
}

// Export class
window.GoogleCloudStorage = GoogleCloudStorage;