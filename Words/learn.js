// Configuration
const SETS = 9;
const PARTS = [5, 3, 3, 3, 2, 1, 1, 1, 1];

// Global variables
let vocabulary = [];
let currentPage = 1;
let wordsPerPage = 10;
let currentSet = 1;
let currentPart = 1;

// DOM elements
const setSelect = document.getElementById('setSelect');
const partSelect = document.getElementById('partSelect');
const loadBtn = document.getElementById('loadBtn');
const showPassagesBtn = document.getElementById('showPassagesBtn');
const pageContainer = document.getElementById('pageContainer');
const statsDiv = document.getElementById('stats');
const totalWordsSpan = document.getElementById('totalWords');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const wordsPerPageSelect = document.getElementById('wordsPerPage');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const prevPageBtnBottom = document.getElementById('prevPageBtnBottom');
const nextPageBtnBottom = document.getElementById('nextPageBtnBottom');
const pageIndicator = document.getElementById('pageIndicator');
const wordsList = document.getElementById('wordsList');
const passagesModal = document.getElementById('passagesModal');
const passagesContainer = document.getElementById('passagesContainer');
const closeModal = document.querySelector('.close-modal');

// Initialize speech synthesis
const synth = window.speechSynthesis;

function parseCSVLine(line) {
    const result = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                currentField += '"';
                i += 2;
                continue;
            }
            inQuotes = !inQuotes;
            i++;
            continue;
        }
        
        if (char === ',' && !inQuotes) {
            // Trim whitespace from the field
            result.push(currentField.trim());
            currentField = '';
            i++;
            continue;
        }
        
        currentField += char;
        i++;
    }
    
    // Push the last field and trim whitespace
    result.push(currentField.trim());
    
    return result;
}

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    const data = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue; // Skip empty lines
        
        try {
            const row = parseCSVLine(line);
            if (row.length > 0) {
                data.push(row);
            }
        } catch (error) {
            console.error(`Error parsing line ${i + 1}:`, line, error);
        }
    }
    
    return data;
}

// Initialize selectors
function initializeSelectors() {
    for (let i = 1; i <= SETS; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Set ${i}`;
        setSelect.appendChild(option);
    }
    
    updatePartSelector();
    
    setSelect.addEventListener('change', updatePartSelector);
    loadBtn.addEventListener('click', loadVocabulary);
    showPassagesBtn.addEventListener('click', showPassages);
    wordsPerPageSelect.addEventListener('change', (e) => {
        wordsPerPage = parseInt(e.target.value);
        currentPage = 1;
        if (vocabulary.length > 0) {
            displayCurrentPage();
        }
    });
    
    // Page navigation
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));
    prevPageBtnBottom.addEventListener('click', () => changePage(-1));
    nextPageBtnBottom.addEventListener('click', () => changePage(1));
    
    // Modal close
    closeModal.addEventListener('click', () => {
        passagesModal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === passagesModal) {
            passagesModal.style.display = 'none';
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (vocabulary.length === 0) return;
        
        if (e.key === 'ArrowLeft') {
            changePage(-1);
        } else if (e.key === 'ArrowRight') {
            changePage(1);
        } else if (e.key === 'Escape' && passagesModal.style.display === 'block') {
            passagesModal.style.display = 'none';
        }
    });
}

function updatePartSelector() {
    const selectedSet = parseInt(setSelect.value);
    const partsCount = PARTS[selectedSet - 1] || 1;
    
    partSelect.innerHTML = '';
    for (let i = 1; i <= partsCount; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Part ${i}`;
        partSelect.appendChild(option);
    }
}

async function loadVocabulary() {
    currentSet = parseInt(setSelect.value);
    currentPart = parseInt(partSelect.value);
    
    const csvPath = `./Set ${currentSet}/Part ${currentPart}/sentences.csv`;
    
    try {
        const response = await fetch(csvPath);
        if (!response.ok) {
            throw new Error(`Could not load ${csvPath}`);
        }
        
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        if (rows.length === 0) {
            alert('No data found in CSV file');
            return;
        }
        
        // Check if first row is header (contains 'id' or 'english' or 'type')
        const firstRow = rows[0];
        const isHeader = firstRow.some(cell => 
            cell.toLowerCase().includes('id') || 
            cell.toLowerCase().includes('english') || 
            cell.toLowerCase().includes('type')
        );
        
        const startIndex = isHeader ? 1 : 0;
        
        vocabulary = [];
        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 6) {
                vocabulary.push({
                    id: row[0] || '',
                    english: row[1] || '',
                    type: row[2] || '',
                    chinese: row[3] || '',
                    sentence1: row[4] || '',
                    sentence2: row[5] || '',
                    sentence3: row[6] || ''
                });
            } else if (row.length >= 4) {
                // Handle case with fewer columns
                vocabulary.push({
                    id: row[0] || '',
                    english: row[1] || '',
                    type: row[2] || '',
                    chinese: row[3] || '',
                    sentence1: row[4] || '',
                    sentence2: row[5] || '',
                    sentence3: ''
                });
            }
        }
        
        console.log(`Loaded ${vocabulary.length} words`);
        
        if (vocabulary.length > 0) {
            currentPage = 1;
            displayCurrentPage();
            pageContainer.style.display = 'block';
            statsDiv.style.display = 'flex';
            showPassagesBtn.style.display = 'inline-block';
            updateStats();
        } else {
            alert('No vocabulary data found in CSV file. Please check the format.');
        }
    } catch (error) {
        console.error('Error loading CSV:', error);
        alert(`Error loading vocabulary from:\n${csvPath}\n\nPlease make sure the file exists and has the correct format.\n\nError: ${error.message}`);
    }
}

function displayCurrentPage() {
    const startIdx = (currentPage - 1) * wordsPerPage;
    const endIdx = Math.min(startIdx + wordsPerPage, vocabulary.length);
    const pageWords = vocabulary.slice(startIdx, endIdx);
    
    wordsList.innerHTML = '';
    
    pageWords.forEach((word, idx) => {
        const wordIndex = startIdx + idx;
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-item';
        wordDiv.setAttribute('data-index', wordIndex);
        
        wordDiv.innerHTML = `
            <div class="word-header">
                <span class="english-word">${escapeHtml(word.english)}</span>
                <button class="speaker-btn" data-word="${escapeHtml(word.english)}" data-index="${wordIndex}">
                    🔊
                </button>
                <span class="word-type">${escapeHtml(word.type)}</span>
            </div>
            <div class="chinese-meaning">${escapeHtml(word.chinese)}</div>
            <div class="sentences-section">
                <div class="sentence">
                    <span class="sentence-label">📝 Sentence 1:</span> ${escapeHtml(word.sentence1)}
                </div>
                <div class="sentence">
                    <span class="sentence-label">📝 Sentence 2:</span> ${escapeHtml(word.sentence2)}
                </div>
                ${word.sentence3 ? `<div class="sentence"><span class="sentence-label">📝 Sentence 3:</span> ${escapeHtml(word.sentence3)}</div>` : ''}
            </div>
        `;
        
        wordsList.appendChild(wordDiv);
    });
    
    // Add audio listeners to all speaker buttons
    addAudioListeners();
    
    updateStats();
    updateNavigationButtons();
}

function addAudioListeners() {
    const speakerButtons = document.querySelectorAll('.speaker-btn');
    
    speakerButtons.forEach(btn => {
        btn.removeEventListener('click', handleSpeak);
        btn.addEventListener('click', handleSpeak);
    });
}

function handleSpeak(event) {
    const word = event.currentTarget.getAttribute('data-word');
    speakWord(word);
}

function speakWord(word) {
    synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    synth.speak(utterance);
}

async function showPassages() {
    const csvPath = `./Set ${currentSet}/Part ${currentPart}/passages.csv`;
    
    passagesContainer.innerHTML = '<div class="loading">📖 Loading passages...</div>';
    passagesModal.style.display = 'block';
    
    try {
        const response = await fetch(csvPath);
        if (!response.ok) {
            throw new Error(`Could not load ${csvPath}`);
        }
        
        const csvText = await response.text();
        displayPassages(csvText);
    } catch (error) {
        console.error('Error loading passages:', error);
        passagesContainer.innerHTML = `
            <div class="error-message">
                ⚠️ Could not load passages from:<br>
                ${csvPath}<br><br>
                Please make sure the file exists with format:<br>
                passage id, title, content<br><br>
                Error: ${error.message}
            </div>
        `;
    }
}

function displayPassages(csvText) {
    const rows = parseCSV(csvText);
    
    if (rows.length === 0) {
        passagesContainer.innerHTML = '<div class="error-message">No passages found in the CSV file.</div>';
        return;
    }
    
    // Check if first row is header
    const firstRow = rows[0];
    const isHeader = firstRow.some(cell => 
        cell.toLowerCase().includes('passage id') || 
        cell.toLowerCase().includes('title') || 
        cell.toLowerCase().includes('content')
    );
    
    const startIndex = isHeader ? 1 : 0;
    const passages = [];
    
    for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 3) {
            passages.push({
                id: row[0],
                title: row[1],
                content: row[2]
            });
        } else if (row.length === 2) {
            passages.push({
                id: row[0],
                title: row[1],
                content: ''
            });
        }
    }
    
    if (passages.length === 0) {
        passagesContainer.innerHTML = '<div class="error-message">No passages found in the CSV file.</div>';
        return;
    }
    
    passagesContainer.innerHTML = '';
    
    passages.forEach(passage => {
        const passageDiv = document.createElement('div');
        passageDiv.className = 'passage-item';
        
        passageDiv.innerHTML = `
            <div class="passage-title">
                <span>${escapeHtml(passage.title)}</span>
                <span class="passage-id">ID: ${escapeHtml(passage.id)}</span>
            </div>
            <div class="passage-content">${escapeHtml(passage.content).replace(/\n/g, '<br>')}</div>
        `;
        
        passagesContainer.appendChild(passageDiv);
    });
}

function changePage(delta) {
    const totalPages = Math.ceil(vocabulary.length / wordsPerPage);
    const newPage = currentPage + delta;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayCurrentPage();
        pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updateNavigationButtons() {
    const totalPages = Math.ceil(vocabulary.length / wordsPerPage);
    
    const prevDisabled = currentPage === 1;
    const nextDisabled = currentPage === totalPages;
    
    prevPageBtn.disabled = prevDisabled;
    nextPageBtn.disabled = nextDisabled;
    prevPageBtnBottom.disabled = prevDisabled;
    nextPageBtnBottom.disabled = nextDisabled;
    
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
}

function updateStats() {
    totalWordsSpan.textContent = vocabulary.length;
    const totalPages = Math.ceil(vocabulary.length / wordsPerPage);
    totalPagesSpan.textContent = totalPages;
    currentPageSpan.textContent = currentPage;
    
    if (vocabulary.length > 0) {
        const startIdx = (currentPage - 1) * wordsPerPage + 1;
        const endIdx = Math.min(currentPage * wordsPerPage, vocabulary.length);
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages} (${startIdx}-${endIdx} of ${vocabulary.length} words)`;
    } else {
        pageIndicator.textContent = `Page 0 of 0`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start the application
initializeSelectors();