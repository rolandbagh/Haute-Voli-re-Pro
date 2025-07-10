// --- NEW, RESTRUCTURED app.js ---

// Immediately-Invoked Function Expression (IIFE) to set the theme on initial load.
// This prevents the "flash" of the wrong theme.
(function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-mode', savedTheme === 'dark');
})();

// Wait for the entire HTML document to be loaded and parsed.
document.addEventListener('DOMContentLoaded', function() {
    
    // =================================================================================
    // STATE MANAGEMENT - The single source of truth for our application's data.
    // =================================================================================
    const state = {
        pigeons: [],
        breedingPairs: [],
        healthRecords: [],
        loftInfo: {},
        breedingSettings: {},
        currentEditing: {
            pigeon: null,
            pair: null,
            health: null,
        },
        lastFocusedElement: null,
        dataHasChanged: false,
        currentSort: { column: 'bandNumber', direction: 'asc' },
    };

    // =================================================================================
    // DATA HANDLING & PERSISTENCE (localStorage)
    // =================================================================================
    const dataManager = {
        loadAllData: function() {
            // Load core data or provide default sample data if none exists.
            state.pigeons = JSON.parse(localStorage.getItem('pigeons')) || [{ id: Date.now() + 1, bandNumber: 'AU-2024-001', name: 'Champion', gender: 'cock', color: 'Blue Bar', hatchDate: '2024-03-15', strain: 'Janssen', status: 'active', sireId: '', damId: '' }, { id: Date.now() + 2, bandNumber: 'AU-2024-002', name: 'Beauty', gender: 'hen', color: 'Red Check', hatchDate: '2024-03-20', strain: 'Vandenabeele', status: 'breeding', sireId: '', damId: '' }];
            state.breedingPairs = JSON.parse(localStorage.getItem('breedingPairs')) || [];
            state.healthRecords = JSON.parse(localStorage.getItem('healthRecords')) || [];
            state.loftInfo = JSON.parse(localStorage.getItem('loftInfo')) || {};
            
            // Ensure notification flags exist on older data.
            state.breedingPairs.forEach(p => {
                p.notifiedForEggCheck = p.notifiedForEggCheck || false;
                p.notifiedForHatching = p.notifiedForHatching || false;
                p.notifiedForRinging = p.notifiedForRinging || false;
            });

            // Load settings with defaults
            const defaultSettings = {
                notificationsEnabled: true, notificationWindow: 5, showOverdueTasks: true,
                eggCheckDays: 8, hatchingDays: 20, ringingDays: 28
            };
            const savedSettings = JSON.parse(localStorage.getItem('breedingSettings'));
            state.breedingSettings = { ...defaultSettings, ...savedSettings };
        },
        saveAllData: function() {
            localStorage.setItem('pigeons', JSON.stringify(state.pigeons));
            localStorage.setItem('breedingPairs', JSON.stringify(state.breedingPairs));
            localStorage.setItem('healthRecords', JSON.stringify(state.healthRecords));
            localStorage.setItem('loftInfo', JSON.stringify(state.loftInfo));
            localStorage.setItem('breedingSettings', JSON.stringify(state.breedingSettings));
            state.dataHasChanged = true;
            uiManager.updateBackupPrompt();
            uiManager.updateDashboard();
        },
        findPigeon: (id) => state.pigeons.find(p => p.id === id),
        findPair: (id) => state.breedingPairs.find(p => p.id === id),
        findHealthRecord: (id) => state.healthRecords.find(r => r.id === id),
    };

    // =================================================================================
    // UI MANAGEMENT - All functions that read from state and update the screen.
    // =================================================================================
    const uiManager = {
        // Main update function
        updateAll: function() {
            this.updatePigeonTable();
            this.updateBreedingTable();
            this.updateHealthTable();
            this.updateLoftInfoForm();
            this.updateBreedingSettingsForm();
            this.updateDashboard();
            this.updateThemeToggleState();
            this.checkForUpcomingTasks();
            this.makeTablesResponsive();
        },
        
        // Table Updaters
        updatePigeonTable: function() {
            document.getElementById('pigeon-count-display').innerHTML = `Total Recorded: <strong>${state.pigeons.length}</strong>`;
            const tbody = document.querySelector('#pigeons-table tbody');
            tbody.innerHTML = '';
            state.pigeons.forEach(p => {
                const sire = dataManager.findPigeon(parseInt(p.sireId));
                const dam = dataManager.findPigeon(parseInt(p.damId));
                const row = document.createElement('tr');
                row.dataset.id = p.id; // Add ID for event delegation
                row.innerHTML = `
                    <td>
                        ${p.imageURL 
                            ? `<img src="${p.imageURL}" alt="${p.name || 'Pigeon'}" class="pigeon-thumbnail">` 
                            : '<span class="no-image-placeholder"><i class="fas fa-dove"></i></span>'
                        }
                    </td>
                    <td><span>${p.bandNumber}</span></td>
                    <td><span>${p.name || '-'}</span></td>
                    <td><span>${p.gender}</span></td>
                    <td>
                        <div class="date-age-cell">
                            <span>${this.formatDate(p.hatchDate)}</span>
                            <span class="pigeon-age">${this.calculateAge(p.hatchDate)}</span>
                        </div>
                    </td>
                    <td><span>${sire ? sire.bandNumber : '-'}</span></td>
                    <td><span>${dam ? dam.bandNumber : '-'}</span></td>
                    <td><span class="status-badge status-${p.status}">${p.status}</span></td>
                    <td class="actions-cell">
                        <div class="actions-cell-content">
                            <button class="secondary-btn" data-action="pedigree-pigeon" style="padding:5px 10px;font-size:12px;">Pedigree</button>
                            <button class="secondary-btn" data-action="edit-pigeon" style="padding:5px 10px;font-size:12px;">Edit</button>
                            <button class="danger-btn" data-action="delete-pigeon" style="padding:5px 10px;font-size:12px;">Delete</button>
                        </div>
                    </td>`;
                tbody.appendChild(row);
            });
            this.updateSortIndicators();
        },
        updateBreedingTable: function() {
            const tbody = document.querySelector('#pairs-table tbody');
            tbody.innerHTML = '';
            state.breedingPairs.forEach(pair => {
                const cock = dataManager.findPigeon(parseInt(pair.cockId));
                const hen = dataManager.findPigeon(parseInt(pair.henId));
                const checkDate = pair.firstEggDate ? this.addDaysAndFormat(pair.firstEggDate, state.breedingSettings.eggCheckDays) : null;
                const hatchDate = pair.firstEggDate ? this.addDaysAndFormat(pair.firstEggDate, state.breedingSettings.hatchingDays) : null;
                const row = document.createElement('tr');
                row.dataset.id = pair.id;
                row.innerHTML = `
                    <td><span>BP-${String(pair.id).slice(-4)}</span></td>
                    <td><span>${cock ? cock.bandNumber : 'N/A'}</span></td>
                    <td><span>${hen ? hen.bandNumber : 'N/A'}</span></td>
                    <td><span>${pair.nestBox || '-'}</span></td>
                    <td><span class="status-badge status-${pair.status}">${pair.status}</span></td>
                    <td><span>${pair.eggsLaid || '0'}</span></td>
                    <td><span>${this.formatDate(checkDate)}</span></td>
                    <td><span>${pair.activatedEggs || '0'}</span></td>
                    <td><span>${this.formatDate(hatchDate)}</span></td>
                    <td><span>${pair.hatchedEggs || '0'}</span></td>
                    <td class="actions-cell"><div class="actions-cell-content">
                        <button class="secondary-btn" data-action="view-offspring" style="padding:5px 10px;font-size:12px;">View</button>
                        <button class="secondary-btn" data-action="edit-pair" style="padding:5px 10px;font-size:12px;">Edit</button>
                        <button class="danger-btn" data-action="delete-pair" style="padding:5px 10px;font-size:12px;">Delete</button>
                    </div></td>`;
                tbody.appendChild(row);
            });
        },
        updateHealthTable: function() {
            const tbody = document.querySelector('#health-table tbody');
            tbody.innerHTML = '';
            state.healthRecords.forEach(record => {
                const pigeon = dataManager.findPigeon(parseInt(record.pigeonId));
                const row = document.createElement('tr');
                row.dataset.id = record.id;
                row.innerHTML = `
                    <td><span>${pigeon ? pigeon.bandNumber : 'N/A'}</span></td>
                    <td><span>${this.formatDate(record.date)}</span></td>
                    <td><span>${record.type}</span></td>
                    <td><span>${record.description || '-'}</span></td>
                    <td><span>${record.treatment || '-'}</span></td>
                    <td class="actions-cell"><div class="actions-cell-content">
                        <button class="secondary-btn" data-action="edit-health" style="padding:5px 10px;font-size:12px;">Edit</button>
                        <button class="danger-btn" data-action="delete-health" style="padding:5px 10px;font-size:12px;">Delete</button>
                    </div></td>`;
                tbody.appendChild(row);
            });
        },
        
        // Form & Dashboard Updaters
        updateLoftInfoForm: () => {
            document.getElementById('loft-name').value = state.loftInfo.name || '';
            document.getElementById('owner-name').value = state.loftInfo.owner || '';
            document.getElementById('location').value = state.loftInfo.location || '';
        },
        updateBreedingSettingsForm: () => {
            document.getElementById('notifications-enabled').checked = state.breedingSettings.notificationsEnabled;
            document.getElementById('notification-window').value = state.breedingSettings.notificationWindow;
            document.getElementById('show-overdue-tasks').checked = state.breedingSettings.showOverdueTasks;
            document.getElementById('egg-check-days').value = state.breedingSettings.eggCheckDays;
            document.getElementById('hatching-days').value = state.breedingSettings.hatchingDays;
            document.getElementById('ringing-days').value = state.breedingSettings.ringingDays;
        },
        updateDashboard: function() {
            // First, get a list of only the pigeons currently in the loft.
            const pigeonsInLoft = state.pigeons.filter(p => p.status === 'active' || p.status === 'breeding');

            // Now, base all calculations on this filtered list.
            document.getElementById('total-pigeons-stat').textContent = pigeonsInLoft.length;
            document.getElementById('total-cocks-stat').textContent = pigeonsInLoft.filter(p => p.gender === 'cock').length;
            document.getElementById('total-hens-stat').textContent = pigeonsInLoft.filter(p => p.gender === 'hen').length;
            document.getElementById('total-pairs-stat').textContent = state.breedingPairs.filter(p => p.status !== 'inactive').length;
            
            const currentYear = new Date().getFullYear();
            document.getElementById('total-young-stat').textContent = pigeonsInLoft.filter(p => p.hatchDate && new Date(p.hatchDate + 'T00:00:00').getFullYear() === currentYear).length;
        },
        updateThemeToggleState: () => {
            document.getElementById('theme-toggle').checked = (localStorage.getItem('theme') === 'dark');
        },
        
        // Modal & View Management
        switchView: (viewName) => {
            document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
            document.getElementById(`${viewName}-view`).classList.add('active');
            document.querySelectorAll('nav li[role="tab"]').forEach(item => {
                item.setAttribute('aria-selected', item.getAttribute('data-view') === viewName);
            });
        },
        openModal: (modalId) => {
            state.lastFocusedElement = document.activeElement;
            const modal = document.getElementById(modalId);
            modal.classList.add('is-open');
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length > 0) focusable[0].focus();
        },
        closeModal: (modalId) => {
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.remove('is-open');
            if (state.lastFocusedElement) state.lastFocusedElement.focus();
        },

        // Utility & Helper functions
        showMessage: (message, type) => {
            const container = document.getElementById('message-container');
            const div = document.createElement('div');
            div.className = `message ${type}-message`;
            div.textContent = message;
            container.appendChild(div);
            setTimeout(() => div.remove(), 3000);
        },
        formatDate: (isoDate) => {
            if (!isoDate || typeof isoDate !== 'string') return '-';
            const [year, month, day] = isoDate.split('-');
            return (day && month && year) ? `${day}/${month}/${year}` : '-';
        },
        addDaysAndFormat: (startDate, days) => {
            const date = new Date(startDate + 'T00:00:00');
            date.setDate(date.getDate() + parseInt(days));
            return date.toISOString().split('T')[0];
        },
        updateCalculatedDates: function() {
            const firstEggDate = document.getElementById('first-egg-date').value;
            const activationDays = document.getElementById('activation-days').value;
            const hatchingDays = document.getElementById('hatching-days').value;
            const ringDays = document.getElementById('ring-days').value;
            
            if (!firstEggDate) {
                ['activation-date', 'hatching-date', 'ring-date'].forEach(id => document.getElementById(id).value = '');
                return;
            }
            document.getElementById('activation-date').value = this.formatDate(this.addDaysAndFormat(firstEggDate, activationDays));
            document.getElementById('hatching-date').value = this.formatDate(this.addDaysAndFormat(firstEggDate, hatchingDays));
            document.getElementById('ring-date').value = this.formatDate(this.addDaysAndFormat(firstEggDate, ringDays));
        },
        makeTablesResponsive: () => {
             document.querySelectorAll('table').forEach(table => {
                const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/#/, 'Number'));
                table.querySelectorAll('tbody tr').forEach(row => {
                    row.querySelectorAll('td').forEach((td, index) => {
                        if (headers[index]) td.setAttribute('data-label', headers[index]);
                    });
                });
            });
        },
        calculateAge: function(hatchDateString) {
            if (!hatchDateString) return '';
            
            const birthDate = new Date(hatchDateString);
            const today = new Date();
            
            // Fix for timezone issues by ensuring both dates are treated as UTC midnight
            birthDate.setUTCHours(0, 0, 0, 0);
            today.setUTCHours(0, 0, 0, 0);

            if (birthDate > today) return '';

            let years = today.getUTCFullYear() - birthDate.getUTCFullYear();
            let months = today.getUTCMonth() - birthDate.getUTCMonth();
            
            if (months < 0 || (months === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
                years--;
                months += 12;
            }

            if (years > 0) {
                return `${years}y ${months}m`;
            } else if (months > 0) {
                return `${months}m`;
            } else {
                // If less than a month, calculate days
                const diffTime = Math.abs(today - birthDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return `${diffDays}d`;
            }
        },
        updateSortIndicators: () => {
            document.querySelectorAll('#pigeons-table th[data-sort]').forEach(th => {
                th.classList.remove('sorted-asc', 'sorted-desc');
                if (th.dataset.sort === state.currentSort.column) {
                    th.classList.add(state.currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
                }
            });
        },
        updateBackupPrompt: () => {
            const backupPrompt = document.getElementById('backup-prompt');
            const importPrompt = document.getElementById('import-prompt');
            const backupExists = localStorage.getItem('backupPerformed') === 'true';
            backupPrompt.classList.toggle('visible', state.dataHasChanged && !backupExists);
            importPrompt.classList.toggle('visible', !state.dataHasChanged && backupExists);
        },
        
        // Notifications
        checkForUpcomingTasks: function() {
            if (!state.breedingSettings.notificationsEnabled) {
                document.getElementById('notifications-container').style.display = 'none';
                return;
            }

            const container = document.getElementById('notifications-container');
            const list = document.getElementById('notification-list');
            list.innerHTML = '';
            
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const futureLimitDate = new Date();
            futureLimitDate.setDate(today.getDate() + (state.breedingSettings.notificationWindow));

            const tasks = [];
            const activeStatuses = ['paired', 'laying', 'incubating', 'feeding'];

            state.breedingPairs.forEach(pair => {
                if (!pair.firstEggDate || !activeStatuses.includes(pair.status)) return;
                
                const cock = dataManager.findPigeon(parseInt(pair.cockId));
                const hen = dataManager.findPigeon(parseInt(pair.henId));
                const pairName = `Pair: ${cock ? cock.bandNumber : 'N/A'} / ${hen ? hen.bandNumber : 'N/A'}`;

                const addDays = (d, days) => { const date = new Date(d+'T00:00:00'); date.setDate(date.getDate() + days); return date; };
                const eggCheckDate = addDays(pair.firstEggDate, state.breedingSettings.eggCheckDays);
                const hatchingDate = addDays(pair.firstEggDate, state.breedingSettings.hatchingDays);
                const ringingDate = addDays(pair.firstEggDate, state.breedingSettings.ringingDays);

                if ((!state.breedingSettings.showOverdueTasks && eggCheckDate < today) ? false : (eggCheckDate <= futureLimitDate && !pair.notifiedForEggCheck)) {
                    tasks.push({ text: "Time to Check Eggs", details: pairName, id: pair.id, taskType: 'eggCheck', dueDate: eggCheckDate });
                }
                if ((!state.breedingSettings.showOverdueTasks && hatchingDate < today) ? false : (hatchingDate <= futureLimitDate && !pair.notifiedForHatching)) {
                    tasks.push({ text: "Time to Check Hatching", details: pairName, id: pair.id, taskType: 'hatching', dueDate: hatchingDate });
                }
                if ((!state.breedingSettings.showOverdueTasks && ringingDate < today) ? false : (ringingDate <= futureLimitDate && !pair.notifiedForRinging)) {
                    tasks.push({ text: "Time to Ring Youngsters", details: pairName, id: pair.id, taskType: 'ringing', dueDate: ringingDate });
                }
            });

            tasks.sort((a, b) => a.dueDate - b.dueDate);

            if (tasks.length > 0) {
                container.style.display = 'block';
                tasks.forEach(task => {
                    const li = document.createElement('li');
                    li.className = 'notification-item';
                    li.dataset.id = task.id;
                    li.dataset.task = task.taskType;
                    const dueDateString = task.dueDate.toISOString().split('T')[0];
                    li.innerHTML = `
                        <div>
                            <div class="notification-item-text">${task.text}</div>
                            <div class="notification-item-details">${task.details} <br> <strong>Due: ${this.formatDate(dueDateString)}</strong></div>
                        </div>
                        <div class="notification-item-actions">
                            <button class="notification-btn" data-action="view-pair-notif">View</button>
                            <button class="notification-btn" data-action="dismiss-notif">Dismiss</button>
                        </div>
                    `;
                    list.appendChild(li);
                });
            } else {
                container.style.display = 'none';
            }
        },
    };

    // =================================================================================
    // EVENT LISTENERS & HANDLERS
    // =================================================================================
    const eventManager = {
        init: function() {
            // Navigation
            document.querySelector('nav ul').addEventListener('click', this.handleNavClick);
            document.querySelector('.dashboard-stats').addEventListener('click', this.handleDashboardCardClick);
            
            // Main Action Buttons
            document.getElementById('add-pigeon-btn').addEventListener('click', () => this.openPigeonModal());
            document.getElementById('add-pair-btn').addEventListener('click', () => this.openBreedingModal());
            document.getElementById('add-health-record-btn').addEventListener('click', () => this.openHealthModal());

            // Form Submissions
            document.getElementById('pigeon-form').addEventListener('submit', this.handleSavePigeon);
            document.getElementById('breeding-form').addEventListener('submit', this.handleSaveBreedingPair);
            document.getElementById('health-form').addEventListener('submit', this.handleSaveHealthRecord);
            document.getElementById('loft-info-form').addEventListener('submit', this.handleSaveLoftInfo);
            document.getElementById('breeding-settings-form').addEventListener('submit', this.handleSaveBreedingSettings);

            // Modal Closures
            document.querySelectorAll('.modal').forEach(modal => {
                modal.addEventListener('click', e => {
                    if (e.target === modal || e.target.classList.contains('close-modal') || e.target.classList.contains('cancel-btn')) {
                        uiManager.closeModal(modal.id);
                    }
                });
            });

            // Table Event Delegation (The new, better way!)
            document.getElementById('pigeons-table').addEventListener('click', this.handlePigeonTableClick.bind(this));
            document.getElementById('pairs-table').addEventListener('click', this.handleBreedingTableClick.bind(this));
            document.getElementById('health-table').addEventListener('click', this.handleHealthTableClick.bind(this));
            document.getElementById('notification-list').addEventListener('click', this.handleNotificationClick.bind(this));

            // Lightbox closing events
            document.querySelector('.close-lightbox').addEventListener('click', () => uiManager.closeModal('image-lightbox-modal'));
            document.getElementById('image-lightbox-modal').addEventListener('click', (e) => {
                if (e.target.id === 'image-lightbox-modal') {
                    uiManager.closeModal('image-lightbox-modal');
                }
            });

            // Other UI interactions
            document.getElementById('search-pigeons').addEventListener('input', e => this.filterPigeons(e.target.value));
            document.querySelectorAll('[data-report]').forEach(btn => btn.addEventListener('click', (e) => this.generateReport(e.target.dataset.report)));
            document.getElementById('print-report-btn').addEventListener('click', () => window.print());
            document.getElementById('theme-toggle').addEventListener('change', this.handleThemeToggle);
            document.querySelector('#pigeons-table thead').addEventListener('click', this.handleSortClick);
            
            // Data Management
            document.getElementById('export-data').addEventListener('click', this.exportData);
            document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-file-input').click());
            document.getElementById('import-file-input').addEventListener('change', this.importData);
            document.getElementById('clear-data').addEventListener('click', this.clearAllData);

            // Backup Prompts
            document.getElementById('backup-now-btn').addEventListener('click', this.exportData);
            document.getElementById('import-from-prompt-btn').addEventListener('click', () => {
                document.getElementById('import-file-input').click();
                this.dismissImportPrompt();
            });
            document.getElementById('dismiss-import-prompt-btn').addEventListener('click', this.dismissImportPrompt);
            
            // Dynamic form fields
            const dateCalcIds = ['first-egg-date', 'activation-days', 'hatching-days', 'ring-days'];
            dateCalcIds.forEach(id => document.getElementById(id)?.addEventListener('input', () => uiManager.updateCalculatedDates()));

            // Browser unload warning
            window.addEventListener('beforeunload', e => {
                if (state.dataHasChanged) { e.preventDefault(); e.returnValue = ''; }
            });
        },

        // Event Handlers (the functions that do the work)
        handleNavClick: (e) => {
            const tab = e.target.closest('li[role="tab"]');
            if (tab) uiManager.switchView(tab.dataset.view);
        },

        handleDashboardCardClick: (e) => {
            const card = e.target.closest('.stat-card');
            if (card && card.dataset.view) {
                uiManager.switchView(card.dataset.view);
            }
        },

        // --- MODAL OPENERS ---
        openPigeonModal: function(pigeon = null) {
            state.currentEditing.pigeon = pigeon;
            const form = document.getElementById('pigeon-form');
            form.reset();
            document.getElementById('pigeon-modal-title').textContent = pigeon ? 'Edit Pigeon' : 'Add New Pigeon';
            
            this.populateParentSelects(pigeon ? pigeon.id : null);
            if (pigeon) {
                Object.keys(pigeon).forEach(key => {
                    const el = form.elements[key.replace(/([A-Z])/g, '-$1').toLowerCase()];
                    if (el) el.value = pigeon[key] || '';
                });
                form.elements['sire-select'].value = pigeon.sireId || '';
                form.elements['dam-select'].value = pigeon.damId || '';
            }
            uiManager.openModal('pigeon-modal');
        },
        openBreedingModal: function(pair = null) {
            state.currentEditing.pair = pair;
            const form = document.getElementById('breeding-form');
            form.reset();
            document.getElementById('breeding-modal-title').textContent = pair ? 'Edit Breeding Pair' : 'Add Breeding Pair';

            this.populateBreedingSelects();
            // Set defaults from settings before populating
            form.elements['activation-days'].value = state.breedingSettings.eggCheckDays;
            form.elements['hatching-days'].value = state.breedingSettings.hatchingDays;
            form.elements['ring-days'].value = state.breedingSettings.ringingDays;
            
            if (pair) {
                Object.keys(pair).forEach(key => {
                    let elId;
                    // Map data keys to form element IDs
                    const keyMap = {
                        cockId: 'cock-select',
                        henId: 'hen-select',
                        eggsLaid: 'eggs-laid' // map 'eggsLaid' data to 'eggs-laid' input
                    };
                    elId = keyMap[key] || key.replace(/([A-Z])/g, '-$1').toLowerCase();
                    
                    const el = form.elements[elId];
                    if (el) el.value = pair[key] || '';
                });
            }
            uiManager.updateCalculatedDates();
            uiManager.openModal('breeding-modal');
        },
        openHealthModal: function(record = null) {
            state.currentEditing.health = record;
            const form = document.getElementById('health-form');
            form.reset();
            document.getElementById('health-modal-title').textContent = record ? 'Edit Health Record' : 'Add Health Record';
            
            this.populateAllPigeonSelect('health-pigeon-select');
            if (record) {
                Object.keys(record).forEach(key => {
                    const el = form.elements[key.replace(/([A-Z])/g, '-$1').toLowerCase()];
                    if (el) el.value = record[key] || '';
                });
            }
            uiManager.openModal('health-modal');
        },

        // --- SAVE HANDLERS ---
        handleSavePigeon: (e) => {
            e.preventDefault();
            const form = e.target;
            const bandNumber = form.elements['band-number'].value.trim();
            const gender = form.elements['gender'].value;
            if (!bandNumber || !gender) {
                uiManager.showMessage('Band Number and Gender are required.', 'error');
                return;
            }
            
            const pigeonData = {
                id: state.currentEditing.pigeon ? state.currentEditing.pigeon.id : Date.now(),
                bandNumber, gender,
                name: form.elements['pigeon-name'].value.trim(),
                color: form.elements['color'].value.trim(),
                hatchDate: form.elements['hatch-date'].value,
                strain: form.elements['strain'].value.trim(),
                sireId: form.elements['sire-select'].value || '',
                damId: form.elements['dam-select'].value || '',
                status: form.elements['status'].value,
                section: form.elements['section'].value.trim(),
                imageURL: form.elements['image-url'].value.trim(),
                notes: form.elements['notes'].value.trim()
            };

            if (state.currentEditing.pigeon) {
                const index = state.pigeons.findIndex(p => p.id === pigeonData.id);
                state.pigeons[index] = pigeonData;
            } else {
                state.pigeons.push(pigeonData);
            }
            
            eventManager.sortAndRedrawPigeons();
            dataManager.saveAllData();
            uiManager.closeModal('pigeon-modal');
            uiManager.showMessage(`Pigeon ${state.currentEditing.pigeon ? 'updated' : 'added'}!`, 'success');
        },
        handleSaveBreedingPair: (e) => {
            e.preventDefault();
            const form = e.target;
            const cockId = form.elements['cock-select'].value;
            const henId = form.elements['hen-select'].value;

            if (!cockId || !henId) {
                uiManager.showMessage('Please select both a Cock and a Hen.', 'error');
                return;
            }
            
            const pairData = {
                id: state.currentEditing.pair ? state.currentEditing.pair.id : Date.now(),
                cockId, henId,
                nestBox: form.elements['nest-box'].value,
                pairingDate: form.elements['pairing-date'].value,
                status: form.elements['pair-status'].value,
                firstEggDate: form.elements['first-egg-date'].value,
                eggsLaid: form.elements['eggs-laid'].value,
                activatedEggs: form.elements['activated-eggs'].value,
                hatchedEggs: form.elements['hatched-eggs'].value,
                notes: form.elements['pair-notes'].value,
                // Preserve notification status on edit
                notifiedForEggCheck: state.currentEditing.pair ? state.currentEditing.pair.notifiedForEggCheck : false,
                notifiedForHatching: state.currentEditing.pair ? state.currentEditing.pair.notifiedForHatching : false,
                notifiedForRinging: state.currentEditing.pair ? state.currentEditing.pair.notifiedForRinging : false,
            };

            if (state.currentEditing.pair) {
                const index = state.breedingPairs.findIndex(p => p.id === pairData.id);
                state.breedingPairs[index] = pairData;
            } else {
                state.breedingPairs.push(pairData);
            }

            uiManager.updateBreedingTable();
            dataManager.saveAllData();
            uiManager.checkForUpcomingTasks();
            uiManager.closeModal('breeding-modal');
            uiManager.showMessage(`Breeding pair ${state.currentEditing.pair ? 'updated' : 'added'}!`, 'success');
        },
        handleSaveHealthRecord: (e) => {
            e.preventDefault();
            const form = e.target;
            const pigeonId = form.elements['health-pigeon-select'].value;
            const date = form.elements['health-date'].value;
            const type = form.elements['health-type'].value;

            if (!pigeonId || !date || !type) {
                uiManager.showMessage('Pigeon, Date, and Type are required.', 'error');
                return;
            }
            
            const recordData = {
                id: state.currentEditing.health ? state.currentEditing.health.id : Date.now(),
                pigeonId, date, type,
                description: form.elements['health-description'].value,
                treatment: form.elements['health-treatment'].value
            };
            
            if (state.currentEditing.health) {
                const index = state.healthRecords.findIndex(r => r.id === recordData.id);
                state.healthRecords[index] = recordData;
            } else {
                state.healthRecords.push(recordData);
            }
            
            uiManager.updateHealthTable();
            dataManager.saveAllData();
            uiManager.closeModal('health-modal');
            uiManager.showMessage(`Health record ${state.currentEditing.health ? 'updated' : 'added'}.`, 'success');
        },
        handleSaveLoftInfo: (e) => {
            e.preventDefault();
            state.loftInfo = {
                name: document.getElementById('loft-name').value,
                owner: document.getElementById('owner-name').value,
                location: document.getElementById('location').value
            };
            dataManager.saveAllData();
            uiManager.showMessage('Loft information saved!', 'success');
        },
        handleSaveBreedingSettings: (e) => {
            e.preventDefault();
            state.breedingSettings = {
                notificationsEnabled: document.getElementById('notifications-enabled').checked,
                notificationWindow: parseInt(document.getElementById('notification-window').value) || 5,
                showOverdueTasks: document.getElementById('show-overdue-tasks').checked,
                eggCheckDays: parseInt(document.getElementById('egg-check-days').value) || 8,
                hatchingDays: parseInt(document.getElementById('hatching-days').value) || 20,
                ringingDays: parseInt(document.getElementById('ringing-days').value) || 28,
            };
            dataManager.saveAllData();
            uiManager.checkForUpcomingTasks();
            uiManager.showMessage('Breeding settings saved!', 'success');
        },
        
        // --- TABLE CLICK HANDLERS (EVENT DELEGATION) ---
        handlePigeonTableClick: function(e) {
            // Check if a thumbnail image was clicked
            if (e.target.classList.contains('pigeon-thumbnail')) {
                const lightbox = document.getElementById('image-lightbox-modal');
                const lightboxImg = document.getElementById('lightbox-image');
                lightboxImg.src = e.target.src;
                uiManager.openModal('image-lightbox-modal');
                return; // Stop further execution
            }

            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const row = button.closest('tr');
            const pigeonId = parseInt(row.dataset.id);
            const action = button.dataset.action;

            if (action === 'pedigree-pigeon') {
                this.showPedigree(pigeonId);
            } else if (action === 'edit-pigeon') {
                const pigeonToEdit = dataManager.findPigeon(pigeonId);
                if (pigeonToEdit) this.openPigeonModal(pigeonToEdit);
                } else if (action === 'delete-pigeon') {
                    if (confirm('Are you sure? This action cannot be undone.')) {
                        state.pigeons = state.pigeons.filter(p => p.id !== pigeonId);
                        eventManager.sortAndRedrawPigeons();
                        dataManager.saveAllData();
                        uiManager.showMessage('Pigeon deleted.', 'success');
                    }
                }
        },
        handleBreedingTableClick: function(e) {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const row = button.closest('tr');
            const pairId = parseInt(row.dataset.id);
            const action = button.dataset.action;

            if (action === 'view-offspring') {
                this.showOffspring(pairId);
            } else if (action === 'edit-pair') {
                const pairToEdit = dataManager.findPair(pairId);
                if (pairToEdit) this.openBreedingModal(pairToEdit);
            } else if (action === 'delete-pair') {
                if (confirm('Are you sure?')) {
                    state.breedingPairs = state.breedingPairs.filter(p => p.id !== pairId);
                    uiManager.updateBreedingTable();
                    dataManager.saveAllData();
                    uiManager.checkForUpcomingTasks();
                    uiManager.showMessage('Breeding pair deleted.', 'success');
                }
            }
        },
        handleHealthTableClick: function(e) {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const row = button.closest('tr');
            const recordId = parseInt(row.dataset.id);
            const action = button.dataset.action;

            if (action === 'edit-health') {
                const recordToEdit = dataManager.findHealthRecord(recordId);
                if (recordToEdit) this.openHealthModal(recordToEdit);
            } else if (action === 'delete-health') {
                if (confirm('Are you sure?')) {
                    state.healthRecords = state.healthRecords.filter(r => r.id !== recordId);
                    uiManager.updateHealthTable();
                    dataManager.saveAllData();
                    uiManager.showMessage('Health record deleted.', 'success');
                }
            }
        },
        handleNotificationClick: function(e) {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const item = button.closest('.notification-item');
            const pairId = parseInt(item.dataset.id);
            const taskType = item.dataset.task;
            const action = button.dataset.action;
            const pair = dataManager.findPair(pairId);
            if (!pair) return;

            if (action === 'view-pair-notif') {
                this.openBreedingModal(pair);
            } else if (action === 'dismiss-notif') {
                if (taskType === 'eggCheck') pair.notifiedForEggCheck = true;
                if (taskType === 'hatching') pair.notifiedForHatching = true;
                if (taskType === 'ringing') pair.notifiedForRinging = true;
                dataManager.saveAllData();
                uiManager.checkForUpcomingTasks();
            }
        },

        // --- OTHER HANDLERS ---
        handleThemeToggle: (e) => {
            const isDark = e.target.checked;
            document.body.classList.toggle('dark-mode', isDark);
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        },
        filterPigeons: (term) => {
            const lowerTerm = term.toLowerCase();
            document.querySelectorAll('#pigeons-table tbody tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(lowerTerm) ? '' : 'none';
            });
        },
        handleSortClick: function(e) {
            const header = e.target.closest('th[data-sort]');
            if (!header) return;
            const column = header.dataset.sort;

            if (state.currentSort.column === column) {
                state.currentSort.direction = state.currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.currentSort.column = column;
                state.currentSort.direction = 'asc';
            }
            eventManager.sortAndRedrawPigeons();
        },
        sortAndRedrawPigeons: () => {
            const { column, direction } = state.currentSort;
            const dir = direction === 'asc' ? 1 : -1;
            state.pigeons.sort((a, b) => {
                let valA = a[column]; let valB = b[column];
                if (column === 'hatchDate') { 
                    if (!valA) return 1; if (!valB) return -1; 
                    return (new Date(valA) - new Date(valB)) * dir;
                }
                valA = (valA || '').toString(); valB = (valB || '').toString();
                return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * dir;
            });
            uiManager.updatePigeonTable();
        },
        
        // --- DATA MANAGEMENT HANDLERS ---
        exportData: () => {
            const dataToExport = {
                pigeons: state.pigeons,
                breedingPairs: state.breedingPairs,
                healthRecords: state.healthRecords,
                loftInfo: state.loftInfo,
                breedingSettings: state.breedingSettings,
            };
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `haute-voliere-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            state.dataHasChanged = false;
            localStorage.setItem('backupPerformed', 'true');
            uiManager.updateBackupPrompt();
            uiManager.showMessage('Backup file downloaded!', 'success');
        },
        importData: (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                if (confirm('Are you sure? Importing will overwrite all current data.')) {
                    try {
                        const imported = JSON.parse(e.target.result);
                        if (imported.pigeons && imported.breedingPairs && imported.healthRecords) {
                            // Overwrite state with imported data
                            state.pigeons = imported.pigeons;
                            state.breedingPairs = imported.breedingPairs;
                            state.healthRecords = imported.healthRecords;
                            state.loftInfo = imported.loftInfo || {};
                            if (imported.breedingSettings) state.breedingSettings = imported.breedingSettings;
                            
                            // THIS IS THE FIX: Save the newly loaded data to storage BEFORE re-initializing.
                            dataManager.saveAllData(); 
                            
                            state.dataHasChanged = false;
                            localStorage.removeItem('backupPerformed');
                            app.init(); // Re-initialize the whole app with new data
                            uiManager.showMessage('Data imported successfully!', 'success');
                        } else {
                            uiManager.showMessage('Invalid or corrupted backup file.', 'error');
                        }
                    } catch (err) {
                        uiManager.showMessage('Failed to parse backup file. Must be a valid JSON.', 'error');
                    }
                }
            };
            reader.readAsText(file);
            event.target.value = null; // Reset file input
        },
        clearAllData: () => {
             if (confirm('ARE YOU SURE? This will delete ALL data and cannot be undone.')) {
                const savedTheme = localStorage.getItem('theme');
                localStorage.clear();
                if (savedTheme) localStorage.setItem('theme', savedTheme);
                app.init(); // Re-initialize app with default/empty data
                uiManager.showMessage('All data has been cleared.', 'success');
            }
        },
        dismissImportPrompt: () => {
            document.getElementById('import-prompt').classList.remove('visible');
            localStorage.removeItem('backupPerformed');
        },
        
        // --- HELPER/UTILITY FUNCTIONS for event handlers ---
        populateParentSelects: (currentPigeonId = null) => {
            const sireSelect = document.getElementById('sire-select');
            const damSelect = document.getElementById('dam-select');
            sireSelect.innerHTML = '<option value="">Select Sire</option>';
            damSelect.innerHTML = '<option value="">Select Dam</option>';
            state.pigeons.forEach(p => {
                if (p.id === currentPigeonId) return;
                const option = `<option value="${p.id}">${p.bandNumber} - ${p.name || 'Unnamed'}</option>`;
                if (p.gender === 'cock') sireSelect.innerHTML += option;
                else if (p.gender === 'hen') damSelect.innerHTML += option;
            });
        },
        populateBreedingSelects: () => {
            const cockSelect = document.getElementById('cock-select');
            const henSelect = document.getElementById('hen-select');
            cockSelect.innerHTML = '<option value="">Select Cock</option>';
            henSelect.innerHTML = '<option value="">Select Hen</option>';
            state.pigeons.forEach(p => {
                const option = `<option value="${p.id}">${p.bandNumber} - ${p.name || 'Unnamed'}</option>`;
                if (p.gender === 'cock') cockSelect.innerHTML += option;
                else if (p.gender === 'hen') henSelect.innerHTML += option;
            });
        },
        populateAllPigeonSelect: (selectId) => {
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Select a Pigeon</option>';
            state.pigeons.forEach(p => {
                select.innerHTML += `<option value="${p.id}">${p.bandNumber} - ${p.name || 'Unnamed'}</option>`;
            });
        },
        
        // --- REPORT GENERATION ---
        generateReport: (type) => {
            const contentDiv = document.getElementById('report-content');
            const titleEl = document.getElementById('report-modal-title');
            let content = '', title = '';

            if (type === 'inventory') {
                title = 'Pigeon Inventory Report';
                let body = state.pigeons.map(p => `<tr><td><span>${p.bandNumber}</span></td><td><span>${p.name||'-'}</span></td><td><span>${p.gender}</span></td><td><span>${uiManager.formatDate(p.hatchDate)}</span></td><td><span>${p.strain||'-'}</span></td><td><span class="status-badge status-${p.status}">${p.status}</span></td></tr>`).join('');
                content = `<h3>Total Pigeons: ${state.pigeons.length}</h3><table><thead><tr><th>Band #</th><th>Name</th><th>Gender</th><th>Hatch Date</th><th>Strain</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
            } else if (type === 'breeding') {
                title = 'Breeding Summary Report';
                const totalEggs = state.breedingPairs.reduce((sum, p) => sum + parseInt(p.activatedEggs||0), 0);
                const totalHatched = state.breedingPairs.reduce((sum, p) => sum + parseInt(p.hatchedEggs||0), 0);
                const hatchRate = totalEggs > 0 ? ((totalHatched / totalEggs) * 100).toFixed(1) : 0;
                let body = state.breedingPairs.map(p => {
                    const cock = dataManager.findPigeon(parseInt(p.cockId)); 
                    const hen = dataManager.findPigeon(parseInt(p.henId));
                    return `<tr><td><span>BP-${String(p.id).slice(-4)}</span></td><td><span>${cock?cock.bandNumber:'N/A'}</span></td><td><span>${hen?hen.bandNumber:'N/A'}</span></td><td><span>${p.activatedEggs||0}</span></td><td><span>${p.hatchedEggs||0}</span></td></tr>`;
                }).join('');
                content = `<h3>Summary</h3><p>Total Pairs: ${state.breedingPairs.length} | Total Eggs Laid: ${totalEggs} | Total Hatched: ${totalHatched} | Hatch Rate: ${hatchRate}%</p><h4>Details</h4><table><thead><tr><th>Pair ID</th><th>Cock</th><th>Hen</th><th>Eggs Laid</th><th>Hatched</th></tr></thead><tbody>${body}</tbody></table>`;
            } else if (type === 'health') {
                title = 'Health Summary Report';
                const recordsByPigeon = state.healthRecords.reduce((acc, rec) => { (acc[rec.pigeonId] = acc[rec.pigeonId]||[]).push(rec); return acc; }, {});
                if (Object.keys(recordsByPigeon).length === 0) { 
                    content = '<p>No health records found.</p>'; 
                } else {
                    content = Object.keys(recordsByPigeon).map(pigeonId => {
                        const pigeon = dataManager.findPigeon(parseInt(pigeonId));
                        let body = recordsByPigeon[pigeonId]
                            .sort((a,b) => new Date(b.date) - new Date(a.date))
                            .map(rec => `<tr><td><span>${uiManager.formatDate(rec.date)}</span></td><td><span>${rec.type}</span></td><td><span>${rec.description||'-'}</span></td><td><span>${rec.treatment||'-'}</span></td></tr>`)
                            .join('');
                        return `<h4>Pigeon: ${pigeon?pigeon.bandNumber:'Unknown'} (${pigeon?pigeon.name||'Unnamed':''})</h4><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Treatment</th></tr></thead><tbody>${body}</tbody></table>`;
                    }).join('');
                }
            }
            titleEl.textContent = title; 
            contentDiv.innerHTML = content; 
            uiManager.makeTablesResponsive();
            uiManager.openModal('report-modal');
        },

        showPedigree: function(pigeonId) {
            const container = document.getElementById('pedigree-chart-container');
            const find = (id) => id ? dataManager.findPigeon(parseInt(id)) : null;

            const mainPigeon = find(pigeonId);
            if (!mainPigeon) {
                container.innerHTML = '<p>Pigeon not found.</p>';
                uiManager.openModal('pedigree-modal');
                return;
            }
            
            document.querySelector('#pedigree-modal-title').textContent = `3-Generation Pedigree for ${mainPigeon.bandNumber}`;

            const getPigeonData = (pigeon) => {
                if (!pigeon) return { band: 'Unknown', name: '', gender: '' };
                const genderIcon = pigeon.gender === 'cock' ? 'mars' : pigeon.gender === 'hen' ? 'venus' : 'question';
                return {
                    band: pigeon.bandNumber,
                    name: pigeon.name || 'Unnamed',
                    gender: `<i class="fas fa-${genderIcon}"></i>`
                };
            };

            const sire = find(mainPigeon.sireId);
            const dam = find(mainPigeon.damId);

            const p_sire = getPigeonData(sire);
            const p_dam = getPigeonData(dam);

            const g_sire_s = sire ? getPigeonData(find(sire.sireId)) : getPigeonData(null);
            const g_dam_s = sire ? getPigeonData(find(sire.damId)) : getPigeonData(null);
            const g_sire_d = dam ? getPigeonData(find(dam.sireId)) : getPigeonData(null);
            const g_dam_d = dam ? getPigeonData(find(dam.damId)) : getPigeonData(null);

            container.innerHTML = `
                <div class="pedigree-grid">
                    <!-- Generation 0 -->
                    <div class="ped-pigeon gen0"><div>${getPigeonData(mainPigeon).band} ${getPigeonData(mainPigeon).gender}<br><small>${getPigeonData(mainPigeon).name}</small></div></div>

                    <!-- Generation 1 -->
                    <div class="ped-pigeon gen1 top"><div>${p_sire.band} ${p_sire.gender}<br><small>${p_sire.name}</small></div></div>
                    <div class="ped-pigeon gen1 bottom"><div>${p_dam.band} ${p_dam.gender}<br><small>${p_dam.name}</small></div></div>

                    <!-- Generation 2 -->
                    <div class="ped-pigeon gen2 p1"><div>${g_sire_s.band} ${g_sire_s.gender}<br><small>${g_sire_s.name}</small></div></div>
                    <div class="ped-pigeon gen2 p2"><div>${g_dam_s.band} ${g_dam_s.gender}<br><small>${g_dam_s.name}</small></div></div>
                    <div class="ped-pigeon gen2 p3"><div>${g_sire_d.band} ${g_sire_d.gender}<br><small>${g_sire_d.name}</small></div></div>
                    <div class="ped-pigeon gen2 p4"><div>${g_dam_d.band} ${g_dam_d.gender}<br><small>${g_dam_d.name}</small></div></div>

                    <!-- Connectors -->
                    <div class="connector c-g1-top"></div>
                    <div class="connector c-g1-bottom"></div>
                    <div class="connector c-g1-h"></div>
                    
                    <div class="connector c-g2-p1"></div>
                    <div class="connector c-g2-p2"></div>
                    <div class="connector c-g2-h1"></div>

                    <div class="connector c-g2-p3"></div>
                    <div class="connector c-g2-p4"></div>
                    <div class="connector c-g2-h2"></div>
                </div>
            `;
            uiManager.openModal('pedigree-modal');
        },

        showOffspring: function(pairId) {
            const container = document.getElementById('offspring-list-container');
            const titleEl = document.getElementById('offspring-modal-title');

            const pair = dataManager.findPair(pairId);
            if (!pair) return;

            const cock = dataManager.findPigeon(parseInt(pair.cockId));
            const hen = dataManager.findPigeon(parseInt(pair.henId));
            
            titleEl.textContent = `Offspring of ${cock ? cock.bandNumber : 'N/A'} & ${hen ? hen.bandNumber : 'N/A'}`;

            const offspring = state.pigeons.filter(p => p.sireId == pair.cockId && p.damId == pair.henId);

            if (offspring.length === 0) {
                container.innerHTML = '<p>No offspring recorded for this pair.</p>';
            } else {
                let tableHTML = `
                    <table id="offspring-table">
                        <thead>
                            <tr>
                                <th>Band #</th>
                                <th>Name</th>
                                <th>Gender</th>
                                <th>Hatch Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${offspring.map(child => `
                                <tr>
                                    <td><span>${child.bandNumber}</span></td>
                                    <td><span>${child.name || '-'}</span></td>
                                    <td><span>${child.gender}</span></td>
                                    <td><span>${uiManager.formatDate(child.hatchDate)}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
                container.innerHTML = tableHTML;
            }

            uiManager.openModal('offspring-modal');
        }
    };

    // =================================================================================
    // APPLICATION INITIALIZATION
    // =================================================================================
    const app = {
        init: function() {
            dataManager.loadAllData();
            eventManager.init();
            uiManager.updateAll();
            eventManager.sortAndRedrawPigeons();
            uiManager.updateBackupPrompt();
            document.getElementById('import-prompt').classList.toggle('visible', localStorage.getItem('backupPerformed') === 'true');
            uiManager.switchView('dashboard');
        }
    };
    
    // Start the application!
    app.init();

});