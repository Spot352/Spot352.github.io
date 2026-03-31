// Configuration
const SETS = 1;
const PARTS = [4];

// Global variables
let vocabulary = [];
let currentQuestion = null;
let currentMode = 'random'; // 'random', 'chinese', 'english'
let score = {
    correct: 0,
    total: 0,
    answers: [] // Store which words were answered correctly/incorrectly
};
let currentQuestionIndex = 0;
let questions = [];
let answered = false;
let remainingWords = new Set(); // Track words not yet answered correctly
let currentQuestionType = 'chinese'; // Track current question type

// DOM elements
const setSelect = document.getElementById('setSelect');
const partSelect = document.getElementById('partSelect');
const loadBtn = document.getElementById('loadBtn');
const practiceArea = document.getElementById('practiceArea');
const correctCountSpan = document.getElementById('correctCount');
const totalAnsweredSpan = document.getElementById('totalAnswered');
const accuracySpan = document.getElementById('accuracy');
const remainingCountSpan = document.getElementById('remainingCount');
const progressBar = document.getElementById('progressBar');
const questionText = document.getElementById('questionText');
const hintArea = document.getElementById('hintArea');
const feedbackArea = document.getElementById('feedbackArea');
const checkBtn = document.getElementById('checkBtn');
const nextBtn = document.getElementById('nextBtn');
const reviewSection = document.getElementById('reviewSection');
const finalCorrectSpan = document.getElementById('finalCorrect');
const finalTotalSpan = document.getElementById('finalTotal');
const finalAccuracySpan = document.getElementById('finalAccuracy');
const reviewList = document.getElementById('reviewList');
const restartBtn = document.getElementById('restartBtn');
const randomIndicator = document.getElementById('randomIndicator');
const answerInput = document.getElementById('answerInput');

// Function to update score color based on percentage
function updateScoreColor(element, percentage) {
    element.classList.remove('excellent', 'good', 'average', 'poor');
    
    if (percentage >= 95) {
        element.classList.add('excellent');
    } else if (percentage >= 90) {
        element.classList.add('good');
    } else if (percentage >= 75) {
        element.classList.add('average');
    } else {
        element.classList.add('poor');
    }
}

// Function to check Chinese text similarity (60% match required)
function isChineseMatch(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;
    
    // Exact match
    if (userAnswer === correctAnswer) return true;
    
    // Check for synonyms or common variations
    const synonyms = {
        '反的': ['相反的', '对立', '反面'],
        '相反的': ['反的', '对立', '反面'],
        '快乐': ['高兴', '愉快', '开心'],
        '高兴': ['快乐', '愉快', '开心'],
        '美丽': ['漂亮', '好看', '秀丽'],
        '漂亮': ['美丽', '好看', '秀丽'],
        '大': ['巨大', '庞大'],
        '小': ['细小', '微小'],
        '好': ['良好', '优秀'],
        '坏': ['糟糕', '差'],
        '快速': ['迅速', '飞快'],
        '慢': ['缓慢', '迟缓']
    };
    
    // Check if user answer matches any synonym of correct answer
    if (synonyms[correctAnswer] && synonyms[correctAnswer].includes(userAnswer)) {
        return true;
    }
    
    // Check if correct answer is in user answer (for longer phrases)
    if (correctAnswer.length > 2 && userAnswer.includes(correctAnswer)) {
        return true;
    }
    
    // Check if user answer is in correct answer (for longer phrases)
    if (userAnswer.length > 2 && correctAnswer.includes(userAnswer)) {
        return true;
    }
    
    // Calculate similarity percentage
    const similarity = calculateSimilarity(userAnswer, correctAnswer);
    return similarity >= 0.6; // 60% match required
}

// Simple string similarity calculation
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance for similarity calculation
function levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

// Initialize
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
    
    // Mode switching
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (vocabulary.length === 0) return;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.getAttribute('data-mode');
            
            // Show/hide random indicator
            if (currentMode === 'random') {
                randomIndicator.style.display = 'inline-block';
            } else {
                randomIndicator.style.display = 'none';
            }
            
            resetPractice();
            generateQuestions();
            loadQuestion();
        });
    });
    
    // Check button
    checkBtn.addEventListener('click', checkAnswer);
    
    // Next button
    nextBtn.addEventListener('click', nextQuestion);
    
    // Restart button
    restartBtn.addEventListener('click', () => {
        resetPractice();
        generateQuestions();
        loadQuestion();
        reviewSection.style.display = 'none';
    });
    
    // Enter key on input
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !answered) {
            checkAnswer();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (practiceArea.style.display === 'none') return;
        if (reviewSection.style.display === 'block') return;
        
        if (e.key === 'Enter' && document.activeElement !== answerInput) {
            e.preventDefault();
            checkAnswer();
        } else if (e.key === 'ArrowRight' && answered) {
            nextQuestion();
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
    const currentSet = parseInt(setSelect.value);
    const currentPart = parseInt(partSelect.value);
    const csvPath = `./Set ${currentSet}/Part ${currentPart}/sentences.csv`;
    
    try {
        const response = await fetch(csvPath);
        if (!response.ok) {
            throw new Error(`Could not load ${csvPath}`);
        }
        
        const csvText = await response.text();
        parseCSV(csvText);
        
        if (vocabulary.length > 0) {
            resetPractice();
            generateQuestions();
            practiceArea.style.display = 'block';
            if (currentMode === 'random') {
                randomIndicator.style.display = 'inline-block';
            }
            loadQuestion();
        } else {
            alert('No vocabulary data found in CSV file');
        }
    } catch (error) {
        console.error('Error loading CSV:', error);
        alert(`Error loading vocabulary from:\n${csvPath}\n\nError: ${error.message}`);
    }
}

function parseCSV(csvText) {
    const rows = parseCSVLines(csvText);
    
    if (rows.length === 0) {
        vocabulary = [];
        return;
    }
    
    // Check if first row is header
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
        if (row.length >= 4) {
            // Trim each field individually
            vocabulary.push({
                id: (row[0] || '').trim(),
                english: (row[1] || '').trim(),
                type: (row[2] || '').trim(),
                chinese: (row[3] || '').trim(),
                sentence1: (row[4] || '').trim(),
                sentence2: (row[5] || '').trim(),
                sentence3: (row[6] || '').trim()
            });
        }
    }
    
    console.log(`Loaded ${vocabulary.length} words`);
}

function parseCSVLines(csvText) {
    const lines = csvText.split(/\r?\n/);
    const data = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        
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

function generateQuestions() {
    // Create a queue of questions that repeats until all words are mastered
    questions = [...vocabulary];
    // Shuffle questions for random order
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    currentQuestionIndex = 0;
    
    // Initialize remaining words (all words start as not mastered)
    remainingWords.clear();
    vocabulary.forEach(word => {
        remainingWords.add(word.english);
    });
}

function loadQuestion() {
    // Check if we've completed all questions or all words are mastered
    if (currentQuestionIndex >= questions.length || remainingWords.size === 0) {
        completePractice();
        return;
    }
    
    currentQuestion = questions[currentQuestionIndex];
    answered = false;
    answerInput.value = '';
    answerInput.focus();
    
    // Determine question type based on mode
    if (currentMode === 'random') {
        // Randomly choose between Chinese->English and English->Chinese
        currentQuestionType = Math.random() < 0.5 ? 'chinese' : 'english';
    } else if (currentMode === 'chinese') {
        currentQuestionType = 'chinese';
    } else {
        currentQuestionType = 'english';
    }
    
    // Display question
    if (currentQuestionType === 'chinese') {
        questionText.innerHTML = `What is the English word for?`;
        const chineseDiv = document.createElement('div');
        chineseDiv.className = 'chinese-display';
        chineseDiv.innerHTML = escapeHtml(currentQuestion.chinese);
        // Clear and add new content
        const existingDisplay = questionText.querySelector('.chinese-display, .english-display');
        if (existingDisplay) existingDisplay.remove();
        questionText.appendChild(chineseDiv);
        
        hintArea.innerHTML = `
            <div class="sentence-hint">
                <p>💡 <strong>Example sentence:</strong></p>
                <p>${escapeHtml(currentQuestion.sentence1)}</p>
                ${currentQuestion.type ? `<p>📖 <strong>Word type:</strong> ${escapeHtml(currentQuestion.type)}</p>` : ''}
            </div>
        `;
    } else if (currentQuestionType === 'english') {
        questionText.innerHTML = `What is the Chinese meaning of?`;
        const englishDiv = document.createElement('div');
        englishDiv.className = 'english-display';
        englishDiv.innerHTML = escapeHtml(currentQuestion.english);
        const existingDisplay = questionText.querySelector('.chinese-display, .english-display');
        if (existingDisplay) existingDisplay.remove();
        questionText.appendChild(englishDiv);
        
        hintArea.innerHTML = `
            <div class="sentence-hint">
                <p>💡 <strong>Example sentence:</strong></p>
                <p>${escapeHtml(currentQuestion.sentence1)}</p>
                ${currentQuestion.type ? `<p>📖 <strong>Word type:</strong> ${escapeHtml(currentQuestion.type)}</p>` : ''}
            </div>
        `;
    }
    
    // Reset UI
    feedbackArea.style.display = 'none';
    nextBtn.style.display = 'none';
    checkBtn.style.display = 'inline-block';
}

function checkAnswer() {
    if (answered) return;
    
    const userAnswer = answerInput.value.trim();
    
    if (!userAnswer) {
        showFeedback('Please type an answer!', 'wrong');
        document.querySelector('.question-card').classList.add('shake');
        setTimeout(() => {
            document.querySelector('.question-card').classList.remove('shake');
        }, 300);
        return;
    }
    
    let correctAnswer = '';
    let isCorrect = false;
    
    if (currentQuestionType === 'chinese') {
        correctAnswer = currentQuestion.english;
        // Case insensitive comparison for English
        isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    } else {
        correctAnswer = currentQuestion.chinese;
        // Fuzzy matching for Chinese (60% threshold)
        isCorrect = isChineseMatch(userAnswer, correctAnswer);
    }
    
    // Update score
    if (isCorrect) {
        score.correct++;
        showFeedback(`✓ Correct! "${correctAnswer}" is right!`, 'correct');
        
        // Remove from remaining words if mastered
        if (remainingWords.has(currentQuestion.english)) {
            remainingWords.delete(currentQuestion.english);
        }
    } else {
        showFeedback(`✗ Wrong! The correct answer is "${correctAnswer}"`, 'wrong');
    }
    
    score.total++;
    score.answers.push({
        word: currentQuestion,
        correct: isCorrect,
        userAnswer: userAnswer,
        correctAnswer: correctAnswer,
        questionType: currentQuestionType
    });
    
    updateStats();
    
    answered = true;
    checkBtn.style.display = 'none';
    nextBtn.style.display = 'inline-block';
    answerInput.disabled = true;
}

function nextQuestion() {
    currentQuestionIndex++;
    answerInput.disabled = false;
    if (currentQuestionIndex < questions.length && remainingWords.size > 0) {
        loadQuestion();
    } else if (remainingWords.size > 0) {
        // If we still have remaining words but ran out of questions, generate new round with remaining words
        const remainingWordsList = vocabulary.filter(word => remainingWords.has(word.english));
        if (remainingWordsList.length > 0) {
            questions = [...remainingWordsList];
            // Shuffle
            for (let i = questions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [questions[i], questions[j]] = [questions[j], questions[i]];
            }
            currentQuestionIndex = 0;
            loadQuestion();
        } else {
            completePractice();
        }
    } else {
        completePractice();
    }
}

function completePractice() {
    const accuracy = score.total > 0 ? (score.correct / score.total * 100) : 0;
    
    finalCorrectSpan.textContent = score.correct;
    finalTotalSpan.textContent = score.total;
    finalAccuracySpan.textContent = accuracy.toFixed(1);
    
    // Update score colors in final stats
    updateScoreColor(finalCorrectSpan, (score.correct / score.total * 100));
    updateScoreColor(finalAccuracySpan, accuracy);
    
    // Generate review list
    const wrongAnswers = score.answers.filter(a => !a.correct);
    if (wrongAnswers.length === 0) {
        reviewList.innerHTML = '<p style="padding:20px;">🎉 Perfect! No words to review! 🎉</p>';
    } else {
        reviewList.innerHTML = '';
        wrongAnswers.forEach(answer => {
            const item = document.createElement('div');
            item.className = 'review-item wrong';
            item.innerHTML = `
                <span class="review-word">${escapeHtml(answer.word.english)}</span>
                <span class="review-meaning">${escapeHtml(answer.word.chinese)}</span>
                <span class="review-answer">You answered: ${escapeHtml(answer.userAnswer)}</span>
            `;
            reviewList.appendChild(item);
        });
    }
    
    practiceArea.querySelector('.question-card').style.display = 'none';
    reviewSection.style.display = 'block';
}

function resetPractice() {
    score = {
        correct: 0,
        total: 0,
        answers: []
    };
    currentQuestionIndex = 0;
    answered = false;
    answerInput.disabled = false;
    updateStats();
    practiceArea.querySelector('.question-card').style.display = 'block';
    reviewSection.style.display = 'none';
}

function updateStats() {
    const accuracy = score.total > 0 ? (score.correct / score.total * 100) : 0;
    
    correctCountSpan.textContent = score.correct;
    totalAnsweredSpan.textContent = score.total;
    accuracySpan.textContent = accuracy.toFixed(1);
    remainingCountSpan.textContent = remainingWords.size;
    
    // Update colors based on accuracy
    updateScoreColor(accuracySpan, accuracy);
    updateScoreColor(correctCountSpan, accuracy);
    
    const totalQuestions = vocabulary.length;
    const answeredCount = score.total;
    const progress = totalQuestions > 0 ? (answeredCount / totalQuestions * 100) : 0;
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${Math.round(progress)}%`;
}

function showFeedback(message, type) {
    feedbackArea.textContent = message;
    feedbackArea.className = `feedback-area feedback-${type}`;
    feedbackArea.style.display = 'block';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start the application
initializeSelectors();