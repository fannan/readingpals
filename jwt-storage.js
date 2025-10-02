class JWTCloudStorage {
    constructor() {
        this.bucketName = CONFIG.googleCloud.bucketName;
        this.projectId = CONFIG.googleCloud.projectId;
        this.serviceAccount = {
            client_email: "feedback-uploader@readingpals-473015.iam.gserviceaccount.com",
            private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDulTQxmAxXDqQl
Yl2EaU1+ywe8SK3+Tm7l8TWh4w3YTPFDyTpT6PU/2d+ozC5HOYEdAL7Jn8SUtp7Q
l5o7VzapbRX4zyL6cl1YO3jyH5buopY8kXQSyn4IJH7Bf6nXVKiy0ePJMPUovVoj
qxdU175Joz9v7xV267IeJhIqfQVV+JAtP4d6l/sraKM0fllpz38z66Qjd4g002ac
yESVY3sVRgtudj6IsfWvqf2f+sOh5yUQ0HfGHqhH6Hb28+TdePEuiQfIBQkDy+29
IZEDbDiU9eV/XKOgRJn05irPj4LW3xivgve2Uub1YsZA7kUztu06WIqN04ZMneYF
EvO8ihzbAgMBAAECggEAVbP3OdF6rVMvF9bL7SK+mctpDfO1vOKD58nMEEk10fth
t43zi+zlHHixZTtjbGZ1wOthnZ/sx9cKGbg7yRE9K4NqHySZVgn7ChTjD2bVmweA
nGVLouxmdZpWhj/LzPQ2XXYUM1OI3YeXd7Sf/vQ5AM7JnPXvafak1zupzuV2Izkj
To4LDTDeSD4DP6J49Cl2TEwPQS1ZWdKiMqGtW9fgeuuWnAAoS2yMqLvlaTM6JynS
pPE+7gx5LEKnf80I88HEzZFsgG6N00vhM+kaPpg/wn8jOPxQznUy9rXXqzLH8JpJ
sg/pWZx1g5aGttic/raqOVZRJRgVnpWA8WM71pofoQKBgQD6xhKTz3mjY4FKNjth
J/QrXwAPOKMxQmehsoVeCDw1UueZnGRxDlAZ2W0EAPzkNFi058AFJBiippdetX/0
zGh3v8SBwrtE3xxYxaGfJiyXKsV1n7KHvz0xYJ+sTpypQj0F32eR7IOheujGX1+v
fIll++xovRO4ewCRJcCOgdNNcwKBgQDzjhcqDDQ/zVZsDHHPMH89aWoIFUwlSF7k
2YQ2Bm474HfJXLqRFl/FHhxJJJW/pjufWJXrPDnVxphpBi7KoQ1saaHxX0V6nRwZ
zt7aW4kzjkKOc1dFilyU1o485jnS/18g96DJZqkzFCv8IBzSI8r57EXfGQyW9lBI
P6S4rfsY+QKBgQDOvilmrq/rogdfNWKy8It+ji2wXtM7szFYv6LwKP3qQFUr8SFl
i5VCGlyj5mSXhwhy7HUESAP/ZDR7IktBeJvPzcul5vMZDo+CKDzcxk4QunRcSrKW
83TxlmVNWuoRKMjCZLIwPbsvj/MESHDMbnGgIJeAqhDuEIohH+ymECYyPQKBgAPm
8OQRkfy7s3jDskcZhdBcEgDTJocqY6rS+VVMQRPggsrNG4gbjalA1D8vwN5zMV1a
M/yy2FJefi6glLtWXTqxbpDJb/mI7txS/isNcGNNEi/qFSneD6Gq1liPb7m7sbB7
hy3y4R8aYaIGea+8NxJOAMiURClfBOZDbsYus2kxAoGBAJO5cNPS7ruxvDa15Lw5
oq0FYodPGecUPuc+i8DIJJnO8vBBeOmYPJH7RHkAiAu+yd0ThkDq9HU2U111Si8E
swZ/fGfKUfyMPfBmYmuWcO2grUU9X64HiHTbVdRx+2fcTVCzZU6RT18ufue3bvaQ
WX3el1fa4zGz24CtIcC33cFT
-----END PRIVATE KEY-----`
        };
    }

    /**
     * Create JWT token for service account authentication
     */
    async createJWT() {
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: this.serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/devstorage.full_control',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600, // 1 hour
            iat: now
        };

        // For browser compatibility, we'll use a simpler approach
        // In production, you'd want to use a proper JWT library
        const token = await this.signJWT(header, payload);
        return token;
    }

    /**
     * Simple JWT signing for demo purposes
     * Note: In production, use a proper crypto library
     */
    async signJWT(header, payload) {
        // This is a simplified implementation
        // For production, you'd need proper RS256 signing
        const headerB64 = btoa(JSON.stringify(header));
        const payloadB64 = btoa(JSON.stringify(payload));

        // For demo, we'll return a mock token
        // In reality, you'd need to implement proper RS256 signing
        return `${headerB64}.${payloadB64}.mock_signature`;
    }

    /**
     * Get access token using service account
     */
    async getAccessToken() {
        try {
            const jwt = await this.createJWT();

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt
                })
            });

            if (!response.ok) {
                throw new Error(`Token request failed: ${response.status}`);
            }

            const tokenData = await response.json();
            return tokenData.access_token;
        } catch (error) {
            console.error('Failed to get access token:', error);
            throw error;
        }
    }

    /**
     * Upload audio file using service account authentication
     */
    async uploadAudioFile(audioBlob, volunteerName) {
        try {
            // For now, let's try the simple public upload first
            // If that fails, we can implement proper JWT signing
            return await this.uploadPublic(audioBlob, volunteerName);
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    /**
     * Upload using public endpoint (requires bucket to allow public uploads)
     */
    async uploadPublic(audioBlob, volunteerName) {
        const fileName = this.generateFileName(volunteerName);
        const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucketName}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;

        console.log('Uploading to:', uploadUrl);

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': audioBlob.type
            },
            body: audioBlob
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload error:', errorText);
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
        const maxSizeBytes = CONFIG.upload.maxFileSizeMB * 1024 * 1024;
        if (audioBlob.size > maxSizeBytes) {
            throw new Error(`File too large. Maximum size: ${CONFIG.upload.maxFileSizeMB}MB`);
        }

        if (!CONFIG.upload.allowedMimeTypes.includes(audioBlob.type)) {
            throw new Error(`Unsupported file type: ${audioBlob.type}`);
        }

        return true;
    }
}

window.JWTCloudStorage = JWTCloudStorage;