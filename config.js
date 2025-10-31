// Google Cloud Storage Configuration
// Update these values with your actual Google Cloud project details

const CONFIG = {
    googleCloud: {
        // Your Google Cloud project ID
        projectId: 'readingpals-473015',

        // Your Google Cloud Storage bucket name
        bucketName: 'readingpals',

        // Google Cloud Storage API endpoint
        apiEndpoint: 'https://storage.googleapis.com/upload/storage/v1/b',

        // OAuth 2.0 configuration (if using OAuth)
        oauth: {
            clientId: '589533395753-91s8n4g8bnlmuemkv8ps2vstrqnou47e.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/devstorage.full_control'
        },

        // Service Account Key (alternative to OAuth)
        // Note: For security, consider using OAuth instead of embedding keys
        serviceAccount: {
            // This would contain your service account key JSON
            // For production, load this securely or use OAuth
            keyFile: null
        }
    },

    // File upload settings
    upload: {
        maxFileSizeMB: 50,
        allowedMimeTypes: [
            'audio/webm',
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/mpeg'
        ]
    }
};

// Export configuration
window.CONFIG = CONFIG;