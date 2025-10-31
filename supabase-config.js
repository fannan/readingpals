// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://ygsekzeiirebuvzdbyxc.supabase.co',
    publishableKey: 'sb_publishable_5YGef3RddislRfWcJaHa2Q_CVvkj6sc',
    bucketName: 'feedback-recordings'
};

// Load Supabase SDK
function loadSupabaseSDK() {
    return new Promise((resolve) => {
        if (window.supabase) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

// Initialize Supabase client with proper SDK
class SupabaseClient {
    constructor() {
        this.url = SUPABASE_CONFIG.url;
        this.key = SUPABASE_CONFIG.publishableKey;
        this.bucketName = SUPABASE_CONFIG.bucketName;
        this.client = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Load the Supabase SDK
            await loadSupabaseSDK();

            // Initialize the client
            this.client = window.supabase.createClient(this.url, this.key, {
                auth: {
                    persistSession: false
                }
            });

            this.initialized = true;
            console.log('Supabase client initialized');
        } catch (error) {
            console.error('Failed to initialize Supabase client:', error);
            throw error;
        }
    }

    async uploadFile(bucketName, path, file) {
        if (!this.initialized) await this.initialize();

        try {
            const { data, error } = await this.client.storage
                .from(bucketName)
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Upload error:', error);
                throw error;
            }

            return { ok: true, json: () => Promise.resolve(data) };
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    async listFiles(bucketName, folder = '') {
        if (!this.initialized) await this.initialize();

        try {
            const { data, error } = await this.client.storage
                .from(bucketName)
                .list(folder, {
                    limit: 100,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                console.error('List files error:', error);
                throw error;
            }

            return { ok: true, json: () => Promise.resolve(data || []) };
        } catch (error) {
            console.error('List files failed:', error);
            throw error;
        }
    }

    getFileUrl(bucketName, path) {
        if (!this.initialized || !this.client) {
            return `${this.url}/storage/v1/object/public/${bucketName}/${path}`;
        }

        const { data } = this.client.storage
            .from(bucketName)
            .getPublicUrl(path);

        return data.publicUrl;
    }

    async createBucket(bucketName, isPublic = true) {
        if (!this.initialized) await this.initialize();

        try {
            const { data, error } = await this.client.storage.createBucket(bucketName, {
                public: isPublic,
                fileSizeLimit: 52428800 // 50MB
            });

            if (error && !error.message.includes('already exists')) {
                console.error('Create bucket error:', error);
                throw error;
            }

            return { ok: true, json: () => Promise.resolve(data) };
        } catch (error) {
            console.error('Create bucket failed:', error);
            throw error;
        }
    }
}

// Export for use in other files
window.SupabaseClient = SupabaseClient;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;