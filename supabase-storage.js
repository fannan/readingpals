class SupabaseStorage {
    constructor() {
        this.client = new SupabaseClient();
        this.bucketName = SUPABASE_CONFIG.bucketName;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Initialize the Supabase client first
            await this.client.initialize();

            // Try to create the bucket (will fail if it already exists, which is fine)
            const createResponse = await this.client.createBucket(this.bucketName, true);

            if (createResponse.ok) {
                console.log('Created new bucket:', this.bucketName);
            } else {
                const error = await createResponse.json();
                if (error && error.message && error.message.includes('already exists')) {
                    console.log('Bucket already exists:', this.bucketName);
                } else {
                    console.warn('Bucket creation response:', error);
                }
            }

            this.initialized = true;
            console.log('Supabase storage initialized');
        } catch (error) {
            console.warn('Storage initialization warning:', error);
            this.initialized = true; // Continue anyway
        }
    }

    /**
     * Upload audio file to Supabase Storage
     */
    async uploadAudioFile(audioBlob, volunteerName) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const fileName = this.generateFileName(volunteerName);
            console.log('Uploading to Supabase:', fileName);

            const response = await this.client.uploadFile(this.bucketName, fileName, audioBlob);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Upload error:', errorData);
                throw new Error(`Upload failed: ${response.status} - ${errorData.message || response.statusText}`);
            }

            const result = await response.json();
            console.log('Upload successful:', result);

            return {
                success: true,
                fileName: fileName,
                fileUrl: this.client.getFileUrl(this.bucketName, fileName),
                metadata: result,
                provider: 'supabase'
            };

        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    /**
     * List all files in the bucket
     */
    async listFiles() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            console.log('Fetching files from Supabase bucket:', this.bucketName);

            const response = await this.client.listFiles(this.bucketName);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('List files error:', errorData);
                throw new Error(`Failed to list files: ${response.status} - ${errorData.message || response.statusText}`);
            }

            const files = await response.json();
            console.log('Files from Supabase:', files);

            if (!files || files.length === 0) {
                return [];
            }

            // Process and sort files
            const processedFiles = files
                .filter(file => file.name && (file.name.endsWith('.webm') || file.name.endsWith('.mp3')))
                .map(file => this.parseFileData(file))
                .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

            return processedFiles;

        } catch (error) {
            console.error('Error listing files:', error);
            throw error;
        }
    }

    /**
     * Parse file data from Supabase response
     */
    parseFileData(file) {
        // Parse filename: YYYY-MM-DD/volunteer-name-HH-MM-SS-timestamp.webm
        const nameParts = file.name.split('/');
        const fileName = nameParts[nameParts.length - 1];
        const dateFolder = nameParts[0] || 'unknown-date';

        // Extract volunteer name from filename
        const fileNameParts = fileName.split('-');
        let volunteerName = 'Unknown';

        if (fileNameParts.length >= 4) {
            // Find where the time part starts (HH-MM-SS pattern)
            let timeStartIndex = -1;
            for (let i = 0; i < fileNameParts.length - 2; i++) {
                if (this.isTimePattern(fileNameParts[i], fileNameParts[i + 1], fileNameParts[i + 2])) {
                    timeStartIndex = i;
                    break;
                }
            }

            if (timeStartIndex > 0) {
                volunteerName = fileNameParts.slice(0, timeStartIndex).join('-');
            }
        }

        return {
            name: file.name,
            fileName: fileName,
            volunteerName: this.formatVolunteerName(volunteerName),
            uploadDate: file.created_at || file.updated_at || new Date().toISOString(),
            size: file.metadata?.size || 0,
            url: this.client.getFileUrl(this.bucketName, file.name),
            date: dateFolder,
            displayDate: this.formatDate(dateFolder)
        };
    }

    isTimePattern(part1, part2, part3) {
        // Check if three parts look like HH-MM-SS
        return /^\d{2}$/.test(part1) && /^\d{2}$/.test(part2) && /^\d{2}$/.test(part3);
    }

    formatVolunteerName(name) {
        return name.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    }

    formatDate(dateStr) {
        try {
            const date = new Date(dateStr + 'T00:00:00');
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateStr;
        }
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
     * Validate audio file before upload
     */
    validateAudioFile(audioBlob) {
        // Check file size (50MB limit)
        const maxSizeBytes = 50 * 1024 * 1024;
        if (audioBlob.size > maxSizeBytes) {
            throw new Error(`File too large. Maximum size: 50MB`);
        }

        // Check MIME type
        const allowedTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/mpeg'];
        if (!allowedTypes.includes(audioBlob.type)) {
            throw new Error(`Unsupported file type: ${audioBlob.type}`);
        }

        return true;
    }
}

// Export class
window.SupabaseStorage = SupabaseStorage;