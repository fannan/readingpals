class FeedbackAudit {
    constructor() {
        this.availableDates = [];
        this.volunteers = [];
        this.allStudents = [];
        this.showAllStudents = false;
        this.selectedDate = null;
        this.feedbackData = [];

        // API endpoints
        this.datesApiUrl = 'https://tasks.sklabs.app/webhook/80337e94-93a5-407a-94d1-746efcbb4d3c';
        this.feedbackApiUrl = 'https://tasks.sklabs.app/webhook/d62d9936-6521-4b54-b58f-cae39569b8f7';

        this.initializeElements();
        this.bindEvents();
        this.loadAvailableDates();
        this.initializeStorage();
    }

    initializeElements() {
        this.dateSelect = document.getElementById('dateSelect');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.loadingSection = document.getElementById('loadingSection');
        this.emptyState = document.getElementById('emptyState');
        this.auditGrid = document.getElementById('auditGrid');
        this.statsSection = document.getElementById('statsSection');

        // Stats elements
        this.totalPairsCount = document.getElementById('totalPairsCount');
        this.completedCount = document.getElementById('completedCount');
        this.absentCount = document.getElementById('absentCount');
        this.missingCount = document.getElementById('missingCount');
        this.completionRate = document.getElementById('completionRate');

        // Photo upload modal elements
        this.uploadModal = document.getElementById('uploadModal');
        this.uploadModalTitle = document.getElementById('uploadModalTitle');
        this.photoInput = document.getElementById('photoInput');
        this.photoGrid = document.getElementById('photoGrid');
        this.photoCount = document.getElementById('photoCount');
        this.submitPhotosBtn = document.getElementById('submitPhotosBtn');
        this.cancelUploadBtn = document.getElementById('cancelUploadBtn');
        this.markAbsentBtn = document.getElementById('markAbsentBtn');

        // Current upload context
        this.currentUploadContext = null;
        this.uploadedPhotos = [];
        this.storage = null;

        // API endpoint for marking absent
        this.markAbsentApiUrl = 'https://tasks.sklabs.app/webhook/mark-absent';
    }

    bindEvents() {
        this.dateSelect.addEventListener('change', () => this.onDateSelected());
        this.refreshBtn.addEventListener('click', () => this.refreshAudit());

        // Photo upload events
        this.photoInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        this.submitPhotosBtn.addEventListener('click', () => this.submitPhotos());
        this.cancelUploadBtn.addEventListener('click', () => this.closeUploadModal());
        this.markAbsentBtn.addEventListener('click', () => this.markStudentAbsent());
    }

    initializeStorage() {
        try {
            if (window.SimpleSupabaseUpload) {
                this.storage = new SimpleSupabaseUpload();
                console.log('Storage initialized');
            } else {
                console.warn('SimpleSupabaseUpload not available, retrying...');
                setTimeout(() => this.initializeStorage(), 500);
            }
        } catch (error) {
            console.warn('Storage initialization failed:', error);
            setTimeout(() => this.initializeStorage(), 1000);
        }
    }

    async loadAvailableDates() {
        try {
            console.log('Loading available dates...');
            const response = await fetch(this.datesApiUrl);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const result = await response.json();
            const data = Array.isArray(result) ? result[0] : result;

            // Parse dates and volunteers
            if (data.data && Array.isArray(data.data)) {
                this.availableDates = data.data.map(item => ({
                    date: item.name,
                    day: item.day_name,
                    staff: item.staff || [],
                    volunteers: item.volunteers || [],
                    collect_reading_level: item.collect_reading_level !== undefined ? item.collect_reading_level : true
                }));
            }

            if (data.volunteers && Array.isArray(data.volunteers)) {
                this.volunteers = data.volunteers.map(volunteer => ({
                    id: volunteer.id,
                    name: volunteer.name,
                    students: volunteer.students || []
                }));
            }

            // Extract all students from all volunteers into a single list
            const allStudentsMap = new Map();
            this.volunteers.forEach(volunteer => {
                volunteer.students.forEach(student => {
                    if (!allStudentsMap.has(student.id)) {
                        allStudentsMap.set(student.id, student);
                    }
                });
            });
            this.allStudents = Array.from(allStudentsMap.values());

            // Get showAllStudents flag from config
            if (typeof data.show_all_students === 'boolean') {
                this.showAllStudents = data.show_all_students;
                console.log('Show all students:', this.showAllStudents);
            }

            this.populateDateDropdown();

        } catch (error) {
            console.error('Failed to load dates:', error);
            this.dateSelect.innerHTML = '<option value="">Error loading dates</option>';
        }
    }

    populateDateDropdown() {
        this.dateSelect.innerHTML = '<option value="">Select a date...</option>';

        if (this.availableDates.length === 0) {
            this.dateSelect.innerHTML = '<option value="">No dates available</option>';
            return;
        }

        // Sort dates in ascending order (oldest first)
        const sortedDates = [...this.availableDates].sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        sortedDates.forEach(dateObj => {
            const option = document.createElement('option');
            option.value = dateObj.date;
            option.textContent = this.formatDateForDisplay(dateObj);
            this.dateSelect.appendChild(option);
        });

        // Pre-select the closest future date
        this.selectClosestFutureDate();
    }

    selectClosestFutureDate() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find the closest date that is today or in the future
        let closestDateObj = null;
        let minDiff = Infinity;

        this.availableDates.forEach(dateObj => {
            // Parse date as local time to avoid timezone issues
            const [year, month, day] = dateObj.date.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            date.setHours(0, 0, 0, 0);

            const diff = date - today;

            // Only consider today or future dates
            if (diff >= 0 && diff < minDiff) {
                minDiff = diff;
                closestDateObj = dateObj;
            }
        });

        // If no future date found, select the most recent past date
        if (!closestDateObj && this.availableDates.length > 0) {
            closestDateObj = this.availableDates.reduce((latest, current) => {
                const [y1, m1, d1] = latest.date.split('-').map(Number);
                const [y2, m2, d2] = current.date.split('-').map(Number);
                const date1 = new Date(y1, m1 - 1, d1);
                const date2 = new Date(y2, m2 - 1, d2);
                return date2 > date1 ? current : latest;
            });
        }

        if (closestDateObj) {
            this.dateSelect.value = closestDateObj.date;
            this.selectedDate = closestDateObj.date;
            console.log('Pre-selected date:', closestDateObj.date);
            // Trigger date selection to load audit data
            this.onDateSelected();
        }
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

    async onDateSelected() {
        this.selectedDate = this.dateSelect.value;

        if (!this.selectedDate) {
            this.showEmptyState();
            return;
        }

        await this.loadAuditData();
    }

    async loadAuditData() {
        this.showLoading();

        try {
            // Get the selected date object
            const selectedDateObj = this.availableDates.find(d => d.date === this.selectedDate);

            if (!selectedDateObj) {
                throw new Error('Selected date not found');
            }

            // Get feedback data for this date
            await this.loadFeedbackData();

            // Build the audit grid
            this.buildAuditGrid(selectedDateObj);

        } catch (error) {
            console.error('Failed to load audit data:', error);
            this.showError('Failed to load audit data. Please try again.');
        }
    }

    async loadFeedbackData() {
        try {
            // Call API to get feedback for the selected date
            const url = `${this.feedbackApiUrl}?date=${this.selectedDate}`;
            console.log('Loading feedback data from:', url);

            const response = await fetch(url);

            if (!response.ok) {
                // If endpoint doesn't exist or returns error, continue with empty data
                console.warn('Feedback API returned error, continuing with empty data');
                this.feedbackData = [];
                return;
            }

            const result = await response.json();
            const rawData = Array.isArray(result) ? result : [];

            // Deduplicate based on volunteer-student pairs
            const seenPairs = new Set();
            this.feedbackData = rawData.filter(item => {
                const volunteerId = item.property_volunteer?.[0];
                const studentId = item.property_student?.[0];

                if (!volunteerId || !studentId) return false;

                const pairKey = `${volunteerId}-${studentId}`;
                if (seenPairs.has(pairKey)) {
                    return false; // Duplicate, skip it
                }

                seenPairs.add(pairKey);
                return true;
            });

            console.log('Loaded and deduped feedback data:', this.feedbackData.length, 'items');

        } catch (error) {
            console.warn('Failed to load feedback data:', error);
            this.feedbackData = [];
        }
    }

    buildAuditGrid(selectedDateObj) {
        this.auditGrid.innerHTML = '';

        console.log('Building audit grid for date:', this.selectedDate);
        console.log('Selected date object:', selectedDateObj);
        console.log('All volunteers:', this.volunteers);
        console.log('Feedback data:', this.feedbackData);

        // Get volunteers scheduled for this date
        const scheduledVolunteerIds = selectedDateObj.volunteers.map(v => v.id);
        console.log('Scheduled volunteer IDs for this date:', scheduledVolunteerIds);

        const scheduledVolunteers = this.volunteers.filter(v =>
            scheduledVolunteerIds.includes(v.id)
        );

        console.log('Scheduled volunteers:', scheduledVolunteers);

        if (scheduledVolunteers.length === 0) {
            console.warn('No volunteers found for this date. Showing all volunteers instead...');

            // If no volunteers are scheduled, show all volunteers who have students
            // This allows viewing all volunteer-student pairs even without a schedule
            this.buildGridFromAllVolunteers();
            return;
        }

        // Sort volunteers alphabetically
        const sortedVolunteers = [...scheduledVolunteers].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        let totalPairs = 0;
        let completedPairs = 0;
        let absentPairs = 0;

        // Build a section for each volunteer
        sortedVolunteers.forEach(volunteer => {
            const studentsToCount = this.showAllStudents ? this.allStudents : volunteer.students;

            if (!studentsToCount || studentsToCount.length === 0) {
                return; // Skip volunteers with no students
            }

            const section = this.createVolunteerSection(volunteer);
            this.auditGrid.appendChild(section);

            totalPairs += studentsToCount.length;
            completedPairs += studentsToCount.filter(student =>
                this.hasFeedback(volunteer.id, student.id) && !this.isAbsent(volunteer.id, student.id)
            ).length;
            absentPairs += studentsToCount.filter(student =>
                this.isAbsent(volunteer.id, student.id)
            ).length;
        });

        // Update stats
        this.updateStats(totalPairs, completedPairs, absentPairs);

        // Show the grid
        this.hideLoading();
        this.auditGrid.style.display = 'grid';
        this.statsSection.style.display = 'block';
    }

    createVolunteerSection(volunteer) {
        const section = document.createElement('div');
        section.className = 'volunteer-section';

        // Header
        const header = document.createElement('div');
        header.className = 'volunteer-header';
        header.textContent = volunteer.name;
        section.appendChild(header);

        // Student list
        const studentList = document.createElement('div');
        studentList.className = 'student-list';

        // Use all students if showAllStudents is true, otherwise use volunteer's assigned students
        const studentsToShow = this.showAllStudents ? this.allStudents : volunteer.students;

        // Sort students alphabetically
        const sortedStudents = [...studentsToShow].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        sortedStudents.forEach(student => {
            const item = this.createStudentItem(volunteer, student);
            studentList.appendChild(item);
        });

        section.appendChild(studentList);

        return section;
    }

    createStudentItem(volunteer, student) {
        const item = document.createElement('div');
        const hasSubmitted = this.hasFeedback(volunteer.id, student.id);
        const isAbsent = this.isAbsent(volunteer.id, student.id);

        // Determine status class: absent takes precedence over completed
        let statusClass = 'missing';
        if (isAbsent) {
            statusClass = 'absent';
        } else if (hasSubmitted) {
            statusClass = 'completed';
        }

        item.className = `student-item ${statusClass}`;

        // Student name
        const nameDiv = document.createElement('div');
        nameDiv.className = 'student-name';
        nameDiv.textContent = student.name;
        item.appendChild(nameDiv);

        // Status with upload button for missing items
        const statusDiv = document.createElement('div');
        statusDiv.className = 'student-status';

        if (isAbsent) {
            statusDiv.innerHTML = '<i class="bi bi-person-x-fill"></i> Absent';
        } else if (hasSubmitted) {
            statusDiv.innerHTML = '<i class="bi bi-check-circle-fill"></i> Submitted';
        } else {
            statusDiv.innerHTML = `
                <span class="status-text">
                    <i class="bi bi-x-circle-fill"></i> Missing
                </span>
                <button class="upload-btn" title="Upload photos">
                    <i class="bi bi-cloud-upload-fill"></i>
                </button>
            `;

            // Add click handler to upload button
            const uploadBtn = statusDiv.querySelector('.upload-btn');
            uploadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openUploadModal(volunteer, student);
            });
        }

        item.appendChild(statusDiv);

        return item;
    }

    openUploadModal(volunteer, student) {
        this.currentUploadContext = {
            volunteer,
            student,
            date: this.selectedDate
        };

        this.uploadModalTitle.textContent = `Upload Photos: ${student.name}`;
        this.uploadedPhotos = [];
        this.photoGrid.innerHTML = '';
        this.photoCount.textContent = '';
        this.submitPhotosBtn.style.display = 'none';

        this.uploadModal.classList.add('show');
    }

    closeUploadModal() {
        this.uploadModal.classList.remove('show');
        this.currentUploadContext = null;
        this.uploadedPhotos = [];
        this.photoGrid.innerHTML = '';
        this.photoCount.textContent = '';
    }

    handlePhotoUpload(event) {
        const files = Array.from(event.target.files);

        files.forEach(file => {
            if (file && file.type.startsWith('image/')) {
                this.uploadedPhotos.push(file);
            }
        });

        this.renderPhotoGrid();
        // Clear the input so the same file can be selected again
        event.target.value = '';
    }

    renderPhotoGrid() {
        this.photoGrid.innerHTML = '';

        this.uploadedPhotos.forEach((file, index) => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = `Photo ${index + 1}`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => this.removePhoto(index);

            photoItem.appendChild(img);
            photoItem.appendChild(removeBtn);
            this.photoGrid.appendChild(photoItem);
        });

        // Update count and show/hide submit button
        const count = this.uploadedPhotos.length;
        if (count > 0) {
            this.photoCount.textContent = `${count} photo${count !== 1 ? 's' : ''} added`;
            this.submitPhotosBtn.style.display = 'block';
        } else {
            this.photoCount.textContent = '';
            this.submitPhotosBtn.style.display = 'none';
        }
    }

    removePhoto(index) {
        this.uploadedPhotos.splice(index, 1);
        this.renderPhotoGrid();
    }

    async submitPhotos() {
        if (this.uploadedPhotos.length === 0 || !this.currentUploadContext) {
            return;
        }

        const { volunteer, student, date } = this.currentUploadContext;

        // Disable submit button and show loading
        this.submitPhotosBtn.disabled = true;
        this.submitPhotosBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading...';

        try {
            // Get volunteer name for filename
            const volunteerName = volunteer.name.toLowerCase().replace(/\s+/g, '-');

            // Get staff for the selected date
            const selectedDateObj = this.availableDates.find(d => d.date === date);
            const staff = selectedDateObj && selectedDateObj.staff ? selectedDateObj.staff : [];

            // Upload photos
            await this.storage.uploadPhotoFiles(
                this.uploadedPhotos,
                volunteerName,
                date,
                volunteer.name,
                student,
                volunteer.id,
                staff
            );

            // Success!
            alert(`Successfully submitted ${this.uploadedPhotos.length} photo${this.uploadedPhotos.length !== 1 ? 's' : ''} for ${student.name}`);
            this.closeUploadModal();

            // Refresh the audit to update the status
            await this.refreshAudit();

        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload photos. Please try again.');

            // Re-enable submit button
            this.submitPhotosBtn.disabled = false;
            this.submitPhotosBtn.innerHTML = '<i class="bi bi-cloud-upload"></i> Submit Photos';
        }
    }

    async markStudentAbsent() {
        if (!this.currentUploadContext) {
            return;
        }

        const { volunteer, student, date } = this.currentUploadContext;

        // Confirm with user
        if (!confirm(`Mark ${student.name} as absent for ${date}?\n\nThis will update the record in Notion.`)) {
            return;
        }

        // Disable button and show loading
        this.markAbsentBtn.disabled = true;
        this.markAbsentBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Marking as Absent...';

        try {
            // Call n8n webhook to mark student absent
            const response = await fetch(this.markAbsentApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    volunteer_id: volunteer.id,
                    volunteer_name: volunteer.name,
                    student_id: student.id,
                    student_name: student.name,
                    date: date
                })
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            // Success!
            alert(`${student.name} marked as absent for ${date}`);
            this.closeUploadModal();

            // Refresh the audit to update the status
            await this.refreshAudit();

        } catch (error) {
            console.error('Mark absent error:', error);
            alert('Failed to mark student as absent. Please try again.');

            // Re-enable button
            this.markAbsentBtn.disabled = false;
            this.markAbsentBtn.innerHTML = '<i class="bi bi-person-x"></i> Mark Student as Absent';
        }
    }

    hasFeedback(volunteerId, studentId) {
        // Check if feedback exists for this volunteer-student pair
        // The API returns property_volunteer and property_student as arrays
        return this.feedbackData.some(feedback => {
            const feedbackVolunteerId = feedback.property_volunteer?.[0];
            const feedbackStudentId = feedback.property_student?.[0];

            return feedbackVolunteerId === volunteerId &&
                   feedbackStudentId === studentId;
        });
    }

    isAbsent(volunteerId, studentId) {
        // Check if student is marked absent for this volunteer-student pair
        const feedback = this.feedbackData.find(feedback => {
            const feedbackVolunteerId = feedback.property_volunteer?.[0];
            const feedbackStudentId = feedback.property_student?.[0];

            return feedbackVolunteerId === volunteerId &&
                   feedbackStudentId === studentId;
        });

        // If feedback exists and has an "Absent" property set to true
        return feedback?.property_absent === true || feedback?.property_absent === 'Yes';
    }

    updateStats(totalPairs, completedPairs, absentPairs) {
        const missingPairs = totalPairs - completedPairs - absentPairs;
        const rate = totalPairs > 0 ? Math.round((completedPairs / totalPairs) * 100) : 0;

        this.totalPairsCount.textContent = totalPairs;
        this.completedCount.textContent = completedPairs;
        this.absentCount.textContent = absentPairs;
        this.missingCount.textContent = missingPairs;
        this.completionRate.textContent = `${rate}%`;
    }

    async refreshAudit() {
        if (!this.selectedDate) {
            return;
        }

        await this.loadAuditData();
    }

    showLoading() {
        this.emptyState.style.display = 'none';
        this.auditGrid.style.display = 'none';
        this.statsSection.style.display = 'none';
        this.loadingSection.style.display = 'block';
    }

    hideLoading() {
        this.loadingSection.style.display = 'none';
    }

    showEmptyState(message = null) {
        this.loadingSection.style.display = 'none';
        this.auditGrid.style.display = 'none';
        this.statsSection.style.display = 'none';
        this.emptyState.style.display = 'block';

        if (message) {
            const messageP = this.emptyState.querySelector('p');
            if (messageP) {
                messageP.textContent = message;
            }
        }
    }

    buildGridFromAllVolunteers() {
        // Fallback: show all volunteers who have students
        const volunteersWithStudents = this.volunteers.filter(v =>
            v.students && v.students.length > 0
        );

        if (volunteersWithStudents.length === 0) {
            this.showEmptyState('No volunteers with students found');
            return;
        }

        // Sort volunteers alphabetically
        const sortedVolunteers = [...volunteersWithStudents].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        let totalPairs = 0;
        let completedPairs = 0;
        let absentPairs = 0;

        // Build a section for each volunteer
        sortedVolunteers.forEach(volunteer => {
            const section = this.createVolunteerSection(volunteer);
            this.auditGrid.appendChild(section);

            totalPairs += volunteer.students.length;
            completedPairs += volunteer.students.filter(student =>
                this.hasFeedback(volunteer.id, student.id) && !this.isAbsent(volunteer.id, student.id)
            ).length;
            absentPairs += volunteer.students.filter(student =>
                this.isAbsent(volunteer.id, student.id)
            ).length;
        });

        // Update stats
        this.updateStats(totalPairs, completedPairs, absentPairs);

        // Show the grid
        this.hideLoading();
        this.auditGrid.style.display = 'grid';
        this.statsSection.style.display = 'block';
    }

    showError(message) {
        this.hideLoading();
        alert(message);
    }
}

// Initialize the audit app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FeedbackAudit();
});
