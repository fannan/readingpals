class SimpleCloudStorage {
    constructor() {
        this.bucketName = CONFIG.googleCloud.bucketName;
        this.projectId = CONFIG.googleCloud.projectId;
    }

    /**
     * Upload audio file using signed URL (no authentication required)
     */
    async uploadAudioFile(audioBlob, volunteerName) {
        try {
            // For now, let's use the public upload endpoint
            // This requires the bucket to allow public uploads
            const fileName = this.generateFileName(volunteerName);
            const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucketName}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;

            console.log('Uploading to:', uploadUrl);

            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': audioBlob.type,
                    'Content-Length': audioBlob.size.toString()
                },
                body: audioBlob
            });

            console.log('Upload response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload error response:', errorText);
                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Upload successful:', result);

            return {
                success: true,
                fileName: fileName,
                fileUrl: `https://storage.googleapis.com/${this.bucketName}/${fileName}`,
                metadata: result
            };

        } catch (error) {
            console.error('Upload error:', error);
            throw error;
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
        // Check file size
        const maxSizeBytes = CONFIG.upload.maxFileSizeMB * 1024 * 1024;
        if (audioBlob.size > maxSizeBytes) {
            throw new Error(`File too large. Maximum size: ${CONFIG.upload.maxFileSizeMB}MB`);
        }

        // Check MIME type
        if (!CONFIG.upload.allowedMimeTypes.includes(audioBlob.type)) {
            throw new Error(`Unsupported file type: ${audioBlob.type}`);
        }

        return true;
    }
}

// Export class
window.SimpleCloudStorage = SimpleCloudStorage;