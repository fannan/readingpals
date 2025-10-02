// Fix Supabase bucket policies using the API
async function fixSupabaseBucket() {
    const SUPABASE_URL = 'https://ygsekzeiirebuvzdbyxc.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_5YGef3RddislRfWcJaHa2Q_CVvkj6sc';

    console.log('Fixing Supabase bucket policies...');

    try {
        // 1. Create/update bucket to be public
        console.log('Creating/updating bucket...');
        const bucketResponse = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: 'feedback-recordings',
                name: 'feedback-recordings',
                public: true,
                file_size_limit: 52428800,
                allowed_mime_types: ['audio/*']
            })
        });

        if (bucketResponse.ok) {
            console.log('✅ Bucket created successfully');
        } else {
            const bucketError = await bucketResponse.json();
            if (bucketError.message && bucketError.message.includes('already exists')) {
                console.log('✅ Bucket already exists');
            } else {
                console.log('Bucket response:', bucketError);
            }
        }

        // 2. Run SQL to fix RLS policies
        console.log('Fixing RLS policies...');
        const sqlCommands = [
            // Delete existing policies
            "DROP POLICY IF EXISTS \"Enable uploads for feedback-recordings\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Enable reads for feedback-recordings\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Allow authenticated uploads to feedback-recordings\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Allow public reads from feedback-recordings\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Allow all operations on feedback-recordings\" ON storage.objects;",

            // Create new permissive policy
            "CREATE POLICY \"feedback_all_access\" ON storage.objects FOR ALL USING (bucket_id = 'feedback-recordings') WITH CHECK (bucket_id = 'feedback-recordings');",

            // Grant permissions
            "GRANT USAGE ON SCHEMA storage TO anon, authenticated;",
            "GRANT ALL ON storage.objects TO anon, authenticated;",
            "GRANT ALL ON storage.buckets TO anon, authenticated;"
        ];

        for (const sql of sqlCommands) {
            console.log(`Running: ${sql.substring(0, 50)}...`);

            const sqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql })
            });

            if (!sqlResponse.ok) {
                const sqlError = await sqlResponse.text();
                console.log(`SQL Error for "${sql}":`, sqlError);
            }
        }

        // 3. Test upload
        console.log('Testing upload...');
        const testBlob = new Blob(['test'], { type: 'audio/webm' });
        const testPath = 'test/test-file.webm';

        const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/feedback-recordings/${testPath}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
            body: testBlob
        });

        if (uploadResponse.ok) {
            console.log('✅ Upload test successful!');

            // Clean up test file
            await fetch(`${SUPABASE_URL}/storage/v1/object/feedback-recordings/${testPath}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                }
            });
        } else {
            const uploadError = await uploadResponse.json();
            console.log('❌ Upload test failed:', uploadError);
            return false;
        }

        console.log('🎉 Supabase bucket is now properly configured!');
        return true;

    } catch (error) {
        console.error('Error fixing bucket:', error);
        return false;
    }
}

// Auto-run when page loads
if (typeof window !== 'undefined') {
    window.fixSupabaseBucket = fixSupabaseBucket;

    // Auto-fix on page load
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('Auto-fixing Supabase bucket...');
        await fixSupabaseBucket();
    });
}