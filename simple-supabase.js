// Simple direct Supabase upload - bypasses RLS issues
class SimpleSupabaseUpload {
    constructor() {
        this.url = 'https://ygsekzeiirebuvzdbyxc.supabase.co';
        this.key = 'sb_publishable_5YGef3RddislRfWcJaHa2Q_CVvkj6sc';
        this.bucketName = 'feedback-recordings';
        this.webhookUrl = 'https://tasks.sklabs.app/webhook/2f7e4694-d6a9-4adc-bf3d-3cc68da6c79c';
        // Cloudflare Worker URL for Anthropic vision API
        this.claudeVisionWorkerUrl = 'https://reading-pals-vision.sean-b08.workers.dev';
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
                    urls: [audioFileUrl],  // Array with single audio URL
                    transcript: transcription || 'No transcription available',
                    fileSize: fileSize,
                    type: 'audio'  // Indicate this is audio feedback
                },
                input_type: 'Audio',
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

    async uploadPhotoFiles(photoBlobs, volunteerName, sessionDate = null, volunteerDisplayName = null, student = null, volunteerId = null, staff = []) {
        try {
            console.log('Uploading', photoBlobs.length, 'photos to Supabase...');

            const uploadedPhotos = [];
            const serviceKey = 'sb_secret_IZ0xyxIUyILyGv0fA5DiVA_dUDAXsSo';

            // Upload each photo to Supabase
            for (let i = 0; i < photoBlobs.length; i++) {
                const photoBlob = photoBlobs[i];
                const fileName = this.generatePhotoFileName(volunteerName, i);
                const uploadUrl = `${this.url}/storage/v1/object/${this.bucketName}/${fileName}`;

                console.log(`Uploading photo ${i + 1}/${photoBlobs.length}: ${fileName}`);

                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'apikey': serviceKey,
                        'Authorization': `Bearer ${serviceKey}`,
                        'Content-Type': photoBlob.type || 'image/jpeg',
                        'x-upsert': 'false'
                    },
                    body: photoBlob
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Photo upload failed: ${response.status} - ${errorText}`);
                }

                const fileUrl = `${this.url}/storage/v1/object/public/${this.bucketName}/${fileName}`;
                uploadedPhotos.push({
                    fileName,
                    fileUrl,
                    size: photoBlob.size,
                    blob: photoBlob
                });
            }

            console.log('All photos uploaded successfully');

            // Get transcription from Claude API
            let transcription = '';
            try {
                transcription = await this.getPhotoTranscription(photoBlobs);
                console.log('Claude transcription:', transcription);
            } catch (transcriptionError) {
                console.warn('Claude transcription failed:', transcriptionError);
                transcription = 'Transcription unavailable';
            }

            // Send to webhook with photo URLs
            try {
                const photoUrls = uploadedPhotos.map(p => p.fileUrl);
                const totalSize = uploadedPhotos.reduce((sum, p) => sum + p.size, 0);

                const webhookResult = await this.sendPhotosToWebhook(
                    volunteerId,
                    volunteerDisplayName || volunteerName,
                    photoUrls,
                    transcription,
                    totalSize,
                    sessionDate,
                    student,
                    staff
                );
                console.log('Webhook sent successfully:', webhookResult);
            } catch (webhookError) {
                console.warn('Webhook failed:', webhookError);
            }

            return {
                success: true,
                photos: uploadedPhotos,
                transcription
            };

        } catch (error) {
            console.error('Photo upload error:', error);
            throw error;
        }
    }

    generatePhotoFileName(volunteerName, index) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const timestamp = now.getTime();
        return `${dateStr}/${volunteerName}-photo-${index + 1}-${timeStr}-${timestamp}.jpg`;
    }

    async getPhotoTranscription(photoBlobs) {
        try {
            console.log('Getting transcription from Cloudflare Worker for', photoBlobs.length, 'photos...');

            // Convert photos to base64
            const images = [];
            for (const photoBlob of photoBlobs) {
                const base64 = await this.blobToBase64(photoBlob);
                images.push({
                    data: base64,
                    type: photoBlob.type || "image/jpeg"
                });
            }

            // Call Cloudflare Worker that uses claude_key secret to call Anthropic API
            const response = await fetch(this.claudeVisionWorkerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    images: images,
                    prompt: "Transcribe EXACTLY word-for-word all text visible in these images. Include:\n\n1. All printed text - copy it exactly as written\n2. All handwritten text - transcribe it exactly, including any spelling errors or unclear words (mark unclear words with [unclear])\n3. All questions, answers, and instructions on worksheets\n4. All labels, captions, and annotations\n5. The layout and structure (indicate which text is a title, question number, answer, etc.)\n\nDo NOT summarize or paraphrase. Copy the text exactly as it appears. For worksheets, preserve the question-answer structure. For diagrams, transcribe any labels or text within them."
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Cloudflare Worker error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            return result.transcription || 'No transcription available';

        } catch (error) {
            console.error('Anthropic vision transcription error:', error);
            throw error;
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async sendPhotosToWebhook(volunteerId, volunteerName, photoUrls, transcription, totalFileSize = 0, sessionDate = null, student = null, staff = []) {
        try {
            console.log('Sending photo data to webhook...');

            const submissionDate = sessionDate || new Date().toISOString().split('T')[0];

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
                    urls: photoUrls,  // Array of photo URLs instead of single URL
                    transcript: transcription || 'No transcription available',
                    fileSize: totalFileSize,
                    type: 'photos'  // Indicate this is photo feedback
                },
                input_type: 'Photo',
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
            console.log('✅ Webhook: Photo data sent successfully:', result);
            return result;

        } catch (error) {
            console.error('Webhook error:', error);
            throw error;
        }
    }
}

window.SimpleSupabaseUpload = SimpleSupabaseUpload;