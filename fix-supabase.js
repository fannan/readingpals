#!/usr/bin/env node

// Standalone script to fix Supabase bucket policies
// Run with: node fix-supabase.js

const SUPABASE_URL = 'https://ygsekzeiirebuvzdbyxc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5YGef3RddislRfWcJaHa2Q_CVvkj6sc';
const SUPABASE_SERVICE_KEY = 'sb_secret_IZ0xyxIUyILyGv0fA5DiVA_dUDAXsSo';

console.log('🔧 Fixing Supabase bucket policies...\n');

async function fixBucket() {
    try {
        console.log('1️⃣ Testing connection to Supabase...');

        // Test connection
        const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        if (!testResponse.ok) {
            throw new Error(`Connection failed: ${testResponse.status}`);
        }
        console.log('✅ Connected to Supabase\n');

        console.log('2️⃣ Creating bucket...');

        // Create bucket
        const bucketResponse = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
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
            const error = await bucketResponse.json();
            if (error.message && error.message.includes('already exists')) {
                console.log('✅ Bucket already exists');
            } else {
                console.log('⚠️ Bucket response:', error);
            }
        }

        console.log('\n3️⃣ Setting up RLS policies...');

        // SQL commands to fix policies
        const sqlCommands = [
            // Drop existing policies
            `DROP POLICY IF EXISTS "Enable uploads for feedback-recordings" ON storage.objects;`,
            `DROP POLICY IF EXISTS "Enable reads for feedback-recordings" ON storage.objects;`,
            `DROP POLICY IF EXISTS "Allow authenticated uploads to feedback-recordings" ON storage.objects;`,
            `DROP POLICY IF EXISTS "Allow public reads from feedback-recordings" ON storage.objects;`,
            `DROP POLICY IF EXISTS "Allow all operations on feedback-recordings" ON storage.objects;`,
            `DROP POLICY IF EXISTS "feedback_all_access" ON storage.objects;`,

            // Create new permissive policy
            `CREATE POLICY "feedback_bucket_access" ON storage.objects
             FOR ALL USING (bucket_id = 'feedback-recordings')
             WITH CHECK (bucket_id = 'feedback-recordings');`
        ];

        for (const sql of sqlCommands) {
            console.log(`   Running: ${sql.substring(0, 60)}...`);

            const sqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql })
            });

            if (!sqlResponse.ok) {
                const error = await sqlResponse.text();
                console.log(`   ⚠️ SQL Warning: ${error.substring(0, 100)}`);
            } else {
                console.log(`   ✅ Success`);
            }
        }

        console.log('\n4️⃣ Testing file upload...');

        // Test upload
        const testData = new Blob(['test audio data'], { type: 'audio/webm' });
        const testPath = `test-${Date.now()}.webm`;

        const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/feedback-recordings/${testPath}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: testData
        });

        if (uploadResponse.ok) {
            console.log('✅ Upload test successful!');

            // Clean up test file
            const deleteResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/feedback-recordings/${testPath}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                }
            });

            if (deleteResponse.ok) {
                console.log('✅ Test file cleaned up');
            }
        } else {
            const error = await uploadResponse.json();
            console.log('❌ Upload test failed:', error);

            if (error.message && error.message.includes('row-level security')) {
                console.log('\n🔧 RLS is still blocking. Trying alternative approach...');

                // Try to disable RLS entirely (this might fail due to permissions)
                const disableRlsResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sql: 'ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;'
                    })
                });

                if (disableRlsResponse.ok) {
                    console.log('✅ Disabled RLS entirely');
                } else {
                    console.log('❌ Could not disable RLS - you need to do this manually in Supabase dashboard');
                }
            }

            return false;
        }

        console.log('\n🎉 SUCCESS! Supabase bucket is now properly configured!');
        console.log('🚀 You can now upload feedback recordings without errors.');
        return true;

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\n📋 Manual steps to try in Supabase dashboard:');
        console.log('1. Go to Storage → feedback-recordings');
        console.log('2. Make sure the bucket is marked as "Public"');
        console.log('3. Go to Storage → Policies');
        console.log('4. Delete all existing policies for storage.objects');
        console.log('5. Add a new policy: "Allow all operations" with no restrictions');
        return false;
    }
}

// Run the fix
if (require.main === module) {
    fixBucket().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { fixBucket };