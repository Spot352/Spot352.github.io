// Configuration
const SETS = 7;
const PARTS = [5, 3, 3, 3, 2, 1, 1];

// Global variables
let vocabulary = [];
let selectedVocabulary = [];
let currentQuestion = null;
let score = {
    correct: 0,
    total: 0,
    answers: []
};
let currentQuestionIndex = 0;
let questions = [];
let answered = false;
let remainingWords = new Set();

// DOM elements
const setSelect = document.getElementById('setSelect');
const partSelect = document.getElementById('partSelect');
const startIndexInput = document.getElementById('startIndex');
const endIndexInput = document.getElementById('endIndex');
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
const answerInput = document.getElementById('answerInput');
const rangeText = document.getElementById('rangeText');

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
    
    checkBtn.addEventListener('click', checkAnswer);
    
    nextBtn.addEventListener('click', nextQuestion);
    
    restartBtn.addEventListener('click', () => {
        resetPractice();
        generateQuestions();
        loadQuestion();
        reviewSection.style.display = 'none';
    });
    
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !answered) {
            checkAnswer();
        }
    });
    
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
    const startIndex = parseInt(startIndexInput.value);
    const endIndex = parseInt(endIndexInput.value);
    const csvPath = `./Set ${currentSet}/Part ${currentPart}/sentences.csv`;
    
    if (isNaN(startIndex) || isNaN(endIndex) || startIndex < 1 || endIndex < 1) {
        alert('Please enter valid start and end indices (minimum 1).');
        return;
    }
    
    if (startIndex > endIndex) {
        alert('Start index must be less than or equal to end index.');
        return;
    }
    
    try {
        const response = await fetch(csvPath);
        if (!response.ok) {
            throw new Error(`Could not load ${csvPath}`);
        }
        
        const csvText = await response.text();
        parseCSV(csvText, startIndex, endIndex);
        
        if (selectedVocabulary.length > 0) {
            resetPractice();
            generateQuestions();
            practiceArea.style.display = 'block';
            rangeText.textContent = `${startIndex}-${endIndex}`;
            loadQuestion();
        } else {
            alert(`No vocabulary data found in range ${startIndex}-${endIndex}. Check the indices.`);
        }
    } catch (error) {
        console.error('Error loading CSV:', error);
        alert(`Error loading vocabulary from:\n${csvPath}\n\nError: ${error.message}`);
    }
}

function parseCSV(csvText, startIndex, endIndex) {
    const rows = parseCSVLines(csvText);
    
    if (rows.length === 0) {
        vocabulary = [];
        selectedVocabulary = [];
        return;
    }
    
    const firstRow = rows[0];
    const isHeader = firstRow.some(cell => 
        cell.toLowerCase().includes('id') || 
        cell.toLowerCase().includes('english') || 
        cell.toLowerCase().includes('type')
    );
    
    const startRow = isHeader ? 1 : 0;
    
    vocabulary = [];
    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 4) {
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
    
    selectedVocabulary = [];
    for (let i = 0; i < vocabulary.length; i++) {
        const wordIndex = i + 1;
        if (wordIndex >= startIndex && wordIndex <= endIndex) {
            selectedVocabulary.push(vocabulary[i]);
        }
    }
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
            result.push(currentField.trim());
            currentField = '';
            i++;
            continue;
        }
        
        currentField += char;
        i++;
    }
    
    result.push(currentField.trim());
    
    return result;
}

function generateQuestions() {
    questions = [...selectedVocabulary];
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    currentQuestionIndex = 0;
    
    remainingWords.clear();
    selectedVocabulary.forEach(word => {
        remainingWords.add(word.english);
    });
}

function loadQuestion() {
    if (currentQuestionIndex >= questions.length || remainingWords.size === 0) {
        completePractice();
        return;
    }
    
    currentQuestion = questions[currentQuestionIndex];
    answered = false;
    answerInput.value = '';
    answerInput.disabled = false;
    answerInput.focus();
    
    questionText.innerHTML = `What is the English word for?`;
    const existingDisplay = questionText.querySelector('.chinese-display');
    if (existingDisplay) existingDisplay.remove();
    
    const chineseDiv = document.createElement('div');
    chineseDiv.className = 'chinese-display';
    chineseDiv.innerHTML = escapeHtml(currentQuestion.chinese);
    questionText.appendChild(chineseDiv);
    
    hintArea.innerHTML = `
        <div class="sentence-hint">
            ${currentQuestion.type ? `<p>📖 <strong>Word type:</strong> ${escapeHtml(currentQuestion.type)}</p>` : ''}
            ${currentQuestion.sentence1 ? `<p>💡 <strong>Hint:</strong> Hint Removed After Version 4. </p>` : ''}
        </div>
    `;
    
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
    
    const correctAnswer = currentQuestion.english;
    const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    
    if (isCorrect) {
        score.correct++;
        showFeedback(`✓ Correct! "${correctAnswer}" is right!`, 'correct');
        
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
        correctAnswer: correctAnswer
    });
    
    updateStats();
    
    answered = true;
    checkBtn.style.display = 'none';
    nextBtn.style.display = 'inline-block';
    answerInput.disabled = true;
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length && remainingWords.size > 0) {
        loadQuestion();
    } else if (remainingWords.size > 0) {
        const remainingWordsList = selectedVocabulary.filter(word => remainingWords.has(word.english));
        if (remainingWordsList.length > 0) {
            questions = [...remainingWordsList];
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
    
    updateScoreColor(finalCorrectSpan, (score.correct / score.total * 100));
    updateScoreColor(finalAccuracySpan, accuracy);
    
    const wrongAnswers = score.answers.filter(a => !a.correct);
    if (wrongAnswers.length === 0) {
        reviewList.innerHTML = '<p style="padding:20px;">🎉 Perfect! No words to review! 🎉</p>';
    } else {
        reviewList.innerHTML = '';
        wrongAnswers.forEach(answer => {
            const item = document.createElement('div');
            item.className = 'review-item wrong';
            item.innerHTML = `
                <span class="review-word">${escapeHtml(answer.word.chinese)}</span>
                <span class="review-meaning">${escapeHtml(answer.word.english)}</span>
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
    
    updateScoreColor(accuracySpan, accuracy);
    updateScoreColor(correctCountSpan, accuracy);
    
    const totalQuestions = selectedVocabulary.length;
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

initializeSelectors();