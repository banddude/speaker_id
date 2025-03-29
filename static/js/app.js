// Combined JavaScript for merged Speaker ID application

// ============= COMMON FUNCTIONS =============
function showToast(type, title, message, duration = 3000) {
    const toastContainer = document.querySelector('.toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    toast.innerHTML = `
        <div class="toast-icon ${type}">
            ${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">×</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger reflow to enable transition
    toast.offsetHeight;
    toast.classList.add('active');
    
    const closeButton = toast.querySelector('.toast-close');
    closeButton.addEventListener('click', () => {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function formatDuration(ms) {
    // Handle invalid input
    if (isNaN(ms) || ms === null || ms === undefined) {
        return "0:00";
    }
    
    // Convert to seconds for more accurate calculation
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    // Format with leading zeros
    const formattedHours = hours > 0 ? `${hours}:` : '';
    const formattedMinutes = minutes % 60 < 10 && hours > 0 ? 
        `0${minutes % 60}:` : `${minutes % 60}:`;
    const formattedSeconds = seconds % 60 < 10 ? 
        `0${seconds % 60}` : `${seconds % 60}`;
    
    return `${formattedHours}${formattedMinutes}${formattedSeconds}`;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// ============= DASHBOARD FUNCTIONALITY =============
let currentView = 'conversations';
let currentConversation = null;
let speakers = [];

// Add function for initializing threshold sliders
function initThresholdSliders() {
    const matchThresholdSlider = document.getElementById('match-threshold');
    const autoUpdateThresholdSlider = document.getElementById('auto-update-threshold');
    const matchThresholdValue = document.getElementById('match-threshold-value');
    const autoUpdateThresholdValue = document.getElementById('auto-update-threshold-value');
    
    if (matchThresholdSlider && matchThresholdValue) {
        // Set initial display value
        matchThresholdValue.textContent = matchThresholdSlider.value;
        
        // Update value display when slider changes
        matchThresholdSlider.addEventListener('input', () => {
            matchThresholdValue.textContent = matchThresholdSlider.value;
        });
    }
    
    if (autoUpdateThresholdSlider && autoUpdateThresholdValue) {
        // Set initial display value
        autoUpdateThresholdValue.textContent = autoUpdateThresholdSlider.value;
        
        // Update value display when slider changes
        autoUpdateThresholdSlider.addEventListener('input', () => {
            autoUpdateThresholdValue.textContent = autoUpdateThresholdSlider.value;
        });
    }
}

// Initialize DOM elements and event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize navigation
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            changeView(view);
        });
    });
    
    // Initialize upload form
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
    
    const fileInput = document.getElementById('audio-file');
    if (fileInput) {
        fileInput.addEventListener('change', updateFileName);
    }
    
    // Initialize threshold sliders
    initThresholdSliders();
    
    // Load initial data
    loadConversations();
    loadSpeakers();
    
    // Initialize Pinecone manager if available
    initPineconeManager();
    
    // Default to conversations view
    changeView('conversations');
});

function changeView(view) {
    // Update navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.dataset.view === view) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update views
    const views = document.querySelectorAll('.view');
    views.forEach(v => {
        if (v.id === `${view}-view`) {
            v.classList.add('active');
        } else {
            v.classList.remove('active');
        }
    });
    
    currentView = view;
    
    // Initialize specific view functionality
    if (view === 'pinecone') {
        // Initialize Pinecone Manager forms
        const addSpeakerForm = document.getElementById('add-speaker-form');
        if (addSpeakerForm) {
            // Remove existing listeners to prevent duplicates
            const newAddSpeakerForm = addSpeakerForm.cloneNode(true);
            addSpeakerForm.parentNode.replaceChild(newAddSpeakerForm, addSpeakerForm);
            newAddSpeakerForm.addEventListener('submit', handleAddSpeaker);
        }
        
        const addEmbeddingForm = document.getElementById('add-embedding-form');
        if (addEmbeddingForm) {
            // Remove existing listeners to prevent duplicates
            const newAddEmbeddingForm = addEmbeddingForm.cloneNode(true);
            addEmbeddingForm.parentNode.replaceChild(newAddEmbeddingForm, addEmbeddingForm);
            newAddEmbeddingForm.addEventListener('submit', handleAddEmbedding);
        }
        
        // Show add speaker section and hide add embedding section by default
        const addSpeakerSection = document.getElementById('add-speaker-section');
        const addEmbeddingSection = document.getElementById('add-embedding-section');
        if (addSpeakerSection) addSpeakerSection.style.display = 'block';
        if (addEmbeddingSection) addEmbeddingSection.style.display = 'none';
        
        // Load Pinecone speakers
        loadPineconeSpeakers();
    }
}

async function loadConversations() {
    const conversationsContainer = document.getElementById('conversations-list');
    if (!conversationsContainer) return;
    
    conversationsContainer.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
    
    try {
        // First, make sure we have the speakers loaded globally
        if (!speakers || speakers.length === 0) {
            console.log('Loading speakers first...');
            try {
                const speakersResponse = await fetch('/api/speakers');
                if (!speakersResponse.ok) {
                    throw new Error(`Failed to load speakers: ${speakersResponse.status}`);
                }
                speakers = await speakersResponse.json();
                console.log('Speakers loaded:', speakers.length);
            } catch (speakerError) {
                console.error('Error loading speakers:', speakerError);
                // Continue anyway, we'll handle missing speakers gracefully
            }
        }

        const response = await fetch('/api/conversations');
        const conversations = await response.json();
        
        if (conversations.length === 0) {
            conversationsContainer.innerHTML = '<p>No conversations found. Upload an audio file to get started.</p>';
            return;
        }
        
        conversationsContainer.innerHTML = '';
        
        for (const conversation of conversations) {
            const card = document.createElement('div');
            card.className = 'conversation-card';
            card.dataset.id = conversation.id;
            
            const displayName = conversation.display_name || `Conversation ${conversation.id.slice(0, 8)}`;
            
            // Fetch conversation details to get the speaker names
            let speakersList = `${conversation.speaker_count} speakers`;
            try {
                const detailsResponse = await fetch(`/api/conversations/${conversation.id}`);
                if (detailsResponse.ok) {
                    const details = await detailsResponse.json();
                    
                    // Get unique speakers
                    const uniqueSpeakerIds = [...new Set(details.utterances.map(u => u.speaker_id))];
                    const uniqueSpeakers = uniqueSpeakerIds.map(id => {
                        const utterance = details.utterances.find(u => u.speaker_id === id);
                        return utterance ? (utterance.speaker_name || 'Unknown Speaker') : 'Unknown Speaker';
                    }).filter(name => name);
                    
                    if (uniqueSpeakers.length > 0) {
                        speakersList = uniqueSpeakers.join(', ');
                    }
                }
            } catch (error) {
                console.error(`Error fetching details for conversation ${conversation.id}:`, error);
            }
            
            card.innerHTML = `
                <div class="card-header">
                    <h3>${displayName}</h3>
                    <div class="card-actions">
                        <button class="button-icon-only delete" title="Delete conversation">🗑️</button>
                    </div>
                </div>
                <div class="conversation-info">
                    <div class="info-item">
                        <span class="info-label">Date</span>
                        <span class="info-value">${formatDate(conversation.created_at)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Duration</span>
                        <span class="info-value">${formatDuration(conversation.duration * 1000)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Speakers (${conversation.speaker_count})</span>
                        <span class="info-value conversation-speakers">${speakersList}</span>
                    </div>
                </div>
            `;
            
            conversationsContainer.appendChild(card);
            
            // Make the entire card clickable
            card.addEventListener('click', (event) => {
                // Don't trigger if clicking on the delete button
                if (!event.target.closest('.button-icon-only.delete')) {
                viewConversation(conversation.id);
                }
            });
            
            // Add delete button event listener
            const deleteButton = card.querySelector('.button-icon-only.delete');
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent card click
                showDeleteConversationModal(conversation.id, displayName);
            });
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
        conversationsContainer.innerHTML = `<p class="error-message">Error loading conversations: ${error.message}</p>`;
        showToast('error', 'Error', `Failed to load conversations: ${error.message}`);
    }
}

async function viewConversation(conversationId) {
    try {
        console.log('Loading conversation details for:', conversationId);
        
        // Create a modal to show loading state
        let modal = document.getElementById('conversation-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'conversation-modal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Loading Conversation...</h3>
                    <button class="close-button" onclick="closeModal('conversation-modal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="spinner-container">
                        <div class="spinner"></div>
                        <p>Loading conversation data...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Show the modal
        modal.classList.add('active');
        
        // First, make sure we have the speakers loaded
        if (!speakers || speakers.length === 0) {
            console.log('Loading speakers first...');
            try {
                const speakersResponse = await fetch('/api/speakers');
                if (!speakersResponse.ok) {
                    throw new Error(`Failed to load speakers: ${speakersResponse.status}`);
                }
                speakers = await speakersResponse.json();
                console.log('Speakers loaded:', speakers.length);
            } catch (speakerError) {
                console.error('Error loading speakers:', speakerError);
                // Continue anyway, we'll handle missing speakers gracefully
            }
        }
        
        // Now load the conversation with a timeout for slow connections
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
            // Now load the conversation
            const response = await fetch(`/api/conversations/${conversationId}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
        const conversation = await response.json();
            console.log('Received conversation details:', conversation.id);
        
        currentConversation = conversation;
            showConversationModal();
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Connection Timeout</h3>
                            <button class="close-button" onclick="closeModal('conversation-modal')">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="error-state">
                                <p>The request timed out. This might be due to a slow network connection.</p>
                                <button onclick="viewConversation('${conversationId}')">Try Again</button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                throw fetchError;
            }
        }
    } catch (error) {
        console.error('Error loading conversation details:', error);
        let modal = document.getElementById('conversation-modal');
        if (modal && modal.classList.contains('active')) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Error</h3>
                        <button class="close-button" onclick="closeModal('conversation-modal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="error-state">
                            <p>Failed to load conversation details: ${error.message}</p>
                            <button onclick="viewConversation('${conversationId}')">Try Again</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            showToast('error', 'Error', 'Failed to load conversation details');
        }
    }
}

function showConversationModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('conversation-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'conversation-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    // Set conversation title - use display_name if available, otherwise use conversation ID
    const displayTitle = currentConversation.display_name || 
                        `Conversation ${currentConversation.id.slice(-8)}`;
    
    // Get unique speakers
    const uniqueSpeakerIds = [...new Set(currentConversation.utterances.map(u => u.speaker_id))];
    const uniqueSpeakers = uniqueSpeakerIds.map(id => {
        const utterance = currentConversation.utterances.find(u => u.speaker_id === id);
        return utterance ? (utterance.speaker_name || 'Unknown Speaker') : 'Unknown Speaker';
    }).filter(name => name);
    
    // Format speakers list
    const speakersList = uniqueSpeakers.join(', ');
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="title-container">
                    <h3 id="conversation-title" contenteditable="false">${displayTitle}</h3>
                    <button class="edit-text-btn" id="edit-title-btn" onclick="toggleTitleEdit()">✏️</button>
            </div>
                <button class="close-button" onclick="closeModal('conversation-modal')">&times;</button>
                </div>
            <div class="modal-body">
                <div class="conversation-info">
                <div class="info-item">
                    <span class="info-label">Duration</span>
                        <span class="info-value" id="conversation-duration">${formatDuration(currentConversation.duration * 1000)}</span>
                </div>
                <div class="info-item">
                        <span class="info-label">Speakers (${uniqueSpeakers.length})</span>
                        <span class="info-value" id="conversation-speakers">${speakersList}</span>
                </div>
            </div>
                <div class="utterances-list" id="utterances-list"></div>
            </div>
            </div>
        `;
        
    // Show the modal
    modal.classList.add('active');

    // Render utterances
    renderUtterances();
}

function renderUtterances() {
    if (!currentConversation || !currentConversation.utterances) {
        console.error('No conversation or utterances to render');
        return;
    }

    const utterancesList = document.getElementById('utterances-list');
    if (!utterancesList) {
        console.error('Utterances list container not found');
        return;
    }

    // Show loading state
    utterancesList.innerHTML = '<div class="spinner-container"><div class="spinner"></div><p>Loading utterances...</p></div>';

    // Use setTimeout to defer rendering and prevent UI blocking
    setTimeout(() => {
        console.log(`Rendering ${currentConversation.utterances.length} utterances`);
        
        let html = '';
        currentConversation.utterances.forEach(utterance => {
            const audioUrl = `/api/audio/${currentConversation.id}/${utterance.id}`;
            
            // Display time using either formatted time or ms values
            let timeDisplay = '';
            
            // First try to use the formatted start_time and end_time
            if (utterance.start_time && utterance.end_time) {
                timeDisplay = `${utterance.start_time} - ${utterance.end_time}`;
            } 
            // Fall back to using milliseconds if provided
            else if (utterance.start_ms !== undefined && utterance.end_ms !== undefined) {
                timeDisplay = `${formatDuration(utterance.start_ms)} - ${formatDuration(utterance.end_ms)}`;
            }
            // Last resort - show placeholder
            else {
                timeDisplay = "00:00:00 - 00:00:00";
            }
            
            html += `
                <div class="utterance-item" data-utterance-id="${utterance.id}">
                <div class="utterance-header">
                        <div class="speaker-info">
                            <span class="speaker-name" id="speaker-${utterance.id}">${utterance.speaker_name || 'Unknown Speaker'}</span>
                            <button class="edit-speaker-btn" id="edit-speaker-btn-${utterance.id}" onclick="toggleSpeakerEdit('${utterance.id}')">✏️</button>
                            <span class="time">${timeDisplay}</span>
                    </div>
                        <div class="speaker-edit-container" id="speaker-edit-${utterance.id}" style="display: none;">
                            <select class="speaker-select" id="speaker-select-${utterance.id}">
                                ${speakers.map(speaker => `
                                    <option value="${speaker.id}" ${speaker.id === utterance.speaker_id ? 'selected' : ''}>
                                        ${speaker.name}
                                    </option>
                                `).join('')}
                                <option value="new">+ Create New Speaker</option>
                            </select>
                            <div class="new-speaker-input" id="new-speaker-input-${utterance.id}" style="display: none;">
                                <input type="text" id="new-speaker-name-${utterance.id}" placeholder="Enter new speaker name">
                    </div>
                            <div class="apply-all-container">
                                <input type="checkbox" id="apply-all-${utterance.id}" class="apply-all-checkbox">
                                <label for="apply-all-${utterance.id}">Apply to all "${utterance.speaker_name || 'Unknown Speaker'}" utterances</label>
                </div>
                            <button class="save-speaker-btn" onclick="saveSpeakerEdit('${utterance.id}')">✓</button>
                            <button class="cancel-speaker-btn" onclick="cancelSpeakerEdit('${utterance.id}')">✖️</button>
                        </div>
                    </div>
                    <div class="utterance-content">
                        <div class="text-container">
                            <p class="text" id="text-${utterance.id}">${utterance.text || 'No transcription available'}</p>
                            <button class="edit-text-btn" id="edit-text-btn-${utterance.id}" onclick="toggleTextEdit('${utterance.id}')">✏️</button>
                        </div>
                        <div class="audio-container">
                            <audio 
                                class="audio-player" 
                                controls 
                                preload="none"
                                onerror="handleAudioError(this, '${audioUrl}')"
                                onloadedmetadata="handleAudioLoaded(this, '${audioUrl}')"
                                src="${audioUrl}"
                            ></audio>
                        </div>
                    </div>
                </div>
            `;
        });
        
        utterancesList.innerHTML = html;
        
        // Add event listeners to speaker selects
        currentConversation.utterances.forEach(utterance => {
            const speakerSelect = document.getElementById(`speaker-select-${utterance.id}`);
            if (speakerSelect) {
                speakerSelect.addEventListener('change', function() {
                    const newSpeakerInput = document.getElementById(`new-speaker-input-${utterance.id}`);
                    if (this.value === 'new') {
                        newSpeakerInput.style.display = 'block';
                    } else {
                        newSpeakerInput.style.display = 'none';
                    }
                });
            }
        });
    }, 100); // Small delay to allow the UI to update with loading state
}

function toggleSpeakerEdit(utteranceId) {
    const speakerName = document.getElementById(`speaker-${utteranceId}`);
    const speakerEditBtn = document.getElementById(`edit-speaker-btn-${utteranceId}`);
    const speakerEditContainer = document.getElementById(`speaker-edit-${utteranceId}`);
    
    // Show edit container, hide speaker name
    speakerName.style.display = 'none';
    speakerEditBtn.style.display = 'none';
    speakerEditContainer.style.display = 'flex';
}

function cancelSpeakerEdit(utteranceId) {
    const speakerName = document.getElementById(`speaker-${utteranceId}`);
    const speakerEditBtn = document.getElementById(`edit-speaker-btn-${utteranceId}`);
    const speakerEditContainer = document.getElementById(`speaker-edit-${utteranceId}`);
    const newSpeakerInput = document.getElementById(`new-speaker-input-${utteranceId}`);
    
    // Hide edit container, show speaker name
    speakerName.style.display = 'inline';
    speakerEditBtn.style.display = 'inline';
    speakerEditContainer.style.display = 'none';
    newSpeakerInput.style.display = 'none';
    
    // Reset select value to current speaker
    const utterance = currentConversation.utterances.find(u => u.id === utteranceId);
    if (utterance) {
        const speakerSelect = document.getElementById(`speaker-select-${utteranceId}`);
        speakerSelect.value = utterance.speaker_id;
    }
}

async function saveSpeakerEdit(utteranceId) {
    const speakerSelect = document.getElementById(`speaker-select-${utteranceId}`);
    const newSpeakerInput = document.getElementById(`new-speaker-name-${utteranceId}`);
    const applyAllCheckbox = document.getElementById(`apply-all-${utteranceId}`);
    const speakerValue = speakerSelect.value;
    
    console.log(`Starting speaker edit for utterance ${utteranceId}, selected value: ${speakerValue}`);
    
    // Disable buttons during save
    const saveBtn = document.querySelector(`[onclick="saveSpeakerEdit('${utteranceId}')"]`);
    const cancelBtn = document.querySelector(`[onclick="cancelSpeakerEdit('${utteranceId}')"]`);
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.textContent = '⏳';
    
    try {
        let speakerId = speakerValue;
        let speakerName = speakerSelect.options[speakerSelect.selectedIndex].text;
        
        // If creating a new speaker
        if (speakerValue === 'new') {
            const newName = newSpeakerInput.value.trim();
            if (!newName) {
                throw new Error('Please enter a name for the new speaker');
            }
            
            console.log(`Creating new speaker: ${newName}`);
            
            // Create new speaker using FormData
            const formData = new FormData();
            formData.append('name', newName);
            
            console.log('Sending request to create speaker');
            
            const createResponse = await fetch('/api/speakers', {
                method: 'POST',
                body: formData
            });
            
            console.log('Create speaker response status:', createResponse.status);
            
            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                console.error('Error response from create speaker:', errorText);
                throw new Error(`Failed to create speaker: ${errorText}`);
            }
            
            const responseText = await createResponse.text();
            console.log('Raw response text:', responseText);
            
            let newSpeaker;
            try {
                newSpeaker = JSON.parse(responseText);
                console.log('Parsed new speaker response:', newSpeaker);
            } catch (e) {
                console.error('Error parsing JSON response:', e);
                throw new Error(`Failed to parse response: ${e.message}`);
            }
            
            if (!newSpeaker.id) {
                console.error('No ID found in response:', newSpeaker);
                throw new Error('No speaker ID returned from server');
            }
            
            speakerId = newSpeaker.id;
            speakerName = newName;
            
            // Add to speakers list
            speakers.push({
                id: speakerId,
                name: speakerName
            });
            
            console.log(`Added new speaker to list. ID: ${speakerId}, Name: ${speakerName}`);
        }
        
        // Get the current utterance to find the old speaker name
        const currentUtterance = currentConversation.utterances.find(u => u.id === utteranceId);
        if (!currentUtterance) {
            throw new Error('Utterance not found');
        }
        
        const oldSpeakerName = currentUtterance.speaker_name || 'Unknown Speaker';
        const applyToAll = applyAllCheckbox && applyAllCheckbox.checked;
        
        console.log(`Updating utterance ${utteranceId} with speaker ID: ${speakerId}, Apply to all: ${applyToAll}`);
        
        // If applying to all utterances with the same speaker name
        if (applyToAll) {
            // Find all utterances with the same speaker name
            const utterancesToUpdate = currentConversation.utterances.filter(u => 
                (u.speaker_name || 'Unknown Speaker') === oldSpeakerName
            );
            
            console.log(`Applying change to ${utterancesToUpdate.length} utterances with speaker name: ${oldSpeakerName}`);
            
            // Update all matching utterances
            const updatePromises = utterancesToUpdate.map(async (utterance) => {
                try {
                    const response = await fetch(`/api/utterances/${utterance.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ speaker_id: speakerId })
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Error updating utterance ${utterance.id}:`, errorText);
                        return false;
                    }
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Update local data
                        utterance.speaker_id = speakerId;
                        utterance.speaker_name = speakerName;
                        return true;
                    } else {
                        console.error(`Failed to update utterance ${utterance.id}:`, result.detail);
                        return false;
                    }
    } catch (error) {
                    console.error(`Error updating utterance ${utterance.id}:`, error);
                    return false;
                }
            });
            
            const results = await Promise.all(updatePromises);
            const successCount = results.filter(Boolean).length;
            
            if (successCount > 0) {
                // Return to view mode for the current utterance
                cancelSpeakerEdit(utteranceId);
                
                // Refresh the UI
                renderUtterances();
                
                showToast('success', 'Success', `Updated ${successCount} of ${utterancesToUpdate.length} utterances with speaker "${speakerName}"`);
            } else {
                throw new Error('Failed to update any utterances');
            }
        } else {
            // Update just the single utterance
            console.log(`Updating just utterance ${utteranceId} with speaker ID: ${speakerId}`);
            
            // Update the utterance speaker
            const response = await fetch(`/api/utterances/${utteranceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ speaker_id: speakerId })
            });
            
            console.log('Update utterance response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response from update utterance:', errorText);
                throw new Error(`Failed to update speaker: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Update result:', result);
            
            if (result.success) {
                // Update local data
                const utterance = currentConversation.utterances.find(u => u.id === utteranceId);
                if (utterance) {
                    utterance.speaker_id = speakerId;
                    utterance.speaker_name = speakerName;
                }
                
                // Update UI
                const speakerNameElement = document.getElementById(`speaker-${utteranceId}`);
                speakerNameElement.textContent = speakerName;
                
                // Return to view mode
                cancelSpeakerEdit(utteranceId);
                
                showToast('success', 'Success', 'Speaker updated successfully');
            } else {
                throw new Error(result.detail || 'Failed to update speaker');
            }
        }
    } catch (error) {
        console.error('Error updating speaker:', error);
        showToast('error', 'Error', error.message);
        
        // Re-enable buttons
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.textContent = '💾';
    }
}

async function updateUtteranceTextInline(utteranceId, text) {
    console.log(`Saving text for utterance ${utteranceId}: "${text}"`);
    try {
        const response = await fetch(`/api/utterances/${utteranceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });

        console.log('API response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to update text: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log('API response data:', result);
        
        if (result.success) {
            // Update the local state
            const utterance = currentConversation.utterances.find(u => u.id === utteranceId);
            if (utterance) {
                utterance.text = text;
            }
            showToast('success', 'Success', 'Text updated successfully');
            return true;
        } else {
            throw new Error(result.detail || 'Failed to update text');
        }
    } catch (error) {
        console.error('Error updating text:', error);
        showToast('error', 'Error', `Failed to update text: ${error.message}`);
        return false;
    }
}

function handleAudioLoaded(audioElement, url) {
    console.log('Audio metadata loaded:', {
        url: url,
        duration: audioElement.duration,
        readyState: audioElement.readyState
    });
}

function handleAudioError(audioElement, url) {
    console.error('Audio playback error:', {
        error: audioElement.error,
        url: url,
        code: audioElement.error.code,
        message: audioElement.error.message
    });
    
    // Test the API endpoint
    fetch(url)
        .then(response => {
            console.log('Audio API response:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            console.log('Audio blob received:', {
                size: blob.size,
                type: blob.type
            });
            
            // Create a new audio element with the blob URL
            const audioContainer = audioElement.closest('.audio-container');
            if (audioContainer) {
                const blobUrl = URL.createObjectURL(blob);
                audioContainer.innerHTML = `
                    <audio 
                        class="audio-player" 
                        controls 
                        preload="none"
                        onerror="handleAudioError(this, '${url}')"
                        onloadedmetadata="handleAudioLoaded(this, '${url}')"
                        src="${blobUrl}"
                    ></audio>
                `;
            }
        })
        .catch(error => {
            console.error('Audio API fetch error:', error);
            const audioContainer = audioElement.closest('.audio-container');
            if (audioContainer) {
                let errorMessage = 'Failed to load audio';
                
                // Add more specific error messages based on the error code
                switch (audioElement.error.code) {
                    case 1:
                        errorMessage = 'Audio loading was aborted';
                        break;
                    case 2:
                        errorMessage = 'Network error occurred while loading audio';
                        break;
                    case 3:
                        errorMessage = 'Error decoding audio file';
                        break;
                    case 4:
                        errorMessage = 'Audio source not found or access denied';
                        break;
                }
                
                audioContainer.innerHTML = `
                    <p class="error-message">${errorMessage}</p>
                    <p class="error-details">URL: ${url}</p>
                    <button onclick="retryAudio(this, '${url}')" class="retry-button">Retry</button>
                `;
            }
        });
}

function retryAudio(button, url) {
    const container = button.closest('.audio-container');
    container.innerHTML = `
        <audio 
            class="audio-player" 
            controls 
            preload="none"
            onerror="handleAudioError(this, '${url}')"
            onloadedmetadata="handleAudioLoaded(this, '${url}')"
            src="${url}"
        ></audio>
    `;
}

function showEditConversationModal(conversationId, currentName) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit Conversation</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="edit-conversation-form">
                    <div class="form-group">
                        <label for="edit-conversation-name">Conversation Name</label>
                        <input type="text" id="edit-conversation-name" name="display_name" value="${currentName}" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="submit-button">Save</button>
                        <button type="button" class="cancel-button">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.modal-close');
    closeButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const cancelButton = modal.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const form = modal.querySelector('#edit-conversation-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            const response = await fetch(`/api/conversations/${conversationId}`, {
                method: 'PUT',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('success', 'Success', 'Conversation updated successfully');
                
                // Update global conversations list
                loadConversations();
                
                // If we're viewing this conversation currently, refresh it
                if (currentConversation && currentConversation.id === conversationId) {
                    // Update current conversation's display name
                    currentConversation.display_name = formData.get('display_name');
                    
                    // Refresh the conversation modal header
                    const modalHeader = document.querySelector('#conversation-modal .modal-header .title-container h3');
                    if (modalHeader) {
                        modalHeader.textContent = currentConversation.display_name;
                    }
                }
                
                modal.remove();
            } else {
                showToast('error', 'Error', result.detail || 'Failed to update conversation');
            }
        } catch (error) {
            console.error('Error updating conversation:', error);
            showToast('error', 'Error', `Failed to update conversation: ${error.message}`);
        }
    });
}

function showDeleteConversationModal(conversationId, displayName) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal active'; // Add active class to show immediately
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Delete Conversation</h3>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete "${displayName}"?</p>
                <p class="warning" style="color: #dc2626; margin-top: 10px;">This action cannot be undone.</p>
                <div class="form-actions">
                    <button id="confirm-delete-conversation" class="button-primary" style="background-color: #dc2626;">Delete</button>
                    <button id="cancel-delete-conversation" class="button-secondary">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const cancelButton = modal.querySelector('#cancel-delete-conversation');
    cancelButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const confirmButton = modal.querySelector('#confirm-delete-conversation');
    confirmButton.addEventListener('click', async () => {
        try {
            // Show loading state
            confirmButton.textContent = 'Deleting...';
            confirmButton.disabled = true;
            
            const response = await fetch(`/api/conversations/${conversationId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('success', 'Success', 'Conversation deleted successfully');
                loadConversations();
                modal.remove();
            } else {
                confirmButton.textContent = 'Delete';
                confirmButton.disabled = false;
                showToast('error', 'Error', result.detail || 'Failed to delete conversation');
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            confirmButton.textContent = 'Delete';
            confirmButton.disabled = false;
            showToast('error', 'Error', `Failed to delete conversation: ${error.message}`);
        }
    });
}

function showEditUtteranceSpeakerModal(utteranceId, currentSpeakerId, allSpeakers) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Create speaker options
    let speakerOptions = '';
    allSpeakers.forEach(speaker => {
        const selected = speaker.id === currentSpeakerId ? 'selected' : '';
        speakerOptions += `<option value="${speaker.id}" ${selected}>${speaker.name}</option>`;
    });
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Change Speaker</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="edit-utterance-form">
                    <div class="form-group">
                        <label for="edit-utterance-speaker">Speaker</label>
                        <select id="edit-utterance-speaker" name="speaker_id" required>
                            ${speakerOptions}
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="submit-button">Save</button>
                        <button type="button" class="cancel-button">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.modal-close');
    closeButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const cancelButton = modal.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const form = modal.querySelector('#edit-utterance-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            const response = await fetch(`/api/utterances/${utteranceId}`, {
                method: 'PUT',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('success', 'Success', 'Speaker updated successfully');
                
                // Refresh the conversation view
                if (currentConversation) {
                    viewConversation(currentConversation.id);
                }
                
                modal.remove();
            } else {
                showToast('error', 'Error', result.detail || 'Failed to update speaker');
            }
        } catch (error) {
            console.error('Error updating utterance:', error);
            showToast('error', 'Error', `Failed to update speaker: ${error.message}`);
        }
    });
}

async function loadSpeakers() {
    const speakersContainer = document.getElementById('speakers-list');
    if (!speakersContainer) return;
    
    speakersContainer.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
    
    try {
        console.log('Loading speakers from server...');
        const response = await fetch('/api/speakers');
        const speakersData = await response.json();
        
        // Update global speakers list
        speakers = speakersData;
        console.log('Global speakers list updated:', speakers);
        
        if (!Array.isArray(speakersData) || speakersData.length === 0) {
            speakersContainer.innerHTML = '<p>No speakers found. Process a conversation to create speakers.</p>';
            return;
        }
        
        speakersContainer.innerHTML = '';
        
        speakersData.forEach(speaker => {
            const card = document.createElement('div');
            card.className = 'speaker-card';
            
            card.innerHTML = `
                <div class="card-header">
                <h3>${speaker.name}</h3>
                    <div class="card-actions">
                        <button class="button-icon-only edit">✏️</button>
                        <button class="button-icon-only delete">🗑️</button>
                    </div>
                </div>
                <div class="speaker-stats">
                    <div class="stat-item">
                        <span class="stat-label">Utterances</span>
                        <span class="stat-value">${speaker.utterance_count}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Duration</span>
                        <span class="stat-value">${formatDuration(speaker.total_duration)}</span>
                    </div>
                </div>
            `;
            
            speakersContainer.appendChild(card);
            
            // Add event listeners
            const editButton = card.querySelector('.button-icon-only.edit');
            editButton.addEventListener('click', () => {
                showEditSpeakerModal(speaker.id, speaker.name);
            });
            
            const deleteButton = card.querySelector('.button-icon-only.delete');
            deleteButton.addEventListener('click', () => {
                showDeleteSpeakerModal(speaker.id, speaker.name, speaker.utterance_count);
            });
        });
    } catch (error) {
        console.error('Error loading speakers:', error);
        speakersContainer.innerHTML = `<p class="error-message">Error loading speakers: ${error.message}</p>`;
        showToast('error', 'Error', `Failed to load speakers: ${error.message}`);
    }
}

function showEditSpeakerModal(speakerId, currentName) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit Speaker</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="edit-speaker-form">
                    <div class="form-group">
                        <label for="edit-speaker-name">Speaker Name</label>
                        <input type="text" id="edit-speaker-name" name="name" value="${currentName}" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="submit-button">Save</button>
                        <button type="button" class="cancel-button">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.modal-close');
    closeButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const cancelButton = modal.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const form = modal.querySelector('#edit-speaker-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            const response = await fetch(`/api/speakers/${speakerId}`, {
                method: 'PUT',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('success', 'Success', 'Speaker updated successfully');
                loadSpeakers();
                modal.remove();
            } else {
                showToast('error', 'Error', result.detail || 'Failed to update speaker');
            }
        } catch (error) {
            console.error('Error updating speaker:', error);
            showToast('error', 'Error', `Failed to update speaker: ${error.message}`);
        }
    });
}

function showDeleteSpeakerModal(speakerId, speakerName, utteranceCount) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    let modalContent = '';
    
    if (utteranceCount > 0) {
        // If speaker has utterances, show reassign options
        modalContent = `
            <div class="modal-header">
                <h3>Cannot Delete Speaker</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>Speaker "${speakerName}" has ${utteranceCount} utterances and cannot be deleted.</p>
                <p>You must reassign these utterances to another speaker first.</p>
                <div class="form-actions">
                    <button id="reassign-utterances" class="submit-button">Reassign Utterances</button>
                    <button id="cancel-delete-speaker" class="cancel-button">Cancel</button>
                </div>
            </div>
        `;
    } else {
        // If speaker has no utterances, show delete confirmation
        modalContent = `
            <div class="modal-header">
                <h3>Delete Speaker</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete speaker "${speakerName}"?</p>
                <p class="warning">This action cannot be undone.</p>
                <div class="form-actions">
                    <button id="confirm-delete-speaker" class="delete-button">Delete</button>
                    <button id="cancel-delete-speaker" class="cancel-button">Cancel</button>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = `<div class="modal-content">${modalContent}</div>`;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.modal-close');
    closeButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const cancelButton = modal.querySelector('#cancel-delete-speaker');
    cancelButton.addEventListener('click', () => {
        modal.remove();
    });
    
    if (utteranceCount > 0) {
        // Add event listener for reassign button
        const reassignButton = modal.querySelector('#reassign-utterances');
        reassignButton.addEventListener('click', async () => {
            modal.remove();
            showReassignUtterancesModal(speakerId, speakerName);
        });
    } else {
        // Add event listener for confirm delete button
        const confirmButton = modal.querySelector('#confirm-delete-speaker');
        confirmButton.addEventListener('click', async () => {
            try {
                const response = await fetch(`/api/speakers/${speakerId}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showToast('success', 'Success', 'Speaker deleted successfully');
                    loadSpeakers();
                    modal.remove();
                } else {
                    showToast('error', 'Error', result.detail || 'Failed to delete speaker');
                }
            } catch (error) {
                console.error('Error deleting speaker:', error);
                showToast('error', 'Error', `Failed to delete speaker: ${error.message}`);
            }
        });
    }
}

async function showReassignUtterancesModal(fromSpeakerId, fromSpeakerName) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Reassign Utterances</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>Reassign all utterances from "${fromSpeakerName}" to another speaker:</p>
                <form id="reassign-utterances-form">
                    <div class="form-group">
                        <label for="to-speaker">Target Speaker</label>
                        <select id="to-speaker" name="to_speaker_id" required>
                            <option value="">Loading speakers...</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="submit-button">Reassign</button>
                        <button type="button" class="cancel-button">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.modal-close');
    closeButton.addEventListener('click', () => {
        modal.remove();
    });
    
    const cancelButton = modal.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
        modal.remove();
    });
    
    // Load speakers for dropdown
    try {
        const response = await fetch('/api/speakers');
        const speakers = await response.json();
        
        const toSpeakerSelect = document.getElementById('to-speaker');
        toSpeakerSelect.innerHTML = '';
        
        speakers.forEach(speaker => {
            if (speaker.id !== fromSpeakerId) {
                const option = document.createElement('option');
                option.value = speaker.id;
                option.textContent = speaker.name;
                toSpeakerSelect.appendChild(option);
            }
        });
        
        if (toSpeakerSelect.options.length === 0) {
            toSpeakerSelect.innerHTML = '<option value="">No other speakers available</option>';
            document.querySelector('#reassign-utterances-form .submit-button').disabled = true;
        }
    } catch (error) {
        console.error('Error loading speakers for reassignment:', error);
        document.getElementById('to-speaker').innerHTML = '<option value="">Error loading speakers</option>';
        document.querySelector('#reassign-utterances-form .submit-button').disabled = true;
    }
    
    // Add form submit handler
    const form = document.getElementById('reassign-utterances-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const toSpeakerId = document.getElementById('to-speaker').value;
        
        if (!toSpeakerId) {
            showToast('error', 'Error', 'Please select a target speaker');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('to_speaker_id', toSpeakerId);
            
            const response = await fetch(`/api/speakers/${fromSpeakerId}/update-all-utterances`, {
                method: 'PUT',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('success', 'Success', `Reassigned ${result.updated_count} utterances successfully`);
                loadSpeakers();
                modal.remove();
            } else {
                showToast('error', 'Error', result.detail || 'Failed to reassign utterances');
            }
        } catch (error) {
            console.error('Error reassigning utterances:', error);
            showToast('error', 'Error', `Failed to reassign utterances: ${error.message}`);
        }
    });
}

// Status tracking variables
let processingInProgress = false;
let currentStep = null;

// Process status tracking functions
function initProcessingStatus() {
    const statusContainer = document.getElementById('processing-status');
    const statusSteps = document.querySelectorAll('.status-step');
    const statusLog = document.getElementById('status-log');
    const statusSpinner = document.querySelector('.status-spinner');
    
    // Reset status elements
    statusContainer.classList.remove('active');
    statusSteps.forEach(step => {
        step.classList.remove('active', 'completed', 'error');
        step.querySelector('.step-status').textContent = 'Waiting';
    });
    statusLog.innerHTML = '';
    statusSpinner.classList.remove('active');
    document.getElementById('current-status').textContent = 'Waiting for upload...';
    
    processingInProgress = false;
    currentStep = null;
}

function showProcessingStatus() {
    document.getElementById('processing-status').classList.add('active');
    document.querySelector('.status-spinner').classList.add('active');
    processingInProgress = true;
}

function updateProcessingStep(step, status = 'active') {
    // First, update the previous step as completed if moving forward
    if (currentStep && step !== currentStep && status === 'active') {
        const prevStep = document.querySelector(`.status-step[data-step="${currentStep}"]`);
        if (prevStep) {
            prevStep.classList.remove('active', 'error');
            prevStep.classList.add('completed');
            prevStep.querySelector('.step-status').textContent = 'Completed';
        }
    }
    
    // Now update the current step
    const stepElement = document.querySelector(`.status-step[data-step="${step}"]`);
    if (stepElement) {
        stepElement.classList.remove('completed', 'error');
        stepElement.classList.add(status);
        
        if (status === 'active') {
            stepElement.querySelector('.step-status').textContent = 'In Progress';
            document.getElementById('current-status').textContent = `Processing: ${stepElement.querySelector('.step-name').textContent}`;
        } else if (status === 'error') {
            stepElement.querySelector('.step-status').textContent = 'Error';
            document.getElementById('current-status').textContent = `Error in ${stepElement.querySelector('.step-name').textContent}`;
        }
    }
    
    currentStep = step;
}

function addLogEntry(message, type = 'info') {
    const logContainer = document.getElementById('status-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll to bottom
}

function completeProcessing(success = true) {
    // Mark all remaining steps as completed if successful
    if (success) {
        const steps = document.querySelectorAll('.status-step');
        steps.forEach(step => {
            step.classList.remove('active', 'error');
            step.classList.add('completed');
            step.querySelector('.step-status').textContent = 'Completed';
        });
        document.getElementById('current-status').textContent = 'Processing complete!';
        addLogEntry('Processing completed successfully!', 'success');
    }
    
    document.querySelector('.status-spinner').classList.remove('active');
    processingInProgress = false;
}

async function handleUpload(e) {
    e.preventDefault();
    
    const form = document.getElementById('upload-form');
    const formData = new FormData(form);
    
    // Get slider values and log them
    const matchThreshold = document.getElementById('match-threshold').value;
    const autoUpdateThreshold = document.getElementById('auto-update-threshold').value;
    console.log(`Uploading with match threshold: ${matchThreshold}, auto-update threshold: ${autoUpdateThreshold}`);
    
    // Initialize processing status display
    initProcessingStatus();
    showProcessingStatus();
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Uploading...';
    
    addLogEntry(`Starting upload process with match threshold: ${matchThreshold}, auto-update threshold: ${autoUpdateThreshold}`);
    updateProcessingStep('upload');
    
    try {
        // Start upload
        addLogEntry(`Uploading file: ${document.getElementById('file-name').textContent}`);
        
        const response = await fetch('/api/conversations/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        // Processing step - server is now processing the file
        updateProcessingStep('transcribe');
        addLogEntry('File uploaded. Transcribing audio...');
        
        const result = await response.json();
        
        // Update status based on response
        if (result.success) {
            // Simulate step transitions (in reality, this would happen on server)
            // We'll use setTimeout to create a more realistic feel
            setTimeout(() => {
                updateProcessingStep('identify');
                addLogEntry('Transcription complete. Identifying speakers...');
                
                setTimeout(() => {
                    updateProcessingStep('database');
                    addLogEntry('Speaker identification complete. Updating database...');
                    
                    setTimeout(() => {
                        completeProcessing(true);
                        showToast('success', 'Upload Complete', 'Conversation processed successfully');
                        
                        // Reset form
                        form.reset();
                        document.getElementById('file-name').textContent = '';
                        
                        // Refresh conversations list
                        loadConversations();
                        
                        // Switch to conversations view
                        changeView('conversations');
                    }, 1000);
                }, 1000);
            }, 1000);
            
        } else {
            updateProcessingStep(currentStep, 'error');
            addLogEntry(`Error: ${result.detail || 'Unknown error'}`, 'error');
            completeProcessing(false);
            showToast('error', 'Upload Failed', result.detail || 'Failed to process conversation');
        }
    } catch (error) {
        console.error('Error uploading conversation:', error);
        updateProcessingStep(currentStep, 'error');
        addLogEntry(`Error: ${error.message}`, 'error');
        completeProcessing(false);
        showToast('error', 'Upload Failed', `Error: ${error.message}`);
    } finally {
        // Restore button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

function updateFileName() {
    const fileInput = document.getElementById('audio-file');
    const fileNameDisplay = document.getElementById('file-name');
    
    if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = fileInput.files[0].name;
    } else {
        fileNameDisplay.textContent = '';
    }
}

// ============= PINECONE MANAGER FUNCTIONALITY =============
function initPineconeManager() {
    // Initialize forms
    const addSpeakerForm = document.getElementById('add-speaker-form');
    if (addSpeakerForm) {
        addSpeakerForm.addEventListener('submit', handleAddSpeaker);
    }
    
    const addEmbeddingForm = document.getElementById('add-embedding-form');
    if (addEmbeddingForm) {
        addEmbeddingForm.addEventListener('submit', handleAddEmbedding);
    }
    
    // Load speakers
    if (document.getElementById('pinecone-speakers-container')) {
        loadPineconeSpeakers();
    }
}

async function loadPineconeSpeakers() {
    console.log('Loading Pinecone speakers...');
    const speakersContainer = document.getElementById('pinecone-speakers-container');
    if (!speakersContainer) {
        console.error('Pinecone speakers container not found');
        return;
    }
    
    speakersContainer.innerHTML = '<div class="pinecone-loading"><div class="pinecone-spinner"></div></div>';
    
    try {
        console.log('Fetching speakers from API...');
        const response = await fetch('/api/pinecone/speakers');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Received speakers data:', data);
        
        if (!data.speakers || data.speakers.length === 0) {
            speakersContainer.innerHTML = '<p>No speakers found in Pinecone database.</p>';
            return;
        }
        
        speakersContainer.innerHTML = '';
        
        data.speakers.forEach(speaker => {
            const speakerCard = document.createElement('div');
            speakerCard.className = 'pinecone-speaker-card';
            
            const embeddings = speaker.embeddings || [];
            
            speakerCard.innerHTML = `
                <div class="card-header">
                    <h3>${speaker.name}</h3>
                    <div class="card-actions">
                        <button class="button-icon-only view">🔍</button>
                        <button class="button-icon-only edit">✏️</button>
                        <button class="button-icon-only delete">🗑️</button>
                    </div>
                </div>
                <div class="pinecone-embeddings-list">
                    ${embeddings.map(embedding => `
                        <div class="pinecone-embedding-item">
                            <span class="pinecone-embedding-id">${embedding.id}</span>
                            <button class="pinecone-delete-embedding" data-id="${embedding.id}">Delete</button>
                        </div>
                    `).join('')}
                </div>
            `;
            
            speakersContainer.appendChild(speakerCard);
            
            // Add event listeners
            const addEmbeddingBtn = speakerCard.querySelector('.button-icon-only.edit');
            if (addEmbeddingBtn) {
            addEmbeddingBtn.addEventListener('click', () => {
                showAddEmbeddingForm(speaker.name);
            });
            }
            
            const deleteSpeakerBtn = speakerCard.querySelector('.button-icon-only.delete');
            if (deleteSpeakerBtn) {
            deleteSpeakerBtn.addEventListener('click', () => {
                deletePineconeSpeaker(speaker.name);
            });
            }
            
            const deleteEmbeddingBtns = speakerCard.querySelectorAll('.pinecone-delete-embedding');
            deleteEmbeddingBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    deletePineconeEmbedding(btn.dataset.id);
                });
            });
        });
    } catch (error) {
        console.error('Error loading Pinecone speakers:', error);
        speakersContainer.innerHTML = `
            <div class="error-message">
                <p>Error loading speakers: ${error.message}</p>
                <button onclick="loadPineconeSpeakers()">Retry</button>
            </div>
        `;
        showToast('error', 'Error', `Failed to load Pinecone speakers: ${error.message}`);
    }
}

async function handleAddSpeaker(e) {
    e.preventDefault();
    
    const form = document.getElementById('add-speaker-form');
    const formData = new FormData(form);
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Adding...';
    
    try {
        const response = await fetch('/api/pinecone/speakers', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('success', 'Success', `Speaker "${result.speaker_name}" added successfully`);
            form.reset();
            loadPineconeSpeakers();
        } else {
            showToast('error', 'Error', result.detail || 'Failed to add speaker');
        }
    } catch (error) {
        console.error('Error adding speaker:', error);
        showToast('error', 'Error', `Failed to add speaker: ${error.message}`);
    } finally {
        // Restore button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

function showAddEmbeddingForm(speakerName) {
    // Hide add speaker form
    document.getElementById('add-speaker-section').style.display = 'none';
    
    // Show add embedding form
    const addEmbeddingSection = document.getElementById('add-embedding-section');
    addEmbeddingSection.style.display = 'block';
    
    // Set speaker name
    document.getElementById('embedding-speaker-name').value = speakerName;
}

async function handleAddEmbedding(e) {
    e.preventDefault();
    
    const form = document.getElementById('add-embedding-form');
    const formData = new FormData(form);
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Adding...';
    
    try {
        const response = await fetch('/api/pinecone/embeddings', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('success', 'Success', `Embedding added to "${result.speaker_name}" successfully`);
            form.reset();
            
            // Hide add embedding form
            document.getElementById('add-embedding-section').style.display = 'none';
            
            // Show add speaker form
            document.getElementById('add-speaker-section').style.display = 'block';
            
            loadPineconeSpeakers();
        } else {
            showToast('error', 'Error', result.detail || 'Failed to add embedding');
        }
    } catch (error) {
        console.error('Error adding embedding:', error);
        showToast('error', 'Error', `Failed to add embedding: ${error.message}`);
    } finally {
        // Restore button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

async function deletePineconeSpeaker(speakerName) {
    if (!confirm(`Are you sure you want to delete all embeddings for speaker "${speakerName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/pinecone/speakers/${encodeURIComponent(speakerName)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('success', 'Success', `Deleted ${result.embeddings_deleted} embeddings for "${speakerName}"`);
            loadPineconeSpeakers();
        } else {
            showToast('error', 'Error', result.detail || 'Failed to delete speaker');
        }
    } catch (error) {
        console.error('Error deleting speaker:', error);
        showToast('error', 'Error', `Failed to delete speaker: ${error.message}`);
    }
}

async function deletePineconeEmbedding(embeddingId) {
    if (!confirm(`Are you sure you want to delete this embedding?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/pinecone/embeddings/${embeddingId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('success', 'Success', `Embedding deleted successfully`);
            loadPineconeSpeakers();
        } else {
            showToast('error', 'Error', result.detail || 'Failed to delete embedding');
        }
    } catch (error) {
        console.error('Error deleting embedding:', error);
        showToast('error', 'Error', `Failed to delete embedding: ${error.message}`);
    }
}

// Modal functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                modal.remove();
            }
        }, 300);
    }
}

function editUtteranceSpeaker(utteranceId) {
    const utterance = currentConversation.utterances.find(u => u.id === utteranceId);
    if (!utterance) {
        console.error('Utterance not found:', utteranceId);
        return;
    }

    // Create modal if it doesn't exist
    let modal = document.getElementById('edit-speaker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-speaker-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    // Show the modal
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit Speaker</h3>
                <button class="close-button" onclick="closeModal('edit-speaker-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="edit-speaker-form" onsubmit="updateUtteranceSpeaker(event, '${utteranceId}')">
                    <div class="form-group">
                        <label for="speaker-select">Speaker:</label>
                        <select id="speaker-select" name="speaker_id" required>
                            <option value="">Select a speaker...</option>
                            <option value="new">+ Create New Speaker</option>
                            ${speakers.map(speaker => `
                                <option value="${speaker.id}" ${speaker.id === utterance.speaker_id ? 'selected' : ''}>
                                    ${speaker.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div id="new-speaker-form" style="display: none;">
                        <div class="form-group">
                            <label for="new-speaker-name">New Speaker Name:</label>
                            <input type="text" id="new-speaker-name" name="new_speaker_name">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Save</button>
                        <button type="button" class="btn btn-secondary" onclick="closeModal('edit-speaker-modal')">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Add event listener for speaker select
    const speakerSelect = document.getElementById('speaker-select');
    const newSpeakerForm = document.getElementById('new-speaker-form');
    
    speakerSelect.addEventListener('change', function() {
        if (this.value === 'new') {
            newSpeakerForm.style.display = 'block';
        } else {
            newSpeakerForm.style.display = 'none';
        }
    });
}

async function updateUtteranceSpeaker(event, utteranceId) {
    event.preventDefault();
    const form = event.target;
    const speakerId = form.speaker_id.value;
    const newSpeakerName = form.new_speaker_name?.value;

    console.log(`Updating speaker for utterance ${utteranceId}. Speaker ID: ${speakerId}, New name: ${newSpeakerName}`);

    try {
        let speakerIdToUse = speakerId;

        // If creating a new speaker
        if (speakerId === 'new' && newSpeakerName) {
            console.log(`Creating new speaker: ${newSpeakerName}`);
            
            // Create new speaker using FormData
            const formData = new FormData();
            formData.append('name', newSpeakerName);
            
            console.log('Sending create speaker request');
            
            const createResponse = await fetch('/api/speakers', {
                method: 'POST',
                body: formData
            });
            
            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                console.error('Error creating speaker:', errorText);
                throw new Error(`Failed to create new speaker: ${errorText}`);
            }
            
            const responseText = await createResponse.text();
            console.log('Raw create speaker response:', responseText);
            
            try {
                const newSpeaker = JSON.parse(responseText);
                console.log('Parsed speaker response:', newSpeaker);
                
                if (!newSpeaker.id) {
                    throw new Error('No speaker ID returned from server');
                }
                
                speakerIdToUse = newSpeaker.id;
                
                // Add to global speakers list
                speakers.push({
                    id: speakerIdToUse,
                    name: newSpeakerName
                });
                
                console.log(`Added new speaker to list with ID: ${speakerIdToUse}`);
            } catch (parseError) {
                console.error('Error parsing response:', parseError);
                throw new Error(`Failed to parse server response: ${parseError.message}`);
            }
        }
        
        console.log(`Now updating utterance with speaker ID: ${speakerIdToUse}`);
        
        // Update the utterance with the speaker
        const response = await fetch(`/api/utterances/${utteranceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ speaker_id: speakerIdToUse })
        });

        console.log('Update speaker response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error updating speaker:', errorText);
            throw new Error(`Failed to update speaker: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log('Update result:', result);
        
        if (result.success) {
            // Update the local state
            const utterance = currentConversation.utterances.find(u => u.id === utteranceId);
            if (utterance) {
                utterance.speaker_id = speakerIdToUse;
                utterance.speaker_name = newSpeakerName || speakers.find(s => s.id.toString() === speakerIdToUse.toString())?.name || 'Unknown Speaker';
            }

            // Close the modal
            closeModal('edit-speaker-modal');
            
            // Show success message
            showToast('success', 'Success', 'Speaker updated successfully');
            
            // Refresh the conversation view
            await viewConversation(currentConversation.id);
            
            return true;
        } else {
            throw new Error(result.detail || 'Failed to update speaker');
        }
    } catch (error) {
        console.error('Error updating speaker:', error);
        showToast('error', 'Error', `Failed to update speaker: ${error.message}`);
        return false;
    }
}

function toggleTextEdit(utteranceId) {
    const textElement = document.getElementById(`text-${utteranceId}`);
    const editButton = document.querySelector(`[onclick="toggleTextEdit('${utteranceId}')"]`);
    
    if (textElement.contentEditable === 'true') {
        // Save changes
        const newText = textElement.textContent.trim();
        console.log(`Attempting to save text: "${newText}"`);
        
        // Disable the button while saving
        editButton.disabled = true;
        editButton.innerHTML = '⏳';
        
        updateUtteranceTextInline(utteranceId, newText).then(success => {
            // Re-enable the button
            editButton.disabled = false;
            
            if (success) {
                textElement.contentEditable = 'false';
                textElement.classList.remove('editing');
                editButton.innerHTML = '✏️';
                console.log('Text saved successfully');
            } else {
                // Keep in edit mode if failed
                editButton.innerHTML = '💾';
                console.log('Failed to save text');
            }
        });
    } else {
        // Enter edit mode
        textElement.contentEditable = 'true';
        textElement.classList.add('editing');
        textElement.focus();
        editButton.innerHTML = '💾';
        
        // Place cursor at end of text
        const range = document.createRange();
        range.selectNodeContents(textElement);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

function toggleTitleEdit() {
    const titleElement = document.getElementById('conversation-title');
    const editButton = document.getElementById('edit-title-btn');
    
    if (titleElement.contentEditable === 'true') {
        // Save changes
        const newTitle = titleElement.textContent.trim();
        console.log(`Attempting to save conversation title: "${newTitle}"`);
        
        // Disable the button while saving
        editButton.disabled = true;
        editButton.innerHTML = '⏳';
        
        // Store the original title in case update fails
        const originalTitle = currentConversation.display_name || `Conversation ${currentConversation.id.slice(-8)}`;
        
        updateConversationTitle(newTitle).then(success => {
            // Re-enable the button
            editButton.disabled = false;
            
            if (success) {
                titleElement.contentEditable = 'false';
                titleElement.classList.remove('editing');
                editButton.innerHTML = '✏️';
                console.log('Title saved successfully');
            } else {
                // Keep in edit mode if failed
                editButton.innerHTML = '💾';
                console.log('Failed to save title');
            }
        });
    } else {
        // Enter edit mode
        titleElement.contentEditable = 'true';
        titleElement.classList.add('editing');
        titleElement.focus();
        editButton.innerHTML = '💾';
        
        // Place cursor at end of text
        const range = document.createRange();
        range.selectNodeContents(titleElement);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

async function updateConversationTitle(newTitle) {
    console.log(`Saving title for conversation ${currentConversation.id}: "${newTitle}"`);
    try {
        // Create form data for the API request
        const formData = new FormData();
        formData.append('display_name', newTitle);
        
        const response = await fetch(`/api/conversations/${currentConversation.id}`, {
            method: 'PUT',
            body: formData
        });

        console.log('API response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to update title: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log('API response data:', result);
        
        if (result.success) {
            // Update the local state
            currentConversation.display_name = newTitle;
            
            // Refresh the conversations list in the background
            loadConversations();
            
            showToast('success', 'Success', 'Conversation name updated successfully');
            return true;
        } else {
            throw new Error(result.detail || 'Failed to update conversation name');
        }
    } catch (error) {
        console.error('Error updating conversation name:', error);
        showToast('error', 'Error', `Failed to update conversation name: ${error.message}`);
        return false;
    }
}

// Test functions that can be run from browser console
async function testUpdateUtteranceText(utteranceId, text) {
    console.log(`TEST: Updating utterance ${utteranceId} text to "${text}"`);
    try {
        const response = await fetch(`/api/utterances/${utteranceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });

        console.log('TEST: Response status:', response.status);
        const responseText = await response.text();
        console.log('TEST: Response text:', responseText);
        
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('TEST: Parsed result:', result);
        } catch (e) {
            console.log('TEST: Could not parse response as JSON');
        }
        
        return { status: response.status, text: responseText, result };
    } catch (error) {
        console.error('TEST: Error in test:', error);
        return { error: error.message };
    }
}

async function testUpdateUtteranceSpeaker(utteranceId, speakerId) {
    console.log(`TEST: Updating utterance ${utteranceId} speaker to ${speakerId}`);
    try {
        const response = await fetch(`/api/utterances/${utteranceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ speaker_id: speakerId })
        });

        console.log('TEST: Response status:', response.status);
        const responseText = await response.text();
        console.log('TEST: Response text:', responseText);
        
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('TEST: Parsed result:', result);
        } catch (e) {
            console.log('TEST: Could not parse response as JSON');
        }
        
        return { status: response.status, text: responseText, result };
    } catch (error) {
        console.error('TEST: Error in test:', error);
        return { error: error.message };
    }
}

// Test functions that can be run from browser console
async function testAddSpeaker(name) {
    console.log(`TEST: Creating new speaker: "${name}"`);
    try {
        // Use FormData for speaker creation
        const formData = new FormData();
        formData.append('name', name);
        
        const response = await fetch('/api/speakers', {
            method: 'POST',
            body: formData
        });

        console.log('TEST: Response status:', response.status);
        const responseText = await response.text();
        console.log('TEST: Response text:', responseText);
        
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('TEST: Parsed result:', result);
        } catch (e) {
            console.log('TEST: Could not parse response as JSON');
        }
        
        return { status: response.status, text: responseText, result };
    } catch (error) {
        console.error('TEST: Error in test:', error);
        return { error: error.message };
    }
}

// Expose test functions globally
window.testUpdateUtteranceText = testUpdateUtteranceText;
window.testUpdateUtteranceSpeaker = testUpdateUtteranceSpeaker;
window.testAddSpeaker = testAddSpeaker;
