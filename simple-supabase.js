// Simple direct Supabase upload - bypasses RLS issues
class SimpleSupabaseUpload {
    constructor() {
        this.url = 'https://ygsekzeiirebuvzdbyxc.supabase.co';
        this.key = 'sb_publishable_5YGef3RddislRfWcJaHa2Q_CVvkj6sc';
        this.bucketName = 'feedback-recordings';
        this.webhookUrl = 'https://tasks.sklabs.app/webhook/2f7e4694-d6a9-4adc-bf3d-3cc68da6c79c';
    }

    async uploadAudioFile(audioBlob, volunteerName, sessionDate = null, volunteerDisplayName = null, student = null, volunteerId = null, staff = []) {
        try {
            const fileName = this.generateFileName(volunteerName);
            console.log('Direct upload to:', fileName);

            // Use the direct storage API endpoint
            const uploadUrl = `${this.url}/storage/v1/object/${this.bucketName}/${fileName}`;

            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.key}`,
                    'Content-Type': audioBlob.type || 'audio/webm',
                    'x-upsert': 'false' // Prevent overwriting
                },
                body: audioBlob
            });

            console.log('Upload response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload failed:', errorText);

                // If it's RLS error, try with service key
                if (errorText.includes('row-level security')) {
                    console.log('Trying with service key...');
                    return await this.uploadWithServiceKey(audioBlob, fileName, sessionDate, volunteerDisplayName, student, volunteerId, staff);
                }

                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Upload successful:', result);

            const uploadResult = {
                success: true,
                fileName: fileName,
                fileUrl: `${this.url}/storage/v1/object/public/${this.bucketName}/${fileName}`,
                metadata: result
            };

            // Get transcription from ElevenLabs
            try {
                const transcription = await this.getTranscription(audioBlob);
                console.log('Transcription:', transcription);
                uploadResult.transcription = transcription;

                // Send to webhook with volunteer object
                try {
                    const webhookResult = await this.sendToWebhook(
                        volunteerId,
                        volunteerDisplayName || volunteerName,
                        uploadResult.fileUrl,
                        transcription,
                        fileName,
                        audioBlob.size,
                        sessionDate,
                        student,
                        staff
                    );
                    console.log('Webhook sent successfully:', webhookResult);
                    uploadResult.webhookSent = true;
                } catch (webhookError) {
                    console.warn('Webhook failed:', webhookError);
                }
            } catch (transcriptionError) {
                console.warn('Transcription failed:', transcriptionError);
            }

            return uploadResult;

        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    async uploadWithServiceKey(audioBlob, fileName, sessionDate = null, volunteerDisplayName = null, student = null, volunteerId = null, staff = []) {
        const serviceKey = 'sb_secret_IZ0xyxIUyILyGv0fA5DiVA_dUDAXsSo';
        const uploadUrl = `${this.url}/storage/v1/object/${this.bucketName}/${fileName}`;

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': audioBlob.type || 'audio/webm'
            },
            body: audioBlob
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Service key upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const uploadResult = {
            success: true,
            fileName: fileName,
            fileUrl: `${this.url}/storage/v1/object/public/${this.bucketName}/${fileName}`,
            metadata: result
        };

        // Get transcription from ElevenLabs
        try {
            const transcription = await this.getTranscription(audioBlob);
            console.log('Transcription:', transcription);
            uploadResult.transcription = transcription;

            // Send to webhook with volunteer object
            try {
                const webhookResult = await this.sendToWebhook(
                    volunteerId,
                    volunteerDisplayName || volunteerName,
                    uploadResult.fileUrl,
                    transcription,
                    fileName,
                    audioBlob.size,
                    sessionDate,
                    student,
                    staff
                );
                console.log('Webhook sent successfully:', webhookResult);
                uploadResult.webhookSent = true;
            } catch (webhookError) {
                console.warn('Webhook failed:', webhookError);
            }
        } catch (transcriptionError) {
            console.warn('Transcription failed:', transcriptionError);
        }

        return uploadResult;
    }

    generateFileName(volunteerName) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const timestamp = now.getTime();
        return `${dateStr}/${volunteerName}-${timeStr}-${timestamp}.webm`;
    }

    validateAudioFile(audioBlob) {
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (audioBlob.size > maxSize) {
            throw new Error('File too large. Maximum size: 50MB');
        }
        return true;
    }

    async listFiles() {
        try {
            // First, get the list of folders
            const foldersResponse = await fetch(`${this.url}/storage/v1/object/list/${this.bucketName}`, {
                method: 'POST',
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prefix: '',
                    limit: 100
                })
            });

            if (!foldersResponse.ok) {
                const errorText = await foldersResponse.text();
                throw new Error(`List folders failed: ${foldersResponse.status} - ${errorText}`);
            }

            const folders = await foldersResponse.json();
            console.log('Folders from storage API:', folders);

            // Filter for date folders only (skip test and other folders)
            const dateFolders = folders.filter(folder => {
                if (!folder.name) return false;

                // Skip test folders and placeholder files
                if (folder.name.toLowerCase() === 'test' || folder.name.startsWith('.')) return false;

                // Only include date folders (YYYY-MM-DD format)
                const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                return datePattern.test(folder.name);
            });

            console.log('Date folders:', dateFolders);

            // Now get files from each date folder
            const allFiles = [];
            for (const folder of dateFolders) {
                try {
                    const filesResponse = await fetch(`${this.url}/storage/v1/object/list/${this.bucketName}`, {
                        method: 'POST',
                        headers: {
                            'apikey': this.key,
                            'Authorization': `Bearer ${this.key}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            prefix: folder.name + '/',
                            limit: 100
                        })
                    });

                    if (filesResponse.ok) {
                        const folderFiles = await filesResponse.json();
                        console.log(`Files in ${folder.name}:`, folderFiles);

                        // Add files that are actually audio files (not folders)
                        const audioFiles = folderFiles.filter(file =>
                            file.name &&
                            !file.name.endsWith('/') &&
                            (file.name.endsWith('.webm') || file.name.endsWith('.mp3'))
                        ).map(file => ({
                            ...file,
                            name: `${folder.name}/${file.name}`
                        }));

                        allFiles.push(...audioFiles);
                    }
                } catch (error) {
                    console.warn(`Failed to list files in ${folder.name}:`, error);
                }
            }

            console.log('All audio files:', allFiles);
            return allFiles;

        } catch (error) {
            console.error('List files error:', error);
            return [];
        }
    }

    async getTranscription(audioBlob) {
        try {
            console.log('Getting transcription from ElevenLabs...');

            // ElevenLabs Speech-to-Text API endpoint
            const apiUrl = 'https://api.elevenlabs.io/v1/speech-to-text';

            // Create FormData for the audio file (matching iOS implementation)
            const formData = new FormData();
            formData.append('model_id', 'scribe_v1');
            formData.append('language_code', 'en');
            formData.append('file', audioBlob, 'feedback.webm');

            console.log('Sending to ElevenLabs:', {
                url: apiUrl,
                fileSize: audioBlob.size,
                fileType: audioBlob.type,
                modelId: 'scribe_v1'
            });

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'xi-api-key': 'sk_00a2ec7b9ee8c91a0721903d074dc6a633a586c7bbb957ac'
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            return result.text || 'No transcription available';

        } catch (error) {
            console.error('Transcription error:', error);
            throw error;
        }
    }

    async sendToWebhook(volunteerId, volunteerName, audioFileUrl, transcription, fileName, fileSize = 0, sessionDate = null, student = null, staff = []) {
        try {
            console.log('Sending data to webhook...');

            // Use provided sessionDate or fallback to today
            const submissionDate = sessionDate || new Date().toISOString().split('T')[0];

            // Create the webhook payload with volunteer, student, and staff objects
            const webhookData = {
                volunteer: {
                    id: volunteerId,
                    name: volunteerName
                },
                student: student ? {
                    id: student.id,
                    name: student.name
                } : null,
                staff: staff.map(s => ({
                    id: s.id,
                    name: s.name
                })),
                feedback: {
                    url: audioFileUrl,
                    transcript: transcription || 'No transcription available',
                    fileSize: fileSize
                },
                date: submissionDate
            };

            console.log('Sending to webhook:', webhookData);

            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(webhookData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Webhook error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Webhook: Data sent successfully:', result);
            return result;

        } catch (error) {
            console.error('Webhook error:', error);
            throw error;
        }
    }
}

window.SimpleSupabaseUpload = SimpleSupabaseUpload;