class FeedbackRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isPaused = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.storage = null;
        this.availableDates = [];
        this.volunteers = [];
        this.allStudents = []; // Store all students separately
        this.selectedDate = null;
        this.selectedVolunteer = null;
        this.minimumSeconds = 30; // Default minimum recording time
        this.showAllStudents = false; // Flag to show all students or only volunteer's students
        this.collectReadingLevel = true; // Flag to show reading level fields (from Notion schedule)
        this.showAdvancedFields = false; // Toggle for showing advanced fields
        this.feedbackMode = 'audio'; // 'audio' or 'photo'
        this.uploadedPhotos = []; // Array to store photo files

        this.initializeElements();
        this.bindEvents();
        this.loadAvailableDates(); // Will call checkURLParameters() after data loads
        this.initializeStorage();
    }

    initializeStorage() {
        try {
            if (window.SimpleSupabaseUpload) {
                this.storage = new SimpleSupabaseUpload();
                console.log('Simple Supabase Upload initialized');
            } else {
                console.warn('SimpleSupabaseUpload not available, retrying...');
                setTimeout(() => this.initializeStorage(), 500);
            }
        } catch (error) {
            console.warn('Storage initialization failed:', error);
            setTimeout(() => this.initializeStorage(), 1000);
        }
    }

    initializeElements() {
        this.dateSelect = document.getElementById('dateSelect');
        this.volunteerSelect = document.getElementById('volunteerSelect');
        this.studentSelect = document.getElementById('studentSelect');
        this.recordBtn = document.getElementById('recordBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.reRecordBtn = document.getElementById('reRecordBtn');
        this.submitBtn = document.getElementById('submitBtn');
        this.recordStatus = document.getElementById('recordStatus');
        this.statusBar = document.getElementById('statusBar');
        this.recordSection = document.getElementById('recordSection');
        this.recordingControls = document.getElementById('recordingControls');
        this.playbackSection = document.getElementById('playbackSection');
        this.loadingSection = document.getElementById('loadingSection');
        this.audioPlayback = document.getElementById('audioPlayback');
        this.feedbackForm = document.getElementById('feedbackForm');
        this.dateLabel = document.getElementById('dateLabel');

        // Word accuracy elements
        this.accuracyContainer = document.getElementById('accuracyContainer');
        this.accuracySlider = document.getElementById('accuracySlider');
        this.accuracyValue = document.getElementById('accuracyValue');
        this.previousAccuracy = document.getElementById('previousAccuracy');

        // Reading level elements
        this.readingLevelContainer = document.getElementById('readingLevelContainer');
        this.readingLevelSlider = document.getElementById('readingLevelSlider');
        this.readingLevelValue = document.getElementById('readingLevelValue');
        this.previousReadingLevel = document.getElementById('previousReadingLevel');

        // Book difficulty elements
        this.bookDifficultyContainer = document.getElementById('bookDifficultyContainer');
        this.difficultyPills = document.querySelectorAll('.difficulty-pill');
        this.selectedDifficulty = null; // No default - will be set based on collect_reading_level flag

        // Advanced toggle elements
        this.advancedToggleContainer = document.getElementById('advancedToggleContainer');
        this.advancedToggleBtn = document.getElementById('advancedToggleBtn');

        // Photo mode elements
        this.modeSelector = document.getElementById('modeSelector');
        this.audioModeBtn = document.getElementById('audioModeBtn');
        this.photoModeBtn = document.getElementById('photoModeBtn');
        this.photoSection = document.getElementById('photoSection');
        this.photoInput = document.getElementById('photoInput');
        this.photoGrid = document.getElementById('photoGrid');
        this.photoCount = document.getElementById('photoCount');
        this.photoActions = document.getElementById('photoActions');
        this.submitPhotosBtn = document.getElementById('submitPhotosBtn');
    }

    bindEvents() {
        this.dateSelect.addEventListener('change', () => this.onDateSelected());
        this.volunteerSelect.addEventListener('change', () => this.onVolunteerSelected());
        if (this.studentSelect) {
            this.studentSelect.addEventListener('change', () => this.onStudentSelected());
        }
        this.recordBtn.addEventListener('click', () => this.startRecording());
        this.pauseBtn.addEventListener('click', () => this.togglePauseRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.reRecordBtn.addEventListener('click', () => this.resetForNewRecording());
        this.feedbackForm.addEventListener('submit', (e) => this.handleSubmit(e));

        // Word accuracy slider
        this.accuracySlider.addEventListener('input', (e) => this.updateAccuracyDisplay(e.target.value));

        // Reading level slider
        this.readingLevelSlider.addEventListener('input', (e) => this.updateReadingLevelDisplay(e.target.value));

        // Photo mode events
        this.audioModeBtn.addEventListener('click', () => this.switchMode('audio'));
        this.photoModeBtn.addEventListener('click', () => this.switchMode('photo'));
        this.photoInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        this.submitPhotosBtn.addEventListener('click', () => this.submitPhotos());

        // Book difficulty pill events
        this.difficultyPills.forEach(pill => {
            pill.addEventListener('click', () => this.selectDifficulty(pill));
        });

        // Advanced toggle event
        if (this.advancedToggleBtn) {
            this.advancedToggleBtn.addEventListener('click', () => this.toggleAdvancedFields());
        }
    }

    toggleAdvancedFields() {
        this.showAdvancedFields = !this.showAdvancedFields;

        if (this.showAdvancedFields) {
            // Show advanced fields (Reading Level and Word Accuracy Rate)
            this.readingLevelContainer.style.display = 'block';
            this.accuracyContainer.style.display = 'block';
            this.advancedToggleBtn.innerHTML = '<i class="bi bi-chevron-up"></i> Hide Advanced Fields';
        } else {
            // Hide advanced fields (keep Book Difficulty visible)
            this.readingLevelContainer.style.display = 'none';
            this.accuracyContainer.style.display = 'none';
            this.advancedToggleBtn.innerHTML = '<i class="bi bi-chevron-down"></i> Show Advanced Fields';
        }
    }

    selectDifficulty(selectedPill) {
        // Remove active class from all pills
        this.difficultyPills.forEach(pill => pill.classList.remove('active'));

        // Add active class to selected pill
        selectedPill.classList.add('active');

        // Store the selected difficulty
        this.selectedDifficulty = selectedPill.dataset.difficulty;

        console.log('Book difficulty selected:', this.selectedDifficulty);

        // Update submit button state after selection
        this.updateSubmitButtonState();
    }

    updateAccuracyDisplay(value) {
        const intValue = parseInt(value);

        if (intValue === -1) {
            this.accuracyValue.textContent = 'N/A';
            this.accuracyValue.style.background = 'linear-gradient(135deg, #6C757D, #495057)';
            this.accuracyValue.style.boxShadow = '0 3px 10px rgba(108, 117, 125, 0.25)';
        } else {
            this.accuracyValue.textContent = `${value}%`;

            // Update background color and shadow based on value
            const color = this.getAccuracyColor(intValue);
            const shadowColor = this.getAccuracyShadowColor(intValue);
            this.accuracyValue.style.background = color;
            this.accuracyValue.style.boxShadow = `0 4px 12px ${shadowColor}`;
        }

        this.updateSubmitButtonState();
        this.updateAccuracyHighlight();
    }

    getAccuracyColor(value) {
        // Color transitions:
        // 0-49%: Red to Orange
        // 50-79%: Orange to Yellow to Light Green
        // 80-100%: Light Green to Green

        if (value < 50) {
            // Red (220, 53, 69) to Orange (255, 107, 74)
            const ratio = value / 50;
            const r = Math.round(220 + (255 - 220) * ratio);
            const g = Math.round(53 + (107 - 53) * ratio);
            const b = Math.round(69 + (74 - 69) * ratio);
            const r2 = Math.round(180 + (220 - 180) * ratio);
            const g2 = Math.round(35 + (70 - 35) * ratio);
            const b2 = Math.round(50 + (50 - 50) * ratio);
            return `linear-gradient(135deg, rgb(${r}, ${g}, ${b}), rgb(${r2}, ${g2}, ${b2}))`;
        } else if (value < 80) {
            // Orange (255, 165, 0) to Yellow-Green (180, 200, 50)
            const ratio = (value - 50) / 30;
            const r = Math.round(255 - (255 - 180) * ratio);
            const g = Math.round(165 + (200 - 165) * ratio);
            const b = Math.round(0 + (50 - 0) * ratio);
            const r2 = Math.round(220 - (220 - 140) * ratio);
            const g2 = Math.round(130 + (180 - 130) * ratio);
            const b2 = Math.round(0 + (40 - 0) * ratio);
            return `linear-gradient(135deg, rgb(${r}, ${g}, ${b}), rgb(${r2}, ${g2}, ${b2}))`;
        } else {
            // Yellow-Green to Green (40, 167, 69)
            const ratio = (value - 80) / 20;
            const r = Math.round(180 - (180 - 40) * ratio);
            const g = Math.round(200 - (200 - 167) * ratio);
            const b = Math.round(50 + (69 - 50) * ratio);
            const r2 = Math.round(140 - (140 - 30) * ratio);
            const g2 = Math.round(180 - (180 - 140) * ratio);
            const b2 = Math.round(40 + (55 - 40) * ratio);
            return `linear-gradient(135deg, rgb(${r}, ${g}, ${b}), rgb(${r2}, ${g2}, ${b2}))`;
        }
    }

    getAccuracyShadowColor(value) {
        // Shadow color matches the theme
        if (value < 50) {
            return 'rgba(220, 53, 69, 0.4)'; // Red shadow
        } else if (value < 80) {
            return 'rgba(255, 165, 0, 0.4)'; // Orange shadow
        } else {
            return 'rgba(40, 167, 69, 0.4)'; // Green shadow
        }
    }

    updateReadingLevelDisplay(value) {
        const intValue = parseInt(value);
        const letter = this.numberToLetter(intValue);
        this.readingLevelValue.textContent = letter;
        this.updateSubmitButtonState();
        this.updateReadingLevelHighlight();
    }

    numberToLetter(num) {
        // Convert -1 to N/A, 0-18 to A-S
        if (num === -1) return 'N/A';
        return String.fromCharCode(65 + num); // 65 is ASCII code for 'A'
    }

    letterToNumber(letter) {
        // Convert N/A to -1, A-S to 0-18
        if (!letter || letter === 'N/A') return -1;
        if (letter.length !== 1) return -1;
        return letter.toUpperCase().charCodeAt(0) - 65;
    }

    updateSubmitButtonState() {
        let isValid = false;

        if (this.collectReadingLevel) {
            // When collect_reading_level is true, all three fields are mandatory
            const accuracyRate = parseInt(this.accuracySlider.value);
            const isAccuracyValid = accuracyRate >= 0; // Must be selected (not N/A which is -1)

            const readingLevel = parseInt(this.readingLevelSlider.value);
            const isReadingLevelValid = readingLevel >= 0; // Must be selected (not N/A which is -1)

            const isBookDifficultyValid = this.selectedDifficulty !== null;

            isValid = isAccuracyValid && isReadingLevelValid && isBookDifficultyValid;
        } else {
            // When collect_reading_level is false, only Book Difficulty is mandatory
            // Reading Level and Word Accuracy are optional (can be N/A)
            const isBookDifficultyValid = this.selectedDifficulty !== null;
            isValid = isBookDifficultyValid;
        }

        // Disable/enable submit buttons based on validation
        if (this.submitBtn) {
            this.submitBtn.disabled = !isValid;
        }
        if (this.submitPhotosBtn) {
            this.submitPhotosBtn.disabled = !isValid;
        }
    }

    updateAccuracyHighlight() {
        const accuracyRate = parseInt(this.accuracySlider.value);
        const hasPhotos = this.uploadedPhotos.length > 0;
        const hasRecording = this.recordedAudioBlob !== null && this.recordedAudioBlob !== undefined;

        // Highlight if user has content ready but accuracy is still N/A and collect_reading_level is true
        if (this.collectReadingLevel && (hasPhotos || hasRecording) && accuracyRate === -1) {
            this.accuracyContainer.classList.add('needs-attention');
        } else {
            this.accuracyContainer.classList.remove('needs-attention');
        }
    }

    updateReadingLevelHighlight() {
        const readingLevel = parseInt(this.readingLevelSlider.value);
        const hasPhotos = this.uploadedPhotos.length > 0;
        const hasRecording = this.recordedAudioBlob !== null && this.recordedAudioBlob !== undefined;

        // Highlight if user has content ready but reading level is still N/A and collect_reading_level is true
        if (this.collectReadingLevel && (hasPhotos || hasRecording) && readingLevel === -1) {
            this.readingLevelContainer.classList.add('needs-attention');
        } else {
            this.readingLevelContainer.classList.remove('needs-attention');
        }
    }

    async loadAvailableDates() {
        try {
            console.log('Loading available dates from API...');
            const response = await fetch('https://tasks.sklabs.app/webhook/80337e94-93a5-407a-94d1-746efcbb4d3c');

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const result = await response.json();

            // Response is wrapped in an array, get the first element
            const data = Array.isArray(result) ? result[0] : result;

            // Parse the new format: { data: [ { name: "2025-10-06", staff: [...], volunteers: [...], day_name: "Monday", collect_reading_level: true }, ... ], volunteers: [...] }
            if (data.data && Array.isArray(data.data)) {
                this.availableDates = data.data.map(item => ({
                    date: item.name,
                    day: item.day_name,
                    staff: item.staff || [],  // VIPs/Super Volunteers
                    volunteers: item.volunteers || [],  // Scheduled volunteers for this date
                    collect_reading_level: item.collect_reading_level !== undefined ? item.collect_reading_level : true  // Default to true if not specified
                }));
            } else {
                this.availableDates = [];
            }

            // Extract volunteers list with their students
            if (data.volunteers && Array.isArray(data.volunteers)) {
                this.volunteers = data.volunteers.map(volunteer => ({
                    id: volunteer.id,
                    name: volunteer.name,
                    students: volunteer.students || []
                }));
            } else {
                this.volunteers = [];
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

            // Get minimum recording seconds from config
            if (data.seconds && typeof data.seconds === 'number') {
                this.minimumSeconds = data.seconds;
                console.log('Minimum recording time:', this.minimumSeconds, 'seconds');
            }

            // Get showAllStudents flag from config (defaults to false)
            if (typeof data.show_all_students === 'boolean') {
                this.showAllStudents = data.show_all_students;
                console.log('Show all students:', this.showAllStudents);
            }

            console.log('Available dates loaded:', this.availableDates);
            console.log('Volunteers loaded:', this.volunteers);

            this.populateDateDropdown();
            // Don't populate volunteers yet - wait for date selection

            // Check URL parameters AFTER data is loaded
            this.checkURLParameters();

        } catch (error) {
            console.error('Failed to load dates:', error);
            this.dateSelect.innerHTML = '<option value="">Error loading dates</option>';
        }
    }

    populateDateDropdown() {
        // Clear existing options
        this.dateSelect.innerHTML = '<option value="">Select a date...</option>';

        if (this.availableDates.length === 0) {
            this.dateSelect.innerHTML = '<option value="">No dates available</option>';
            return;
        }

        // Add all dates as options
        this.availableDates.forEach(dateObj => {
            const option = document.createElement('option');
            option.value = dateObj.date;
            option.textContent = this.formatDateForDisplay(dateObj);
            this.dateSelect.appendChild(option);
        });

        // Pre-select the closest future date
        this.selectClosestFutureDate();
    }

    formatDateForDisplay(dateObj) {
        try {
            // Parse date as local time to avoid timezone issues
            const [year, month, day] = dateObj.date.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDate = date.toLocaleDateString('en-US', options);

            // Don't include staff in the date display anymore
            return `${dateObj.day}, ${formattedDate}`;
        } catch (error) {
            return dateObj.date;
        }
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
            // Trigger date selection to show staff
            this.onDateSelected();
        }
    }

    populateVolunteerDropdown() {
        // Clear existing options
        this.volunteerSelect.innerHTML = '<option value="">Choose your name...</option>';

        if (this.volunteers.length === 0) {
            this.volunteerSelect.innerHTML = '<option value="">No volunteers available</option>';
            return;
        }

        // Filter volunteers based on selected date
        let volunteersToShow = this.volunteers;

        if (this.selectedDate) {
            const selectedDateObj = this.availableDates.find(d => d.date === this.selectedDate);
            if (selectedDateObj && selectedDateObj.volunteers && selectedDateObj.volunteers.length > 0) {
                // Get volunteer IDs scheduled for this date
                const scheduledVolunteerIds = selectedDateObj.volunteers.map(v => v.id);

                // Filter volunteers to only those scheduled for this date
                volunteersToShow = this.volunteers.filter(v => scheduledVolunteerIds.includes(v.id));
                console.log('Filtering to', volunteersToShow.length, 'volunteers scheduled for', this.selectedDate);
            }
        }

        if (volunteersToShow.length === 0) {
            this.volunteerSelect.innerHTML = '<option value="">No volunteers scheduled for this date</option>';
            return;
        }

        // Sort volunteers alphabetically by name
        const sortedVolunteers = [...volunteersToShow].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        // Add filtered volunteers as options
        sortedVolunteers.forEach((volunteer) => {
            const option = document.createElement('option');
            option.value = volunteer.id;
            option.textContent = volunteer.name;
            this.volunteerSelect.appendChild(option);
        });

        console.log('Volunteer dropdown populated with', sortedVolunteers.length, 'volunteers');
    }

    onDateSelected() {
        this.selectedDate = this.dateSelect.value;
        console.log('Date selected:', this.selectedDate);

        // Repopulate volunteer dropdown based on selected date
        this.populateVolunteerDropdown();

        // Reset volunteer and student selections since we're changing the date
        this.volunteerSelect.value = '';
        this.selectedVolunteer = null;
        if (this.studentSelect) {
            this.studentSelect.parentElement.style.display = 'none';
            this.studentSelect.value = '';
        }
        this.previousAccuracy.textContent = ''; // Clear previous accuracy when date changes
        this.previousReadingLevel.textContent = ''; // Clear previous reading level when date changes
        this.onStudentSelected();

        // Update date label with staff names and get collect_reading_level flag
        if (this.selectedDate) {
            const selectedDateObj = this.availableDates.find(d => d.date === this.selectedDate);
            if (selectedDateObj) {
                // Update the collect_reading_level flag for this date
                this.collectReadingLevel = selectedDateObj.collect_reading_level !== undefined ? selectedDateObj.collect_reading_level : true;
                console.log('Collect reading level for this date:', this.collectReadingLevel);

                // Update staff display
                if (selectedDateObj.staff && selectedDateObj.staff.length > 0) {
                    const staffNamesList = selectedDateObj.staff.map(s => s.name).join(', ');
                    this.dateLabel.textContent = `Session Date (VIP's: ${staffNamesList})`;
                } else {
                    this.dateLabel.textContent = 'Session Date';
                }
            } else {
                this.dateLabel.textContent = 'Session Date';
                this.collectReadingLevel = true; // Default to true
            }
        } else {
            this.dateLabel.textContent = 'Session Date';
            this.collectReadingLevel = true; // Default to true
        }
    }

    checkURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const volunteerParam = urlParams.get('volunteer');
        const dateParam = urlParams.get('date');

        // If volunteer parameter is provided, find the next date where they're scheduled
        if (volunteerParam) {
            // Try to find volunteer by ID first, then by name
            const volunteer = this.volunteers.find(v =>
                v.id === volunteerParam ||
                v.name.toLowerCase().replace(/\s+/g, '-') === volunteerParam.toLowerCase()
            );

            if (volunteer) {
                // Find the next date (today or future) where this volunteer is scheduled
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let nextDateForVolunteer = null;
                let minDiff = Infinity;

                this.availableDates.forEach(dateObj => {
                    // Check if volunteer is scheduled for this date
                    const isVolunteerScheduled = dateObj.volunteers &&
                        dateObj.volunteers.some(v => v.id === volunteer.id);

                    if (isVolunteerScheduled) {
                        // Parse date as local time
                        const [year, month, day] = dateObj.date.split('-').map(Number);
                        const date = new Date(year, month - 1, day);
                        date.setHours(0, 0, 0, 0);

                        const diff = date - today;

                        // Only consider today or future dates
                        if (diff >= 0 && diff < minDiff) {
                            minDiff = diff;
                            nextDateForVolunteer = dateObj;
                        }
                    }
                });

                // If no future date found, try to find the most recent past date
                if (!nextDateForVolunteer) {
                    let mostRecentDate = null;
                    let maxPastDate = null;

                    this.availableDates.forEach(dateObj => {
                        const isVolunteerScheduled = dateObj.volunteers &&
                            dateObj.volunteers.some(v => v.id === volunteer.id);

                        if (isVolunteerScheduled) {
                            const [year, month, day] = dateObj.date.split('-').map(Number);
                            const date = new Date(year, month - 1, day);

                            if (!maxPastDate || date > maxPastDate) {
                                maxPastDate = date;
                                mostRecentDate = dateObj;
                            }
                        }
                    });

                    nextDateForVolunteer = mostRecentDate;
                }

                // If we found a date for this volunteer, select it
                if (nextDateForVolunteer && this.dateSelect) {
                    this.dateSelect.value = nextDateForVolunteer.date;
                    this.selectedDate = nextDateForVolunteer.date;
                    this.onDateSelected();

                    // Now select the volunteer
                    if (this.volunteerSelect) {
                        this.volunteerSelect.value = volunteer.id;
                        this.onVolunteerSelected();

                        // Pre-select student if provided
                        const studentParam = urlParams.get('student');
                        if (studentParam && this.selectedVolunteer) {
                            setTimeout(() => {
                                const studentIndex = this.selectedVolunteer.students.findIndex(s =>
                                    s.id === studentParam ||
                                    s.name.toLowerCase().replace(/\s+/g, '-') === studentParam.toLowerCase()
                                );
                                if (studentIndex !== -1 && this.studentSelect) {
                                    this.studentSelect.value = studentIndex;
                                    this.onStudentSelected();
                                }
                            }, 100); // Small delay to ensure dropdown is populated
                        }
                    }
                }
            }
        }
        // If only date parameter is provided (no volunteer), use that
        else if (dateParam && this.dateSelect) {
            const dateOption = Array.from(this.dateSelect.options).find(opt =>
                opt.value === dateParam
            );
            if (dateOption) {
                this.dateSelect.value = dateParam;
                this.selectedDate = dateParam;
                this.onDateSelected();
            }
        }
    }

    onVolunteerSelected() {
        const volunteerId = this.volunteerSelect.value;
        const isSelected = volunteerId !== '';

        if (isSelected) {
            // Find volunteer by ID instead of index
            this.selectedVolunteer = this.volunteers.find(v => v.id === volunteerId);
            console.log('Volunteer selected:', this.selectedVolunteer);

            // Populate student dropdown - either all students or just this volunteer's students
            if (this.selectedVolunteer) {
                const studentsToShow = this.showAllStudents ? this.allStudents : this.selectedVolunteer.students;
                this.populateStudentDropdown(studentsToShow);

                // Show student dropdown
                if (this.studentSelect) {
                    this.studentSelect.parentElement.style.display = 'block';
                }
            }
        } else {
            this.selectedVolunteer = null;
            // Hide student dropdown
            if (this.studentSelect) {
                this.studentSelect.parentElement.style.display = 'none';
            }
        }

        // Enable record button only if both volunteer and student are selected
        this.onStudentSelected();
    }

    populateStudentDropdown(students) {
        if (!this.studentSelect) return;

        // Store students list for later retrieval
        this.currentStudentsList = students;

        // Clear existing options
        this.studentSelect.innerHTML = '<option value="">Select a student...</option>';

        if (!students || students.length === 0) {
            this.studentSelect.innerHTML = '<option value="">No students assigned</option>';
            return;
        }

        // Sort students alphabetically by name
        const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));

        // Add all students as options, storing index to retrieve full student object later
        sortedStudents.forEach((student, index) => {
            const option = document.createElement('option');
            option.value = index; // Store index to retrieve student object
            option.textContent = student.name;
            this.studentSelect.appendChild(option);
        });

        console.log('Student dropdown populated with', students.length, 'students');

        // Auto-select if only one student
        if (students.length === 1) {
            this.studentSelect.value = 0; // Select the first (and only) student
            this.onStudentSelected();
        }
    }

    onStudentSelected() {
        const volunteerSelected = this.volunteerSelect.value !== '';
        const studentSelected = this.studentSelect && this.studentSelect.value !== '';
        const isReady = volunteerSelected && studentSelected;

        // Show/hide sliders and mode selector based on student selection
        if (studentSelected) {
            this.modeSelector.style.display = 'block';

            // Reset and configure Book Difficulty based on collect_reading_level flag
            this.difficultyPills.forEach(pill => pill.classList.remove('active'));

            if (this.collectReadingLevel) {
                // If collect_reading_level is true:
                // - Show all fields by default
                // - Pre-select "Just Right" for Book Difficulty
                // - All fields are mandatory
                this.selectedDifficulty = 'just-right';
                this.difficultyPills.forEach(pill => {
                    if (pill.dataset.difficulty === 'just-right') {
                        pill.classList.add('active');
                    }
                });

                this.bookDifficultyContainer.style.display = 'block';
                this.readingLevelContainer.style.display = 'block';
                this.accuracyContainer.style.display = 'block';
                this.advancedToggleContainer.style.display = 'none'; // Hide toggle button
                this.showAdvancedFields = true; // Mark as shown
            } else {
                // If collect_reading_level is false:
                // - Always show Book Difficulty (no pre-selection, mandatory)
                // - Show toggle button
                // - Show/hide Reading Level and Word Accuracy based on toggle state (optional)
                this.selectedDifficulty = null; // No pre-selection

                this.bookDifficultyContainer.style.display = 'block';
                this.advancedToggleContainer.style.display = 'block';
                this.readingLevelContainer.style.display = this.showAdvancedFields ? 'block' : 'none';
                this.accuracyContainer.style.display = this.showAdvancedFields ? 'block' : 'none';
            }

            // Pre-populate sliders with previous values
            this.prePopulateSliders();

            this.updatePreviousAccuracyDisplay(); // Update previous accuracy display
            this.updatePreviousReadingLevelDisplay(); // Update previous reading level display

            // Show the appropriate section based on current mode
            if (this.feedbackMode === 'audio') {
                this.recordSection.style.display = 'block';
                this.photoSection.style.display = 'none';
                this.recordBtn.disabled = !isReady;
            } else {
                this.photoSection.style.display = 'block';
                this.recordSection.style.display = 'none';
            }
        } else {
            this.advancedToggleContainer.style.display = 'none';
            this.bookDifficultyContainer.style.display = 'none';
            this.accuracyContainer.style.display = 'none';
            this.readingLevelContainer.style.display = 'none';
            this.modeSelector.style.display = 'none';
            this.recordSection.style.display = 'none';
            this.photoSection.style.display = 'none';
            this.previousAccuracy.textContent = ''; // Clear previous accuracy display
            this.previousReadingLevel.textContent = ''; // Clear previous reading level display
        }

        if (isReady) {
            this.recordStatus.textContent = 'Click the microphone button';
            this.recordBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
        } else if (volunteerSelected && !studentSelected) {
            this.recordStatus.textContent = 'Select a student to continue';
            this.recordBtn.disabled = true;
        } else {
            this.recordStatus.textContent = 'Select your name to start recording';
            this.recordBtn.disabled = true;
        }
    }

    prePopulateSliders() {
        const studentIndex = this.studentSelect ? this.studentSelect.value : null;
        if (!studentIndex && studentIndex !== '0') {
            // Reset to N/A if no student selected
            this.accuracySlider.value = -1;
            this.updateAccuracyDisplay(-1);
            this.readingLevelSlider.value = -1;
            this.updateReadingLevelDisplay(-1);
            return;
        }

        const selectedStudent = this.currentStudentsList[studentIndex];
        if (!selectedStudent) {
            // Reset to N/A if student not found
            this.accuracySlider.value = -1;
            this.updateAccuracyDisplay(-1);
            this.readingLevelSlider.value = -1;
            this.updateReadingLevelDisplay(-1);
            return;
        }

        // Pre-populate word accuracy if available and date is valid
        const lastAccuracy = selectedStudent.last_word_accuracy;
        const lastAccuracyDate = selectedStudent.last_accuracy_date;

        if (lastAccuracy !== null && lastAccuracy !== undefined && lastAccuracyDate) {
            if (this.selectedDate && lastAccuracyDate <= this.selectedDate) {
                // Only populate if we have valid previous data
                this.accuracySlider.value = lastAccuracy;
                this.updateAccuracyDisplay(lastAccuracy);
            } else {
                // No valid previous data - always default to N/A
                this.accuracySlider.value = -1;
                this.updateAccuracyDisplay(-1);
            }
        } else {
            // No previous data - always default to N/A
            this.accuracySlider.value = -1;
            this.updateAccuracyDisplay(-1);
        }

        // Pre-populate reading level if available and date is valid
        const lastLevel = selectedStudent.last_reading_level;
        const lastLevelDate = selectedStudent.last_reading_level_date;

        if (lastLevel && lastLevelDate) {
            if (this.selectedDate && lastLevelDate <= this.selectedDate) {
                // Only populate if we have valid previous data
                const levelNumber = this.letterToNumber(lastLevel);
                this.readingLevelSlider.value = levelNumber;
                this.updateReadingLevelDisplay(levelNumber);
            } else {
                // No valid previous data - always default to N/A
                this.readingLevelSlider.value = -1;
                this.updateReadingLevelDisplay(-1);
            }
        } else {
            // No previous data - always default to N/A
            this.readingLevelSlider.value = -1;
            this.updateReadingLevelDisplay(-1);
        }
    }

    updatePreviousAccuracyDisplay() {
        const studentIndex = this.studentSelect ? this.studentSelect.value : null;
        if (!studentIndex && studentIndex !== '0') {
            this.previousAccuracy.textContent = '';
            return;
        }

        // Get the selected student object
        const selectedStudent = this.currentStudentsList[studentIndex];
        if (!selectedStudent) {
            this.previousAccuracy.textContent = '';
            return;
        }

        const lastAccuracy = selectedStudent.last_word_accuracy;
        const lastDate = selectedStudent.last_accuracy_date;

        // Check if previous data exists and date is valid
        if (lastAccuracy !== null && lastAccuracy !== undefined && lastDate) {
            // Compare dates: only show if last_accuracy_date <= selected date
            if (this.selectedDate && lastDate <= this.selectedDate) {
                // Format date as M/D
                const formattedDate = this.formatDateMD(lastDate);
                this.previousAccuracy.textContent = `(Prior: ${lastAccuracy}% on ${formattedDate})`;
            } else {
                this.previousAccuracy.textContent = '(No prior data for this date)';
            }
        } else {
            this.previousAccuracy.textContent = '(No prior data)';
        }
    }

    formatDateMD(dateString) {
        // Parse YYYY-MM-DD and return M/D format
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        const month = parseInt(parts[1], 10); // Remove leading zero
        const day = parseInt(parts[2], 10);   // Remove leading zero
        return `${month}/${day}`;
    }

    updatePreviousReadingLevelDisplay() {
        const studentIndex = this.studentSelect ? this.studentSelect.value : null;
        if (!studentIndex && studentIndex !== '0') {
            this.previousReadingLevel.textContent = '';
            return;
        }

        // Get the selected student object
        const selectedStudent = this.currentStudentsList[studentIndex];
        if (!selectedStudent) {
            this.previousReadingLevel.textContent = '';
            return;
        }

        const lastLevel = selectedStudent.last_reading_level;
        const lastDate = selectedStudent.last_reading_level_date;

        // Check if previous data exists and date is valid
        if (lastLevel && lastDate) {
            // Compare dates: only show if last_reading_level_date <= selected date
            if (this.selectedDate && lastDate <= this.selectedDate) {
                // Format date as M/D
                const formattedDate = this.formatDateMD(lastDate);
                this.previousReadingLevel.textContent = `(Prior: ${lastLevel} on ${formattedDate})`;
            } else {
                this.previousReadingLevel.textContent = '(No prior data for this date)';
            }
        } else {
            this.previousReadingLevel.textContent = '(No prior data)';
        }
    }

    switchMode(mode) {
        this.feedbackMode = mode;

        // Update button states
        if (mode === 'audio') {
            this.audioModeBtn.classList.add('active');
            this.photoModeBtn.classList.remove('active');
            this.recordSection.style.display = 'block';
            this.photoSection.style.display = 'none';
        } else {
            this.photoModeBtn.classList.add('active');
            this.audioModeBtn.classList.remove('active');
            this.photoSection.style.display = 'block';
            this.recordSection.style.display = 'none';
        }
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
            this.photoActions.style.display = 'block';
            this.updateSubmitButtonState(); // Check if submit should be enabled
            this.updateAccuracyHighlight(); // Highlight accuracy if needed
            this.updateReadingLevelHighlight(); // Highlight reading level if needed
        } else {
            this.photoCount.textContent = '';
            this.photoActions.style.display = 'none';
            this.updateAccuracyHighlight(); // Remove highlight when no photos
            this.updateReadingLevelHighlight(); // Remove highlight when no photos
        }
    }

    removePhoto(index) {
        this.uploadedPhotos.splice(index, 1);
        this.renderPhotoGrid();
    }

    async submitPhotos() {
        if (this.uploadedPhotos.length === 0) {
            alert('Please add at least one photo before submitting.');
            return;
        }

        if (!this.selectedVolunteer) {
            alert('Please select a volunteer.');
            return;
        }

        const studentIndex = this.studentSelect ? this.studentSelect.value : null;
        if (!studentIndex && studentIndex !== '0') {
            alert('Please select a student.');
            return;
        }

        // Show loading and hide everything else
        this.photoSection.style.display = 'none';
        this.modeSelector.style.display = 'none';
        this.accuracyContainer.style.display = 'none';
        this.loadingSection.style.display = 'block';

        try {
            await this.uploadPhotosToSupabase();

            // Show success
            this.loadingSection.style.display = 'none';
            alert(`Thanks! ${this.uploadedPhotos.length} photo${this.uploadedPhotos.length !== 1 ? 's have' : ' has'} been submitted successfully.`);

            // Reset
            this.uploadedPhotos = [];
            this.renderPhotoGrid();
            this.studentSelect.value = '';
            this.accuracySlider.value = -1;
            this.updateAccuracyDisplay(-1);
            this.readingLevelSlider.value = -1;
            this.updateReadingLevelDisplay(-1);
            this.accuracyContainer.classList.remove('needs-attention'); // Remove highlight
            this.readingLevelContainer.classList.remove('needs-attention'); // Remove highlight

            // Re-trigger student selection which will auto-select if only one student
            if (this.currentStudentsList && this.currentStudentsList.length === 1) {
                this.studentSelect.value = 0;
                this.onStudentSelected();
            } else {
                this.modeSelector.style.display = 'none';
                this.photoSection.style.display = 'none';
                this.accuracyContainer.style.display = 'none';
                this.readingLevelContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload photos. Please try again.');
            this.loadingSection.style.display = 'none';
            this.photoSection.style.display = 'block';
            this.accuracyContainer.style.display = 'block';
            this.modeSelector.style.display = 'block';
        }
    }

    async uploadPhotosToSupabase() {
        if (!this.storage) {
            throw new Error('Storage not initialized');
        }

        if (!this.selectedDate) {
            throw new Error('Please select a date');
        }

        if (!this.selectedVolunteer) {
            throw new Error('Please select a volunteer');
        }

        const studentIndex = this.studentSelect ? this.studentSelect.value : null;
        if (!studentIndex && studentIndex !== '0') {
            throw new Error('Please select a student');
        }

        // Get the selected student object from the current students list
        const selectedStudent = this.currentStudentsList[studentIndex];
        if (!selectedStudent) {
            throw new Error('Invalid student selection');
        }

        try {
            // Get volunteer name for filename (convert to URL-friendly format)
            const volunteerName = this.selectedVolunteer.name.toLowerCase().replace(/\s+/g, '-');

            // Get staff for the selected date
            const selectedDateObj = this.availableDates.find(d => d.date === this.selectedDate);
            const staff = selectedDateObj && selectedDateObj.staff ? selectedDateObj.staff : [];

            // Get word accuracy rate, reading level, and book difficulty
            const accuracyRateValue = parseInt(this.accuracySlider.value);
            const accuracyRate = accuracyRateValue === -1 ? 'N/A' : accuracyRateValue;

            const readingLevelValue = parseInt(this.readingLevelSlider.value);
            const readingLevel = readingLevelValue === -1 ? 'N/A' : this.numberToLetter(readingLevelValue);

            const bookDifficulty = this.selectedDifficulty;

            // Upload photos to Supabase Storage with Claude transcription
            const result = await this.storage.uploadPhotoFiles(
                this.uploadedPhotos,
                volunteerName,
                this.selectedDate,
                this.selectedVolunteer.name,
                selectedStudent,
                this.selectedVolunteer.id,
                staff,
                accuracyRate,  // Pass word accuracy rate or 'N/A'
                readingLevel,  // Pass reading level as letter (A-S) or 'N/A'
                bookDifficulty // Pass book difficulty (too-easy, just-right, too-hard)
            );

            console.log('Photo upload successful:', result);
            return result;

        } catch (error) {
            console.error('Photo upload failed:', error);
            throw error;
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: this.getSupportedMimeType()
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingComplete();
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            this.updateUIForRecording();
            this.startTimer();

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Unable to access microphone. Please check permissions.');
        }
    }

    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/mpeg'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return 'audio/webm'; // fallback
    }

    togglePauseRecording() {
        if (!this.mediaRecorder) return;

        if (this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
            this.recordStatus.textContent = 'Recording resumed...';
            this.startTimer();
        } else {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume';
            this.recordStatus.textContent = 'Recording paused';
            this.stopTimer();
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.isPaused = false;
            this.stopTimer();
        }
    }

    resetForNewRecording() {
        this.playbackSection.style.display = 'none';
        this.recordingControls.style.display = 'none';
        this.recordSection.style.display = 'block'; // Show record section again
        this.recordBtn.disabled = false;
        this.recordBtn.classList.remove('recording');
        this.recordStatus.textContent = 'Click the microphone button';
        this.statusBar.style.width = '0%';
        this.statusBar.style.background = 'var(--accent-color)'; // Reset to orange
        this.audioChunks = [];
        this.recordedAudioBlob = null; // Clear the blob
        this.updateAccuracyHighlight(); // Remove highlight when clearing recording
    }

    handleRecordingComplete() {
        const audioBlob = new Blob(this.audioChunks, {
            type: this.getSupportedMimeType()
        });

        const audioUrl = URL.createObjectURL(audioBlob);
        this.audioPlayback.src = audioUrl;

        // Store the blob for upload
        this.recordedAudioBlob = audioBlob;

        this.updateUIForPlayback();
    }

    updateUIForRecording() {
        this.recordBtn.classList.add('recording');
        this.recordBtn.innerHTML = '<i class="bi bi-record-fill"></i>';
        this.recordBtn.disabled = true;
        this.recordingControls.style.display = 'block';
        this.playbackSection.style.display = 'none';
        this.recordStatus.textContent = 'Recording...';

        // Disable stop button until minimum time is reached
        this.stopBtn.disabled = true;
    }

    updateUIForPlayback() {
        this.recordBtn.classList.remove('recording');
        this.recordingControls.style.display = 'none';
        this.recordSection.style.display = 'none'; // Hide entire record section
        this.playbackSection.style.display = 'block';
        this.updateSubmitButtonState(); // Check if submit should be enabled
        this.updateAccuracyHighlight(); // Highlight accuracy if needed
    }

    startTimer() {
        this.recordingTimer = setInterval(() => {
            if (this.isRecording && !this.isPaused) {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;

                // Calculate progress based on minimum seconds
                const progress = Math.min((elapsed / this.minimumSeconds) * 100, 100);
                this.statusBar.style.width = `${progress}%`;

                // Change color and enable stop button when minimum is reached
                if (elapsed >= this.minimumSeconds) {
                    this.statusBar.style.background = '#28A745'; // Green
                    this.recordStatus.textContent = `Recording... ${minutes}:${seconds.toString().padStart(2, '0')} ✓`;
                    this.stopBtn.disabled = false; // Enable stop button
                } else {
                    this.statusBar.style.background = 'var(--accent-color)'; // Orange
                    const remaining = this.minimumSeconds - elapsed;
                    this.recordStatus.textContent = `Recording... ${minutes}:${seconds.toString().padStart(2, '0')} (${remaining}s remaining)`;
                    this.stopBtn.disabled = true; // Keep stop button disabled
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    async handleSubmit(event) {
        event.preventDefault();

        if (!this.recordedAudioBlob) {
            this.showError('Please record your feedback first.');
            return;
        }

        if (!this.volunteerSelect.value) {
            this.showError('Please select your name.');
            return;
        }

        // Hide all sections and show loading
        this.recordSection.style.display = 'none';
        this.recordingControls.style.display = 'none';
        this.playbackSection.style.display = 'none';
        this.modeSelector.style.display = 'none';
        this.accuracyContainer.style.display = 'none';
        this.loadingSection.style.display = 'block';

        try {
            await this.uploadToSupabase();
            this.showSuccess();
        } catch (error) {
            console.error('Upload error:', error);
            this.showError('Failed to upload feedback. Please try again.');
            // Show playback section again on error
            this.loadingSection.style.display = 'none';
            this.playbackSection.style.display = 'block';
            this.accuracyContainer.style.display = 'block';
            this.modeSelector.style.display = 'block';
        }
    }

    async uploadToSupabase() {
        if (!this.storage) {
            throw new Error('Storage not initialized');
        }

        if (!this.selectedDate) {
            throw new Error('Please select a date');
        }

        if (!this.selectedVolunteer) {
            throw new Error('Please select a volunteer');
        }

        const studentIndex = this.studentSelect ? this.studentSelect.value : null;
        if (!studentIndex && studentIndex !== '0') {
            throw new Error('Please select a student');
        }

        // Get the selected student object from the current students list
        const selectedStudent = this.currentStudentsList[studentIndex];
        if (!selectedStudent) {
            throw new Error('Invalid student selection');
        }

        try {
            // Validate the audio file
            this.storage.validateAudioFile(this.recordedAudioBlob);

            // Get volunteer name for filename (convert to URL-friendly format)
            const volunteerName = this.selectedVolunteer.name.toLowerCase().replace(/\s+/g, '-');

            // Get staff for the selected date
            const selectedDateObj = this.availableDates.find(d => d.date === this.selectedDate);
            const staff = selectedDateObj && selectedDateObj.staff ? selectedDateObj.staff : [];

            // Get word accuracy rate, reading level, and book difficulty
            const accuracyRateValue = parseInt(this.accuracySlider.value);
            const accuracyRate = accuracyRateValue === -1 ? 'N/A' : accuracyRateValue;

            const readingLevelValue = parseInt(this.readingLevelSlider.value);
            const readingLevel = readingLevelValue === -1 ? 'N/A' : this.numberToLetter(readingLevelValue);

            const bookDifficulty = this.selectedDifficulty;

            // Upload to Supabase Storage with selected date, volunteer, student, and staff info
            const result = await this.storage.uploadAudioFile(
                this.recordedAudioBlob,
                volunteerName,
                this.selectedDate,
                this.selectedVolunteer.name,
                selectedStudent,
                this.selectedVolunteer.id,  // Pass volunteer ID for relations
                staff,  // Pass staff array for the selected date
                accuracyRate,   // Pass word accuracy rate or 'N/A'
                readingLevel,   // Pass reading level as letter (A-S) or 'N/A'
                bookDifficulty  // Pass book difficulty (too-easy, just-right, too-hard)
            );

            console.log('Upload successful:', result);
            return result;

        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    showError(message) {
        // Create or update error alert
        this.showAlert(message, 'danger');
    }

    showSuccess() {
        // Hide loading
        this.loadingSection.style.display = 'none';

        // Show native JavaScript alert
        alert('Thanks! Your feedback has been submitted successfully.');

        // Reset to volunteer selected state (clear student selection)
        this.resetForNewRecording();
        this.studentSelect.value = '';
        this.accuracySlider.value = -1;
        this.updateAccuracyDisplay(-1);
        this.readingLevelSlider.value = -1;
        this.updateReadingLevelDisplay(-1);
        this.accuracyContainer.classList.remove('needs-attention'); // Remove highlight
        this.readingLevelContainer.classList.remove('needs-attention'); // Remove highlight

        // Re-trigger student selection which will auto-select if only one student
        if (this.currentStudentsList && this.currentStudentsList.length === 1) {
            this.studentSelect.value = 0;
            this.onStudentSelected();
        } else {
            this.onStudentSelected();
        }
    }

    showAlert(message, type) {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert-notification');
        existingAlerts.forEach(alert => alert.remove());

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-notification d-flex align-items-center`;
        alertDiv.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill'} me-3"></i>
            <div>${message}</div>
        `;

        this.feedbackForm.insertBefore(alertDiv, this.feedbackForm.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FeedbackRecorder();
});