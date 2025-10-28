class FeedbackAdmin {
    constructor() {
        this.feedbackRecords = [];
        this.filteredRecords = [];
        this.availableDates = [];
        this.selectedDate = null;
        this.notionApiUrl = 'https://tasks.sklabs.app/webhook/d62d9936-6521-4b54-b58f-cae39569b8f7';
        this.datesApiUrl = 'https://tasks.sklabs.app/webhook/80337e94-93a5-407a-94d1-746efcbb4d3c';

        // Track optimistic absent state changes
        // Key format: "volunteerId-studentId-date"
        this.optimisticAbsentChanges = new Map();

        this.initializeElements();
        this.bindEvents();
        this.loadAvailableDates();
    }

    initializeElements() {
        this.loadingSection = document.getElementById('loadingSection');
        this.filesSection = document.getElementById('filesSection');
        this.errorSection = document.getElementById('errorSection');
        this.filesList = document.getElementById('filesList');
        this.noFiles = document.getElementById('noFiles');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.dateSelect = document.getElementById('dateSelect');
    }

    bindEvents() {
        this.refreshBtn.addEventListener('click', () => this.refreshFiles());
        if (this.dateSelect) {
            this.dateSelect.addEventListener('change', () => this.onDateSelected());
        }
    }

    async loadAvailableDates() {
        try {
            console.log('Loading available dates from API...');
            const response = await fetch(this.datesApiUrl);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const result = await response.json();
            const data = Array.isArray(result) ? result[0] : result;

            if (data.data && Array.isArray(data.data)) {
                this.availableDates = data.data.map(item => ({
                    date: item.name,
                    day: item.day_name,
                    staff: item.staff || [],
                    schedule_id: item.schedule_id
                }));
            } else {
                this.availableDates = [];
            }

            console.log('Available dates loaded:', this.availableDates);
            this.populateDateDropdown();
            this.selectClosestFutureDate();

        } catch (error) {
            console.error('Failed to load dates:', error);
            this.showError('Failed to load available dates');
        }
    }

    populateDateDropdown() {
        if (!this.dateSelect) return;

        this.dateSelect.innerHTML = '<option value="">Select a date...</option>';

        if (this.availableDates.length === 0) {
            this.dateSelect.innerHTML = '<option value="">No dates available</option>';
            return;
        }

        this.availableDates.forEach(dateObj => {
            const option = document.createElement('option');
            option.value = dateObj.date;
            option.textContent = this.formatDateForDisplay(dateObj);
            this.dateSelect.appendChild(option);
        });
    }

    formatDateForDisplay(dateObj) {
        try {
            const [year, month, day] = dateObj.date.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDate = date.toLocaleDateString('en-US', options);
            return `${dateObj.day}, ${formattedDate}`;
        } catch (error) {
            return dateObj.date;
        }
    }

    selectClosestFutureDate() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let closestDateObj = null;
        let minDiff = Infinity;

        this.availableDates.forEach(dateObj => {
            const [year, month, day] = dateObj.date.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            date.setHours(0, 0, 0, 0);

            const diff = date - today;

            if (diff >= 0 && diff < minDiff) {
                minDiff = diff;
                closestDateObj = dateObj;
            }
        });

        if (!closestDateObj && this.availableDates.length > 0) {
            closestDateObj = this.availableDates.reduce((latest, current) => {
                const [y1, m1, d1] = latest.date.split('-').map(Number);
                const [y2, m2, d2] = current.date.split('-').map(Number);
                const date1 = new Date(y1, m1 - 1, d1);
                const date2 = new Date(y2, m2 - 1, d2);
                return date2 > date1 ? current : latest;
            });
        }

        if (closestDateObj && this.dateSelect) {
            this.dateSelect.value = closestDateObj.date;
            this.selectedDate = closestDateObj.date;
            console.log('Pre-selected date:', closestDateObj.date);
            this.loadFeedback();
        }
    }

    onDateSelected() {
        this.selectedDate = this.dateSelect.value;
        console.log('Date selected:', this.selectedDate);

        if (this.selectedDate) {
            this.loadFeedback();
        }
    }

    async loadFeedback() {
        if (!this.selectedDate) {
            this.showError('Please select a date');
            return;
        }

        try {
            this.showLoading();

            // Fetch both feedback records and scheduled pairs
            const [feedbackRecords, scheduledPairs, absentList] = await Promise.all([
                this.fetchFeedbackFromNotion(this.selectedDate),
                this.fetchScheduledPairs(this.selectedDate),
                this.fetchAbsentList(this.selectedDate)
            ]);

            this.feedbackRecords = feedbackRecords;
            this.scheduledPairs = scheduledPairs;
            this.absentList = absentList;

            // Create combined grid data
            this.gridData = this.createGridData(scheduledPairs, feedbackRecords, absentList);

            this.updateStats();
            this.renderGrid();
            this.showFiles();
        } catch (error) {
            console.error('Error loading feedback:', error);
            this.showError(error.message);
        }
    }

    async fetchScheduledPairs(date) {
        // Get scheduled volunteer-student pairs from the dates API
        const dateObj = this.availableDates.find(d => d.date === date);
        if (!dateObj) return [];

        // Need to fetch volunteer details with their students
        const response = await fetch(this.datesApiUrl);
        const result = await response.json();
        const data = Array.isArray(result) ? result[0] : result;

        if (!data.volunteers) return [];

        // Find the selected date's scheduled volunteers
        const selectedDateData = data.data.find(d => d.name === date);
        if (!selectedDateData || !selectedDateData.volunteers) return [];

        // Get the schedule_id for this date
        const scheduleId = selectedDateData.schedule_id;

        // Create a set of volunteer IDs scheduled for this date
        const scheduledVolunteerIds = selectedDateData.volunteers.map(v => v.id);

        // Get full volunteer data with students for scheduled volunteers
        const scheduledPairs = [];
        data.volunteers.forEach(volunteer => {
            if (scheduledVolunteerIds.includes(volunteer.id)) {
                volunteer.students.forEach(student => {
                    scheduledPairs.push({
                        volunteerId: volunteer.id,
                        volunteerName: volunteer.name,
                        studentId: student.id,
                        studentName: student.name,
                        scheduleId: scheduleId
                    });
                });
            }
        });

        return scheduledPairs;
    }

    async fetchAbsentList(date) {
        try {
            const response = await fetch(this.datesApiUrl);
            const result = await response.json();
            const data = Array.isArray(result) ? result[0] : result;

            // Filter absent records for the selected date
            if (data.absent && Array.isArray(data.absent)) {
                return data.absent.filter(a => a.date === date);
            }

            return [];
        } catch (error) {
            console.error('Error fetching absent list:', error);
            return [];
        }
    }

    createGridData(scheduledPairs, feedbackRecords, absentList) {
        // Create a map of schedule pairs with their feedback status
        return scheduledPairs.map(pair => {
            // Find all feedback records for this pair
            const feedback = feedbackRecords.filter(f =>
                f.volunteerId === pair.volunteerId &&
                f.studentId === pair.studentId
            );

            // Check if this pair is marked as absent in the API data
            const isAbsentInAPI = absentList.some(a =>
                a.volunteer_id === pair.volunteerId &&
                a.student_id === pair.studentId
            );

            // Check for optimistic updates
            const optimisticKey = `${pair.volunteerId}-${pair.studentId}-${this.selectedDate}`;
            const optimisticChange = this.optimisticAbsentChanges.get(optimisticKey);

            // Determine final absent state
            let isAbsent;
            if (optimisticChange !== undefined) {
                // Use optimistic state if available
                isAbsent = optimisticChange;
            } else {
                // Otherwise use API data
                isAbsent = isAbsentInAPI;
            }

            return {
                ...pair,
                hasFeedback: feedback.length > 0,
                feedbackRecords: feedback,
                feedbackCount: feedback.length,
                isAbsent: isAbsent
            };
        });
    }

    async fetchFeedbackFromNotion(date) {
        try {
            console.log('Fetching feedback from API for date:', date);

            const response = await fetch(`${this.notionApiUrl}?date=${date}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch feedback: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API response:', data);

            // Handle the response format - expecting an array of feedback records
            const records = Array.isArray(data) ? data : (data.results || []);

            // Transform records to match our display format
            return records.map(record => this.parseFeedbackRecord(record));

        } catch (error) {
            console.error('Error fetching feedback:', error);
            throw error;
        }
    }

    parseFeedbackRecord(record) {
        // Parse the feedback record from your actual API response format
        return {
            id: record.id,
            volunteerName: this.extractNameFromMeetingName(record.property_meeting_name, 'volunteer'),
            volunteerId: record.property_volunteer?.[0] || null,
            studentName: this.extractNameFromMeetingName(record.property_meeting_name, 'student'),
            studentId: record.property_student?.[0] || null,
            scheduleId: record.property_schedule?.[0] || null,
            urls: record.property_urls || [],
            inputType: record.property_input_type || 'Audio',
            wordAccuracy: record.property_word_accuracy || 0,
            readingLevel: record.property_reading_level || '',
            date: record.property_date_pretty || record.property_date?.start?.split('T')[0] || '',
            createdAt: record.property_date?.start || new Date().toISOString(),
            notionUrl: record.url
        };
    }

    extractNameFromMeetingName(meetingName, type) {
        // Parse "Joanne Rolfe - Jack - 2025-10-20" format
        if (!meetingName) return 'Unknown';
        const parts = meetingName.split(' - ');
        if (parts.length < 2) return 'Unknown';
        return type === 'volunteer' ? parts[0].trim() : parts[1].trim();
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
        const completedCount = this.gridData ? this.gridData.filter(p => p.hasFeedback).length : 0;
        const totalCount = this.gridData ? this.gridData.length : 0;

        document.getElementById('completedCount').textContent = completedCount;
        document.getElementById('totalCount').textContent = totalCount;

        // Show the count badge now that we have data
        document.getElementById('pairCount').style.display = 'inline-block';
    }

    renderGrid() {
        if (!this.gridData || this.gridData.length === 0) {
            this.filesList.innerHTML = '';
            this.noFiles.style.display = 'block';
            return;
        }

        this.noFiles.style.display = 'none';

        const gridHTML = this.gridData.map(pair => this.createGridItem(pair)).join('');
        this.filesList.innerHTML = gridHTML;
    }

    createGridItem(pair) {
        // Determine card class and status based on state
        let cardClass, statusText, onClickHandler, cursorStyle;

        if (pair.hasFeedback) {
            // Has feedback - not clickable
            cardClass = 'has-feedback';
            statusText = '✓ Done';
            onClickHandler = '';
            cursorStyle = 'cursor: default;';
        } else if (pair.isAbsent) {
            // Absent - still clickable to unmark
            cardClass = 'is-absent';
            statusText = 'Absent';
            onClickHandler = `onclick="adminApp.openUploadModal('${pair.volunteerId}', '${pair.studentId}', '${this.escapeHtml(pair.volunteerName)}', '${this.escapeHtml(pair.studentName)}', '${pair.scheduleId}', ${pair.isAbsent})"`;
            cursorStyle = '';
        } else {
            // Pending - clickable
            cardClass = 'no-feedback';
            statusText = 'Pending';
            onClickHandler = `onclick="adminApp.openUploadModal('${pair.volunteerId}', '${pair.studentId}', '${this.escapeHtml(pair.volunteerName)}', '${this.escapeHtml(pair.studentName)}', '${pair.scheduleId}', ${pair.isAbsent})"`;
            cursorStyle = '';
        }

        // Show feedback count if multiple submissions
        const countBadge = pair.hasFeedback && pair.feedbackCount > 1
            ? `<div class="feedback-count">${pair.feedbackCount}</div>`
            : '';

        return `
            <div class="file-item ${cardClass}" ${onClickHandler} style="${cursorStyle}">
                ${countBadge}
                <div>
                    <div class="volunteer-name">${pair.volunteerName}</div>
                    <div class="student-name">${pair.studentName}</div>
                </div>
                <div class="status-badge">${statusText}</div>
            </div>
        `;
    }

    viewFeedback(volunteerId, studentId, volunteerName, studentName) {
        // Find the pair and show feedback details in a modal
        const pair = this.gridData.find(p =>
            p.volunteerId === volunteerId && p.studentId === studentId
        );

        if (!pair || !pair.feedbackRecords) return;

        // Build feedback details HTML
        let feedbackHTML = pair.feedbackRecords.map(record => `
            <div class="mb-3 p-3" style="background: var(--bg-light); border-radius: 8px;">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <span class="badge bg-info me-1">${record.inputType}</span>
                        <span class="badge bg-secondary me-1">${record.wordAccuracy}%</span>
                        ${record.readingLevel ? `<span class="badge bg-dark">${record.readingLevel}</span>` : ''}
                    </div>
                    <a href="${record.notionUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-box-arrow-up-right"></i> View in Notion
                    </a>
                </div>
                ${this.renderMedia(record)}
            </div>
        `).join('');

        // Show in modal
        document.getElementById('uploadModalTitle').textContent = `${volunteerName} → ${studentName}`;
        document.getElementById('feedbackDetailsContent').innerHTML = feedbackHTML;
        document.getElementById('feedbackDetailsModal').style.display = 'block';
    }

    closeFeedbackModal() {
        document.getElementById('feedbackDetailsModal').style.display = 'none';
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    openUploadModal(volunteerId, studentId, volunteerName, studentName, scheduleId, isAbsent = false) {
        this.uploadModalData = {
            volunteerId,
            studentId,
            volunteerName,
            studentName,
            scheduleId,
            isAbsent
        };

        // Show modal
        document.getElementById('uploadModal').style.display = 'block';
        document.getElementById('uploadModalTitle').textContent = `Upload Feedback: ${volunteerName} → ${studentName}`;

        // Reset form
        document.getElementById('photoInput').value = '';
        document.getElementById('photoPreview').innerHTML = '';
        document.getElementById('accuracySlider').value = 0;
        document.getElementById('accuracyValue').textContent = '0%';
        document.getElementById('readingLevelSlider').value = 0;
        document.getElementById('readingLevelValue').textContent = 'A';
        document.getElementById('uploadSubmitBtn').disabled = true;

        // Reset book difficulty selection
        this.selectedDifficulty = null;
        document.querySelectorAll('.difficulty-pill').forEach(btn => {
            btn.classList.remove('active');
        });

        // Hide metrics section by default
        document.getElementById('metricsSection').style.display = 'none';
        document.getElementById('toggleMetricsBtn').innerHTML = '<i class="bi bi-sliders"></i> Add Metrics';

        // Hide comment section by default
        document.getElementById('commentSection').style.display = 'none';
        document.getElementById('toggleCommentBtn').innerHTML = '<i class="bi bi-chat-left-text"></i> Add Comment';
        document.getElementById('commentTextarea').value = '';

        // Update absent button text based on current state
        const absentBtn = document.getElementById('markAbsentBtn');
        if (isAbsent) {
            absentBtn.innerHTML = '<i class="bi bi-person-check"></i> Unmark as Absent';
            absentBtn.className = 'btn btn-info w-100 mb-3';
        } else {
            absentBtn.innerHTML = '<i class="bi bi-person-x"></i> Mark Student as Absent';
            absentBtn.className = 'btn btn-warning w-100 mb-3';
        }
    }

    selectDifficulty(difficulty) {
        this.selectedDifficulty = difficulty;

        // Update UI - remove active from all, add to selected
        document.querySelectorAll('.difficulty-pill').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.difficulty-pill[data-difficulty="${difficulty}"]`).classList.add('active');
    }

    updateAccuracySlider(value) {
        document.getElementById('accuracyValue').textContent = `${value}%`;
    }

    updateReadingLevelSlider(value) {
        const letter = String.fromCharCode(65 + parseInt(value));
        document.getElementById('readingLevelValue').textContent = letter;
    }

    toggleMetrics() {
        const metricsSection = document.getElementById('metricsSection');
        const toggleBtn = document.getElementById('toggleMetricsBtn');

        if (metricsSection.style.display === 'none') {
            metricsSection.style.display = 'block';
            toggleBtn.innerHTML = '<i class="bi bi-sliders"></i> Hide Metrics';
        } else {
            metricsSection.style.display = 'none';
            toggleBtn.innerHTML = '<i class="bi bi-sliders"></i> Add Metrics';
        }
    }

    toggleComment() {
        const commentSection = document.getElementById('commentSection');
        const toggleBtn = document.getElementById('toggleCommentBtn');

        if (commentSection.style.display === 'none') {
            commentSection.style.display = 'block';
            toggleBtn.innerHTML = '<i class="bi bi-chat-left-text"></i> Hide Comment';
        } else {
            commentSection.style.display = 'none';
            toggleBtn.innerHTML = '<i class="bi bi-chat-left-text"></i> Add Comment';
        }
    }

    closeUploadModal() {
        document.getElementById('uploadModal').style.display = 'none';
        this.uploadModalData = null;
        this.uploadedPhotos = [];
    }

    handlePhotoSelect(event) {
        const files = Array.from(event.target.files);
        this.uploadedPhotos = files.filter(f => f.type.startsWith('image/'));

        // Show preview
        const preview = document.getElementById('photoPreview');
        preview.innerHTML = '';

        this.uploadedPhotos.forEach((file, index) => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'img-thumbnail me-2 mb-2';
            img.style.maxHeight = '100px';
            preview.appendChild(img);
        });

        this.updateUploadButtonState();
    }

    updateUploadButtonState() {
        const hasPhotos = this.uploadedPhotos && this.uploadedPhotos.length > 0;
        document.getElementById('uploadSubmitBtn').disabled = !hasPhotos;
    }

    async submitUpload() {
        if (!this.uploadModalData || !this.uploadedPhotos || this.uploadedPhotos.length === 0) {
            alert('Please select at least one photo');
            return;
        }

        // Get metrics if the section is visible, otherwise use defaults
        const metricsVisible = document.getElementById('metricsSection').style.display !== 'none';
        const accuracy = metricsVisible ? parseInt(document.getElementById('accuracySlider').value) : 0;
        const readingLevelIndex = metricsVisible ? parseInt(document.getElementById('readingLevelSlider').value) : 0;
        const readingLevel = String.fromCharCode(65 + readingLevelIndex);
        const bookDifficulty = metricsVisible ? this.selectedDifficulty : null;

        // Get comment if visible
        const commentVisible = document.getElementById('commentSection').style.display !== 'none';
        const comment = commentVisible ? document.getElementById('commentTextarea').value.trim() : null;

        // Show loading
        const submitBtn = document.getElementById('uploadSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Uploading...';

        try {
            // Use the same upload logic as the main form
            if (!window.SimpleSupabaseUpload) {
                throw new Error('Upload service not available');
            }

            const storage = new SimpleSupabaseUpload();
            const volunteerNameSlug = this.uploadModalData.volunteerName.toLowerCase().replace(/\s+/g, '-');

            // Get staff for the selected date
            const selectedDateObj = this.availableDates.find(d => d.date === this.selectedDate);
            const staff = selectedDateObj && selectedDateObj.staff ? selectedDateObj.staff : [];

            // Create student object
            const student = {
                id: this.uploadModalData.studentId,
                name: this.uploadModalData.studentName
            };

            await storage.uploadPhotoFiles(
                this.uploadedPhotos,
                volunteerNameSlug,
                this.selectedDate,
                this.uploadModalData.volunteerName,
                student,
                this.uploadModalData.volunteerId,
                staff,
                accuracy,
                readingLevel,
                bookDifficulty,
                comment
            );

            alert('Feedback uploaded successfully!');
            this.closeUploadModal();

            // Reload the data
            await this.loadFeedback();

        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload feedback: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-upload me-2"></i>Submit Feedback';
        }
    }

    async markStudentAbsent() {
        if (!this.uploadModalData) {
            return;
        }

        const { volunteerId, studentId, volunteerName, studentName, scheduleId, isAbsent } = this.uploadModalData;

        // Confirm with user
        const action = isAbsent ? 'Unmark' : 'Mark';
        const confirmMessage = isAbsent
            ? `Unmark ${studentName} as absent for ${this.selectedDate}?\n\nThis will update the record in Notion.`
            : `Mark ${studentName} as absent for ${this.selectedDate}?\n\nThis will update the record in Notion.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Disable button and show loading
        const absentBtn = document.getElementById('markAbsentBtn');
        absentBtn.disabled = true;
        const loadingText = isAbsent ? 'Unmarking...' : 'Marking as Absent...';
        absentBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> ${loadingText}`;

        // Create optimistic update key
        const optimisticKey = `${volunteerId}-${studentId}-${this.selectedDate}`;

        try {
            // Optimistically update the UI immediately
            this.optimisticAbsentChanges.set(optimisticKey, !isAbsent);

            // Call n8n webhook to mark/unmark student absent
            const response = await fetch('https://tasks.sklabs.app/webhook/mark-absent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    volunteer_id: volunteerId,
                    volunteer_name: volunteerName,
                    student_id: studentId,
                    student_name: studentName,
                    date: this.selectedDate,
                    schedule_id: scheduleId,
                    unmark: isAbsent  // Add flag to indicate if we're unmarking
                })
            });

            if (!response.ok) {
                // Revert optimistic update on error
                this.optimisticAbsentChanges.delete(optimisticKey);
                throw new Error(`API returned ${response.status}`);
            }

            // Success!
            const successMessage = isAbsent
                ? `${studentName} unmarked as absent for ${this.selectedDate}`
                : `${studentName} marked as absent for ${this.selectedDate}`;
            alert(successMessage);
            this.closeUploadModal();

            // Refresh the grid with optimistic state
            this.gridData = this.createGridData(this.scheduledPairs, this.feedbackRecords, this.absentList);
            this.updateStats();
            this.renderGrid();

            // Schedule cleanup of optimistic update after 30 seconds
            setTimeout(() => {
                this.optimisticAbsentChanges.delete(optimisticKey);
            }, 30000);

        } catch (error) {
            console.error('Mark/unmark absent error:', error);
            alert('Failed to update absent status. Please try again.');

            // Re-enable button and restore original text
            absentBtn.disabled = false;
            if (isAbsent) {
                absentBtn.innerHTML = '<i class="bi bi-person-check"></i> Unmark as Absent';
            } else {
                absentBtn.innerHTML = '<i class="bi bi-person-x"></i> Mark Student as Absent';
            }
        }
    }

    renderMedia(record) {
        if (!record.urls || record.urls.length === 0) return '';

        if (record.inputType === 'Photo') {
            return `
                <div class="row g-2 mt-1">
                    ${record.urls.map(url => `
                        <div class="col-4 col-md-3">
                            <img src="${url}" alt="Photo" class="img-fluid rounded" style="max-height: 120px; object-fit: cover; width: 100%; cursor: pointer;" onclick="window.open('${url}', '_blank')">
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            return `
                <audio controls class="audio-player mt-2" style="width: 100%;">
                    <source src="${record.urls[0]}" type="audio/webm">
                    <source src="${record.urls[0]}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            `;
        }
    }

    filterFiles(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredGridData = [...this.gridData];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredGridData = this.gridData.filter(pair =>
                pair.volunteerName.toLowerCase().includes(term) ||
                pair.studentName.toLowerCase().includes(term)
            );
        }

        // Temporarily swap gridData for filtered rendering
        const originalData = this.gridData;
        this.gridData = this.filteredGridData;
        this.renderGrid();
        this.gridData = originalData;
    }

    async refreshFiles() {
        this.refreshBtn.disabled = true;
        this.refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise loading-spinner me-2"></i>Refreshing...';

        try {
            await this.loadFeedback();
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
let adminApp;
document.addEventListener('DOMContentLoaded', () => {
    adminApp = new FeedbackAdmin();
    window.adminApp = adminApp; // Expose globally for modal callbacks
});