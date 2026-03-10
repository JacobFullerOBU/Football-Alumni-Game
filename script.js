// Global variable to hold CSV player data
let csvPlayers = [];

// CSV loader function using Papa.parse
async function loadPlayersFromCSV() {
    return new Promise((resolve, reject) => {
        Papa.parse('players_with_images.csv', {
            download: true,
            header: true,
            complete: function(results) {
                csvPlayers = results.data;
                resolve();
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

// --- Restructure: All DOM-dependent code inside DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const scoreElement = document.getElementById('score');
    const correctCountElement = document.getElementById('correct-count');
    const incorrectCountElement = document.getElementById('incorrect-count');
    const totalCountElement = document.getElementById('total-count');
    const guessesLeftElement = document.getElementById('guesses-left');
    const playerImgElement = document.getElementById('player-img');
    const playerNameElement = document.getElementById('player-name');
    const guessInputElement = document.getElementById('guess-input');
    const collegeDropdownElement = document.getElementById('college-dropdown');
    const submitGuessButton = document.getElementById('submit-guess');
    const passButton = document.getElementById('pass-button');
    const feedbackElement = document.getElementById('feedback');
    const previousGuessesElement = document.getElementById('previous-guesses');
    const nextPlayerButton = document.getElementById('next-player');
    const restartGameButton = document.getElementById('restart-game');
    const gameOverElement = document.getElementById('game-over');
    const finalScoreElement = document.getElementById('final-score');
    const playAgainButton = document.getElementById('play-again');

    // Add event listeners for submit and pass buttons
    submitGuessButton.addEventListener('click', submitGuess);
    passButton.addEventListener('click', passPlayer);

    // Enter key support for guess input
    guessInputElement.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            submitGuessButton.click();
        }
    });

    // Dropdown functionality for college search
    guessInputElement.addEventListener('input', function(e) {
        const filter = e.target.value;
        if (filter.length > 0) {
            populateCollegeDropdown(filter);
        } else {
            collegeDropdownElement.classList.add('hidden');
        }
    });

    guessInputElement.addEventListener('focus', function(e) {
        if (e.target.value.length > 0) {
            populateCollegeDropdown(e.target.value);
        }
    });

    guessInputElement.addEventListener('blur', hideDropdown);
    nextPlayerButton.addEventListener('click', loadNextPlayer);
    restartGameButton.addEventListener('click', function() {
        if (confirm('Are you sure you want to restart the game? Your current progress will be lost.')) {
            initGame();
        }
    });
    playAgainButton.addEventListener('click', initGame);
    playerImgElement.addEventListener('error', function() {
        this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTAwIDEwMEM4MS4wNDI5IDEwMCA2NiA4NC45NTcxIDY2IDY2QzY2IDQ3LjA0MjkgODEuMDQyOSAzMiAxMDAgMzJDMTE4Ljk1NyAzMiAxMzQgNDcuMDQyOSAxMzQgNjZDMTM0IDg0Ljk1NzEgMTE4Ljk1NyAxMDAgMTAwIDEwMFpNMTAwIDEzNEM4MS4wNDI5IDEzNCA2NiAxNDkuMDQzIDY2IDE2OEg0NkM0NiAxMzguMDcyIDcwLjA3MjEgMTE0IDEwMCAxMTRDMTI5LjkyOCAxMTQgMTU0IDEzOC4wNzIgMTU0IDE2OEgxMzRDMTM0IDE0OS4wNDMgMTE4Ljk1NyAxMzQgMTAwIDEzNFoiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+';
    });
    // ...existing code...
});

// Helper function to generate player image URL
function generatePlayerImageURL(playerName) {
    // Generate player initials
    const initials = playerName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2); // Use first 2 initials
    
    // Generate a consistent color based on the name
    let hash = 0;
    for (let i = 0; i < playerName.length; i++) {
        hash = playerName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate HSL color with good contrast
    const hue = Math.abs(hash % 360);
    const saturation = 65;
    const lightness = 45;
    
    // Create SVG with initials
    const svg = `
        <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="hsl(${hue}, ${saturation}%, ${lightness}%)"/>
            <text x="100" y="100" font-family="Arial, sans-serif" font-size="60" font-weight="bold" 
                  text-anchor="middle" dominant-baseline="central" fill="white">
                ${initials}
            </text>
        </svg>
    `.trim();
    
    // Return as data URL
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

// --- FILTER LOGIC ---
let filteredPlayers = [];

function applyFilters() {
    const timePeriod = document.getElementById('time-period-filter').value;
    const difficulty = document.getElementById('difficulty-filter').value;
    filteredPlayers = csvPlayers.filter(player => {
        // Treat missing values as 'all'
        let playerTime = player.time_period ? player.time_period : 'all';
        let playerDifficulty = player.difficulty ? player.difficulty : 'all';
        let matchTime = (timePeriod === 'all' || playerTime === timePeriod || playerTime === 'all');
        let matchDifficulty = (difficulty === 'all' || playerDifficulty === difficulty || playerDifficulty === 'all');
        return matchTime && matchDifficulty;
    });
}

// Update uniqueColleges for dropdown
let uniqueColleges = [];
// --- Ensure mode buttons are enabled after CSV loads ---
async function initGame() {
    await loadPlayersFromCSV();
    uniqueColleges = [...new Set(csvPlayers.map(player => player.college))].sort();
    score = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalPlayers = 0;
    usedPlayers = [];
    gameActive = true;
    gameOverElement.classList.add('hidden');
    document.getElementById('mode-selection').style.display = '';
    document.getElementById('game-container').style.display = 'none';
    updateScore();
    updateRunningScore();
    // Enable mode buttons (guaranteed)
    setTimeout(() => {
        document.querySelectorAll('.mode-btn').forEach(btn => btn.disabled = false);
    }, 100);
}

// Disable mode buttons until CSV is loaded
window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.disabled = true);
});

function startGame(selectedModeKey) {
    console.log('startGame called with mode:', selectedModeKey);
    applyFilters();
    if (!filteredPlayers || filteredPlayers.length === 0) {
        alert('No players match your selected filters. Please try a different combination.');
        return;
    }
    currentMode = gameModes[selectedModeKey];
    currentLives = currentMode.startingLives;
    document.getElementById('mode-selection').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    score = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalPlayers = 0;
    usedPlayers = [];
    gameActive = true;
    updateScore();
    updateRunningScore();
    loadNewPlayer();
}

function startTimer() {
    if (currentMode.timeLimit === null) return;
    let timeLeft = currentMode.timeLimit;
    const timerDisplay = document.getElementById("timer-display");
    timerDisplay.innerText = `Time: ${timeLeft}s`;
    clearInterval(timerInterval);
    timerDisplay.classList.remove('urgent');
    timerDisplay.innerText = `${timeLeft}`;
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = `${timeLeft}`;
        if (timeLeft <= 5) {
            timerDisplay.classList.add('urgent');
        } else {
            timerDisplay.classList.remove('urgent');
        }
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (!guessInputElement.disabled) {
                handleWrongAnswer();
            }
        }
    }, 1000);
}

function updateScoreBoard() {
    updateScore();
    updateRunningScore();
    // Update lives display if you want (add to HTML if needed)
}

function handleWrongAnswer() {
    currentLives--;
    updateScoreBoard();
    if (currentLives <= 0) {
        clearInterval(timerInterval);
        triggerGameOver();
    } else {
        if (currentMode.globalLives) {
            alert(`Wrong! It was ${currentPlayer.college}`);
            loadNewPlayer();
        }
    }
}

function triggerGameOver() {
    gameActive = false;
    clearInterval(timerInterval);
    finalScoreElement.textContent = score;
    document.querySelector('.game-area').classList.add('hidden');
    gameOverElement.classList.remove('hidden');
    document.getElementById('timer-display').innerText = '';
}

function loadNewPlayer() {
    if (usedPlayers.length >= filteredPlayers.length) {
        triggerGameOver();
        return;
    }
    guessesLeft = currentMode.globalLives ? currentLives : currentMode.startingLives;
    previousGuesses = [];
    let availablePlayers = filteredPlayers.filter((_, index) => !usedPlayers.includes(index));
    let randomIndex = Math.floor(Math.random() * availablePlayers.length);
    currentPlayer = availablePlayers[randomIndex];
    let originalIndex = filteredPlayers.findIndex(p => p.name === currentPlayer.name);
    usedPlayers.push(originalIndex);
    playerNameElement.textContent = currentPlayer.name;
    playerImgElement.src = currentPlayer.image || generatePlayerImageURL(currentPlayer.name);
    playerImgElement.alt = currentPlayer.name;
    updateGuessesLeft();
    clearFeedback();
    enableGuessing();
    nextPlayerButton.classList.add('hidden');
    restartGameButton.classList.add('hidden');
    updateScoreBoard();
    startTimer();
}

// Update score display
function updateScore() {
    scoreElement.textContent = score;
}

// Update running score display
function updateRunningScore() {
    correctCountElement.textContent = correctAnswers;
    incorrectCountElement.textContent = incorrectAnswers;
    totalCountElement.textContent = totalPlayers;
}

// Update guesses left display
function updateGuessesLeft() {
    guessesLeftElement.textContent = guessesLeft;
}

// Load next player
// Alias for compatibility
function loadNextPlayer() {
    loadNewPlayer();
}

// Clear feedback section
function clearFeedback() {
    feedbackElement.textContent = '';
    feedbackElement.className = 'feedback';
    previousGuessesElement.textContent = '';
}

// Populate college dropdown
function populateCollegeDropdown(filter = '') {
    collegeDropdownElement.innerHTML = '';
    
    const filteredColleges = uniqueColleges.filter(college => 
        college.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filteredColleges.length === 0) {
        collegeDropdownElement.classList.add('hidden');
        return;
    }
    
    filteredColleges.slice(0, 10).forEach(college => { // Limit to 10 results
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.textContent = college;
        option.addEventListener('click', () => selectCollege(college));
        collegeDropdownElement.appendChild(option);
    });
    
    collegeDropdownElement.classList.remove('hidden');
}

// Select college from dropdown
function selectCollege(college) {
    guessInputElement.value = college;
    collegeDropdownElement.classList.add('hidden');
    guessInputElement.focus();
}

// Hide dropdown
function hideDropdown() {
    setTimeout(() => { // Delay to allow click events on dropdown options
        collegeDropdownElement.classList.add('hidden');
    }, 150);
}

// Enable guessing input
function enableGuessing() {
    guessInputElement.disabled = false;
    submitGuessButton.disabled = false;
    passButton.disabled = false;
    guessInputElement.value = '';
    collegeDropdownElement.classList.add('hidden');
    guessInputElement.focus();
}

// Disable guessing input
function disableGuessing() {
    guessInputElement.disabled = true;
    submitGuessButton.disabled = true;
    passButton.disabled = true;
    collegeDropdownElement.classList.add('hidden');
}

// Normalize text for comparison
function normalizeText(text) {
    return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

// Check if guess is correct
function isCorrectGuess(guess, college) {
    const normalizedGuess = normalizeText(guess);
    const normalizedCollege = normalizeText(college);
    
    // Exact match
    if (normalizedGuess === normalizedCollege) {
        return true;
    }
    
    // Check if guess contains the college name or vice versa
    if (normalizedGuess.includes(normalizedCollege) || normalizedCollege.includes(normalizedGuess)) {
        return true;
    }
    
    // Handle common variations
    const collegeVariations = {
        'california': ['cal', 'uc berkeley', 'berkeley', 'university of california'],
        'southern california': ['usc', 'sc', 'university of southern california'],
        'texas tech': ['texas tech university', 'ttu'],
        'fresno state': ['california state university fresno', 'fresno state university'],
        'eastern washington': ['ewu', 'eastern washington university'],
        'louisville': ['university of louisville', 'u of l'],
        'cincinnati': ['university of cincinnati', 'uc'],
        'michigan': ['university of michigan', 'u of m'],
        'stanford': ['stanford university'],
        'alabama': ['university of alabama', 'bama', 'ua'],
        'wyoming': ['university of wyoming'],
        'tennessee': ['university of tennessee', 'ut'],
        'purdue': ['purdue university'],
        'southern mississippi': ['southern miss', 'usm'],
        'mississippi state': ['miss state', 'msu'],
        'wisconsin': ['university of wisconsin', 'uw'],
        'oklahoma': ['university of oklahoma', 'ou'],
        'lsu': ['louisiana state university', 'louisiana state'],
        'oregon': ['university of oregon', 'uo'],
        'maryland': ['university of maryland'],
        'clemson': ['clemson university'],
        'ole miss': ['university of mississippi', 'mississippi'],
        'georgia tech': ['georgia institute of technology', 'gt'],
        'pittsburgh': ['university of pittsburgh', 'pitt'],
        'marshall': ['marshall university'],
        'mississippi valley state': ['mvsu'],
        'georgia': ['university of georgia', 'uga'],
        'arizona': ['university of arizona', 'ua'],
        'iowa': ['university of iowa'],
        'kent state': ['kent state university'],
        'buffalo': ['university at buffalo', 'suny buffalo'],
        'texas a&m': ['texas am', 'tamu'],
        'boston college': ['bc'],
        'miami': ['university of miami', 'the u'],
        'usc': ['southern california', 'university of southern california'],
        'north dakota state': ['ndsu'],
        'auburn': ['auburn university'],
        'baylor': ['baylor university'],
        'florida state': ['fsu'],
        'north carolina': ['unc', 'university of north carolina'],
        'michigan state': ['msu'],
        'minnesota state': ['minnesota state university'],
        'kansas state': ['ksu'],
        'central michigan': ['cmu'],
        'eastern illinois': ['eiu'],
        'miami (oh)': ['miami university', 'miami ohio'],
        'nc state': ['north carolina state', 'ncsu'],
        'penn state': ['pennsylvania state university', 'psu'],
        'west alabama': ['university of west alabama'],
        'tcu': ['texas christian university']
    };
    
    for (let [college, variations] of Object.entries(collegeVariations)) {
        if (normalizedCollege.includes(college)) {
            for (let variation of variations) {
                if (normalizedGuess.includes(variation) || variation.includes(normalizedGuess)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// Submit guess
function submitGuess() {
    if (!gameActive || !currentPlayer) return;
    clearInterval(timerInterval); // Stop timer on guess
    const guess = guessInputElement.value.trim();
    if (!guess) return;
    
    previousGuesses.push(guess);
    guessesLeft--;
    
    if (isCorrectGuess(guess, currentPlayer.college)) {
        // Correct guess
        score += guessesLeft + 1; // More points for fewer guesses
        correctAnswers++;
        totalPlayers++;
        feedbackElement.textContent = `Correct! ${currentPlayer.name} attended ${currentPlayer.college}.`;
        feedbackElement.className = 'feedback correct';
        disableGuessing();
        nextPlayerButton.classList.remove('hidden');
        restartGameButton.classList.remove('hidden');
        // Auto-advance in global lives mode
        if (currentMode.globalLives) {
            setTimeout(() => {
                loadNewPlayer();
            }, 1200); // 1.2s delay for feedback
        }
    } else {
        // Incorrect guess
        if (guessesLeft > 0) {
            feedbackElement.textContent = `Incorrect. Try again!`;
            feedbackElement.className = 'feedback incorrect';
            previousGuessesElement.textContent = `Previous guesses: ${previousGuesses.join(', ')}`;
            guessInputElement.value = '';
        } else {
            // No guesses left
            incorrectAnswers++;
            totalPlayers++;
            feedbackElement.textContent = `No more guesses! ${currentPlayer.name} attended ${currentPlayer.college}.`;
            feedbackElement.className = 'feedback incorrect';
            disableGuessing();
            nextPlayerButton.classList.remove('hidden');
            restartGameButton.classList.remove('hidden');
        }
    }
    
    updateScore();
    updateRunningScore();
    updateGuessesLeft();
}

// Pass on current player
function passPlayer() {
    if (!gameActive || !currentPlayer) return;
    clearInterval(timerInterval); // Stop timer on pass
    // Count as incorrect
    incorrectAnswers++;
    totalPlayers++;
    // Show feedback
    feedbackElement.textContent = `Passed! ${currentPlayer.name} attended ${currentPlayer.college}.`;
    feedbackElement.className = 'feedback incorrect';
    // Disable guessing and show controls
    disableGuessing();
    nextPlayerButton.classList.remove('hidden');
    restartGameButton.classList.remove('hidden');
    // Update displays
    updateScore();
    updateRunningScore();
}

// End game
// Alias for compatibility
function endGame() {
    triggerGameOver();
}


// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', initGame);