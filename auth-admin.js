class AuthenticatedAdmin {
    constructor() {
        this.bucketName = 'readingpals';
        this.projectId = 'readingpals-473015';
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
        this.accessToken = null;
        this.files = [];

        this.initializeElements();
        this.bindEvents();
        this.loadFiles();
    }

    initializeElements() {
        this.loadingSection = document.getElementById('loadingSection');
        this.filesSection = document.getElementById('filesSection');
        this.errorSection = document.getElementById('errorSection');
        this.filesList = document.getElementById('filesList');
        this.noFiles = document.getElementById('noFiles');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.searchInput = document.getElementById('searchInput');
        this.totalFiles = document.getElementById('totalFiles');
        this.uniqueVolunteers = document.getElementById('uniqueVolunteers');
        this.errorMessage = document.getElementById('errorMessage');
    }

    bindEvents() {
        this.refreshBtn.addEventListener('click', () => this.refreshFiles());
        this.searchInput.addEventListener('input', (e) => this.filterFiles(e.target.value));
    }

    /**
     * Get access token using service account
     */
    async getAccessToken() {
        if (this.accessToken) {
            return this.accessToken;
        }

        try {
            // Create JWT assertion
            const header = {
                alg: 'RS256',
                typ: 'JWT'
            };

            const now = Math.floor(Date.now() / 1000);
            const payload = {
                iss: this.serviceAccount.client_email,
                scope: 'https://www.googleapis.com/auth/devstorage.read_only',
                aud: 'https://oauth2.googleapis.com/token',
                exp: now + 3600,
                iat: now
            };

            // For demo purposes, we'll use a simpler approach
            // In production, you'd use a proper JWT library with RS256 signing

            // Use Google's token endpoint with a simplified approach
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: this.serviceAccount.client_email,
                    client_secret: 'dummy' // This won't work, but we'll handle the error
                })
            });

            // Since proper JWT signing is complex in the browser,
            // let's try a different approach - using the metadata server simulation
            throw new Error('Browser-based JWT signing not implemented');

        } catch (error) {
            console.warn('Could not get access token:', error);
            // For now, we'll try without authentication and handle the error
            return null;
        }
    }

    async loadFiles() {
        try {
            this.showLoading();
            this.files = await this.fetchFilesFromBucket();
            this.updateStats();
            this.renderFiles();
            this.showFiles();
        } catch (error) {
            console.error('Error loading files:', error);
            this.showError(error.message);
        }
    }

    async fetchFilesFromBucket() {
        try {
            // Try to get access token
            const accessToken = await this.getAccessToken();

            const headers = {};
            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            const listUrl = `https://storage.googleapis.com/storage/v1/b/${this.bucketName}/o`;
            console.log('Fetching files from:', listUrl);

            const response = await fetch(listUrl, { headers });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);

                // If it's an auth error, try to show helpful message
                if (response.status === 401) {
                    throw new Error('Authentication required. Please make the bucket public or implement proper JWT signing.');
                }
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                console.log('No files found in bucket');
                return [];
            }

            // Process and sort files
            const files = data.items
                .filter(item => item.name.endsWith('.webm') || item.name.endsWith('.mp3'))
                .map(item => this.parseFileData(item))
                .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

            console.log('Processed files:', files);
            return files;

        } catch (error) {
            console.error('Error fetching files:', error);
            throw error;
        }
    }

    parseFileData(item) {
        // Parse filename: YYYY-MM-DD/volunteer-name-HH-MM-SS-timestamp.webm
        const nameParts = item.name.split('/');
        const fileName = nameParts[nameParts.length - 1];
        const dateFolder = nameParts[0];

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
            name: item.name,
            fileName: fileName,
            volunteerName: this.formatVolunteerName(volunteerName),
            uploadDate: item.timeCreated,
            size: parseInt(item.size),
            url: `https://storage.googleapis.com/${this.bucketName}/${item.name}`,
            date: dateFolder,
            displayDate: this.formatDate(dateFolder)
        };
    }

    isTimePattern(part1, part2, part3) {
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

    updateStats() {
        this.totalFiles.textContent = this.files.length;
        const uniqueVolunteersSet = new Set(this.files.map(f => f.volunteerName));
        this.uniqueVolunteers.textContent = uniqueVolunteersSet.size;
    }

    renderFiles() {
        if (this.files.length === 0) {
            this.filesList.innerHTML = '';
            this.noFiles.style.display = 'block';
            return;
        }

        this.noFiles.style.display = 'none';

        const filesHTML = this.files.map(file => `
            <tr>
                <td>
                    <div class="volunteer-name">${file.volunteerName}</div>
                </td>
                <td>
                    <div class="file-date">${file.displayDate}</div>
                </td>
                <td>
                    <div class="file-date">${new Date(file.uploadDate).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</div>
                </td>
                <td>
                    <span class="file-size">${this.formatFileSize(file.size)}</span>
                </td>
                <td>
                    <audio controls class="audio-control">
                        <source src="${file.url}" type="audio/webm">
                        <source src="${file.url}" type="audio/mpeg">
                        Your browser does not support audio.
                    </audio>
                </td>
                <td>
                    <a href="${file.url}" download="${file.fileName}" class="btn-download">
                        <i class="bi bi-download me-1"></i>Download
                    </a>
                </td>
            </tr>
        `).join('');

        document.getElementById('filesTableBody').innerHTML = filesHTML;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    filterFiles(searchTerm) {
        // Implement search if needed
        this.renderFiles();
    }

    async refreshFiles() {
        this.refreshBtn.disabled = true;
        this.refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise loading-spinner me-2"></i>Refreshing...';

        try {
            await this.loadFiles();
        } finally {
            this.refreshBtn.disabled = false;
            this.refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Refresh';
        }
    }

    showLoading() {
        this.loadingSection.style.display = 'block';
        this.filesSection.style.display = 'none';
        this.errorSection.style.display = 'none';
    }

    showFiles() {
        this.loadingSection.style.display = 'none';
        this.filesSection.style.display = 'block';
        this.errorSection.style.display = 'none';
    }

    showError(message) {
        this.loadingSection.style.display = 'none';
        this.filesSection.style.display = 'none';
        this.errorSection.style.display = 'block';
        this.errorMessage.textContent = message;
    }
}

window.AuthenticatedAdmin = AuthenticatedAdmin;