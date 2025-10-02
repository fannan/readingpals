class FeedbackAdmin {
    constructor() {
        this.storage = new JWTCloudStorage();
        this.files = [];
        this.filteredFiles = [];

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

    async loadFiles() {
        try {
            this.showLoading();
            this.files = await this.fetchFilesFromBucket();
            this.filteredFiles = [...this.files];
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
            // Use Google Cloud Storage JSON API to list objects
            const listUrl = `https://storage.googleapis.com/storage/v1/b/${this.storage.bucketName}/o`;

            console.log('Fetching files from:', listUrl);

            const response = await fetch(listUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch files: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                return [];
            }

            // Process and sort files
            const files = data.items
                .filter(item => item.name.endsWith('.webm') || item.name.endsWith('.mp3'))
                .map(item => this.parseFileData(item))
                .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

            return files;
        } catch (error) {
            console.error('Error fetching files:', error);
            // Return empty array if fetch fails (bucket might be empty)
            return [];
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
            url: `https://storage.googleapis.com/${this.storage.bucketName}/${item.name}`,
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

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatUploadTime(uploadDate) {
        const date = new Date(uploadDate);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updateStats() {
        this.totalFiles.textContent = this.files.length;

        const uniqueVolunteersSet = new Set(this.files.map(f => f.volunteerName));
        this.uniqueVolunteers.textContent = uniqueVolunteersSet.size;
    }

    renderFiles() {
        if (this.filteredFiles.length === 0) {
            this.filesList.innerHTML = '';
            this.noFiles.style.display = 'block';
            return;
        }

        this.noFiles.style.display = 'none';

        const filesHTML = this.filteredFiles.map(file => this.createFileItem(file)).join('');
        this.filesList.innerHTML = filesHTML;
    }

    createFileItem(file) {
        return `
            <div class="file-item p-4">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <div class="d-flex align-items-center mb-2">
                            <i class="bi bi-mic-fill text-primary me-3 fs-4"></i>
                            <div>
                                <h6 class="mb-1">${file.volunteerName}</h6>
                                <small class="text-muted">
                                    <i class="bi bi-calendar me-1"></i>${file.displayDate}
                                    <span class="mx-2">•</span>
                                    <i class="bi bi-clock me-1"></i>${this.formatUploadTime(file.uploadDate)}
                                </small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="row align-items-center">
                            <div class="col-8">
                                <audio controls class="audio-player">
                                    <source src="${file.url}" type="audio/webm">
                                    <source src="${file.url}" type="audio/mpeg">
                                    Your browser does not support the audio element.
                                </audio>
                            </div>
                            <div class="col-4 text-end">
                                <div class="d-flex flex-column gap-2">
                                    <span class="date-badge">${this.formatFileSize(file.size)}</span>
                                    <a href="${file.url}" download="${file.fileName}" class="btn btn-outline-primary btn-sm">
                                        <i class="bi bi-download"></i>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    filterFiles(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredFiles = [...this.files];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredFiles = this.files.filter(file =>
                file.volunteerName.toLowerCase().includes(term) ||
                file.displayDate.toLowerCase().includes(term) ||
                file.date.includes(term)
            );
        }
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

// Initialize the admin when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FeedbackAdmin();
});