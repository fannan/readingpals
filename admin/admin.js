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
        this.missingCount = document.getElementById('missingCount');
        this.completionRate = document.getElementById('completionRate');
    }

    bindEvents() {
        this.dateSelect.addEventListener('change', () => this.onDateSelected());
        this.refreshBtn.addEventListener('click', () => this.refreshAudit());
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
                    volunteers: item.volunteers || []
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

        // Sort dates in descending order (most recent first)
        const sortedDates = [...this.availableDates].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        sortedDates.forEach(dateObj => {
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
            console.warn('No volunteers found for this date. Checking if we should show all volunteers with feedback...');

            // If no volunteers are scheduled but we have feedback data,
            // show all volunteers who have any students
            if (this.feedbackData.length > 0) {
                console.log('Using all volunteers since we have feedback data');
                this.buildGridFromAllVolunteers();
                return;
            }

            this.showEmptyState('No volunteers scheduled for this date');
            return;
        }

        // Sort volunteers alphabetically
        const sortedVolunteers = [...scheduledVolunteers].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        let totalPairs = 0;
        let completedPairs = 0;

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
                this.hasFeedback(volunteer.id, student.id)
            ).length;
        });

        // Update stats
        this.updateStats(totalPairs, completedPairs);

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

        item.className = `student-item ${hasSubmitted ? 'completed' : 'missing'}`;

        // Student name
        const nameDiv = document.createElement('div');
        nameDiv.className = 'student-name';
        nameDiv.textContent = student.name;
        item.appendChild(nameDiv);

        // Status
        const statusDiv = document.createElement('div');
        statusDiv.className = 'student-status';

        if (hasSubmitted) {
            statusDiv.innerHTML = '<i class="bi bi-check-circle-fill"></i> Submitted';
        } else {
            statusDiv.innerHTML = '<i class="bi bi-x-circle-fill"></i> Missing';
        }

        item.appendChild(statusDiv);

        return item;
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

    updateStats(totalPairs, completedPairs) {
        const missingPairs = totalPairs - completedPairs;
        const rate = totalPairs > 0 ? Math.round((completedPairs / totalPairs) * 100) : 0;

        this.totalPairsCount.textContent = totalPairs;
        this.completedCount.textContent = completedPairs;
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

        // Build a section for each volunteer
        sortedVolunteers.forEach(volunteer => {
            const section = this.createVolunteerSection(volunteer);
            this.auditGrid.appendChild(section);

            totalPairs += volunteer.students.length;
            completedPairs += volunteer.students.filter(student =>
                this.hasFeedback(volunteer.id, student.id)
            ).length;
        });

        // Update stats
        this.updateStats(totalPairs, completedPairs);

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
