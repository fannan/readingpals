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

        // Photo mode events
        this.audioModeBtn.addEventListener('click', () => this.switchMode('audio'));
        this.photoModeBtn.addEventListener('click', () => this.switchMode('photo'));
        this.photoInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        this.submitPhotosBtn.addEventListener('click', () => this.submitPhotos());
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

            // Parse the new format: { data: [ { name: "2025-10-06", staff: [...], volunteers: [...], day_name: "Monday" }, ... ], volunteers: [...] }
            if (data.data && Array.isArray(data.data)) {
                this.availableDates = data.data.map(item => ({
                    date: item.name,
                    day: item.day_name,
                    staff: item.staff || [],  // VIPs/Super Volunteers
                    volunteers: item.volunteers || []  // Scheduled volunteers for this date
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
        this.onStudentSelected();

        // Update date label with staff names
        if (this.selectedDate) {
            const selectedDateObj = this.availableDates.find(d => d.date === this.selectedDate);
            if (selectedDateObj && selectedDateObj.staff && selectedDateObj.staff.length > 0) {
                const staffNamesList = selectedDateObj.staff.map(s => s.name).join(', ');
                this.dateLabel.textContent = `Session Date (VIP's: ${staffNamesList})`;
            } else {
                this.dateLabel.textContent = 'Session Date';
            }
        } else {
            this.dateLabel.textContent = 'Session Date';
        }
    }

    checkURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);

        // Pre-select date if provided
        const dateParam = urlParams.get('date');
        if (dateParam && this.dateSelect) {
            const dateOption = Array.from(this.dateSelect.options).find(opt =>
                opt.value === dateParam
            );
            if (dateOption) {
                this.dateSelect.value = dateParam;
                this.selectedDate = dateParam;
                this.onDateSelected();
            }
        }

        // Pre-select volunteer if provided
        const volunteerParam = urlParams.get('volunteer');
        if (volunteerParam) {
            // Try to find by ID first, then by name
            const volunteer = this.volunteers.find(v =>
                v.id === volunteerParam ||
                v.name.toLowerCase().replace(/\s+/g, '-') === volunteerParam.toLowerCase()
            );

            if (volunteer && this.volunteerSelect) {
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
    }

    onStudentSelected() {
        const volunteerSelected = this.volunteerSelect.value !== '';
        const studentSelected = this.studentSelect && this.studentSelect.value !== '';
        const isReady = volunteerSelected && studentSelected;

        // Show/hide mode selector based on student selection
        if (studentSelected) {
            this.modeSelector.style.display = 'block';
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
            this.modeSelector.style.display = 'none';
            this.recordSection.style.display = 'none';
            this.photoSection.style.display = 'none';
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
        } else {
            this.photoCount.textContent = '';
            this.photoActions.style.display = 'none';
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

        // Show loading
        this.photoSection.style.display = 'none';
        this.modeSelector.style.display = 'none';
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
            this.modeSelector.style.display = 'none';
            this.photoSection.style.display = 'none';
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload photos. Please try again.');
            this.loadingSection.style.display = 'none';
            this.photoSection.style.display = 'block';
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

            // Upload photos to Supabase Storage with Claude transcription
            const result = await this.storage.uploadPhotoFiles(
                this.uploadedPhotos,
                volunteerName,
                this.selectedDate,
                this.selectedVolunteer.name,
                selectedStudent,
                this.selectedVolunteer.id,
                staff
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

            // Upload to Supabase Storage with selected date, volunteer, student, and staff info
            const result = await this.storage.uploadAudioFile(
                this.recordedAudioBlob,
                volunteerName,
                this.selectedDate,
                this.selectedVolunteer.name,
                selectedStudent,
                this.selectedVolunteer.id,  // Pass volunteer ID for relations
                staff  // Pass staff array for the selected date
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
        this.onStudentSelected();
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