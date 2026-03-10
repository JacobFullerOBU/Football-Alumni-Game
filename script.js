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
let players = [];
let filteredPlayers = [];

function applyFilters() {
    const timePeriod = document.getElementById('time-period-filter').value;
    const difficulty = document.getElementById('difficulty-filter').value;
    filteredPlayers = players.filter(player => {
        let matchTime = (timePeriod === 'all' || (player.time_period && player.time_period === timePeriod));
        let matchDifficulty = (difficulty === 'all' || (player.difficulty && player.difficulty === difficulty));
        return matchTime && matchDifficulty;
    });
    const countEl = document.getElementById('player-count-display');
    if (countEl && players.length > 0) {
        const n = filteredPlayers.length;
        if (n === 0) {
            countEl.textContent = 'No players match these filters.';
            countEl.className = 'player-count-display player-count-none';
        } else if (n < 8) {
            countEl.textContent = `⚠️ Only ${n} player${n !== 1 ? 's' : ''} match these filters — round will be short.`;
            countEl.className = 'player-count-display player-count-low';
        } else {
            countEl.textContent = `${n} players available`;
            countEl.className = 'player-count-display player-count-ok';
        }
    }
}

// Update loadPlayersFromCSV to parse new columns
document.addEventListener('DOMContentLoaded', () => {
    const timePeriodFilter = document.getElementById('time-period-filter');
    const difficultyFilter = document.getElementById('difficulty-filter');
    if (timePeriodFilter && difficultyFilter) {
        timePeriodFilter.addEventListener('change', applyFilters);
        difficultyFilter.addEventListener('change', applyFilters);
    }
});

async function loadPlayersFromCSV() {
    return new Promise((resolve, reject) => {
        Papa.parse('players_with_images.csv', {
            download: true,
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
            complete: results => {
                players = results.data.map(row => ({
                    name:        (row['name'] || '').trim(),
                    college:     (row['college'] || '').trim(),
                    time_period: (row['time_period'] || '').trim(),
                    difficulty:  (row['difficulty'] || '').trim(),
                    image:       (row['image_url'] || '').trim().startsWith('http')
                                     ? (row['image_url'] || '').trim()
                                     : ''
                })).filter(p => p.name);
                applyFilters();
                console.log(`Loaded ${players.length} players from CSV`);
                resolve();
            },
            error: err => {
                console.error('Error loading CSV:', err);
                reject(err);
            }
        });
    });
}

// Game state
let currentPlayer = null;
let score = 0;
let correctAnswers = 0;
let incorrectAnswers = 0;
let totalPlayers = 0;
let guessesLeft = 3;
let previousGuesses = [];
let gameActive = true;
let usedPlayers = [];
let timeLeft = 0;

// College logo map — ESPN CDN IDs
const collegeLogoMap = {
    'Alabama': 333, 'Arizona': 12, 'Arizona State': 9, 'Arkansas': 8,
    'Auburn': 2, 'Baylor': 239, 'Boston College': 103, 'California': 25,
    'Clemson': 228, 'Colorado': 38, 'Colorado State': 36, 'Duke': 150,
    'East Carolina': 151, 'Eastern Michigan': 2199, 'Eastern Washington': 331,
    'Florida': 57, 'Florida State': 52, 'Fresno State': 278, 'Georgia': 61,
    'Georgia Tech': 59, 'Houston': 248, 'Illinois': 356, 'Indiana': 84,
    'Iowa': 2294, 'Iowa State': 66, 'Kansas': 2305, 'Kansas State': 2306,
    'Kent State': 2309, 'Kentucky': 96, 'LSU': 99, 'Louisville': 97,
    'Marshall': 276, 'Maryland': 120, 'Memphis': 235, 'Miami': 2390,
    'Miami (OH)': 193, 'Michigan': 130, 'Michigan State': 127, 'Minnesota': 135,
    'Mississippi State': 344, 'Missouri': 142, 'NC State': 152, 'Nebraska': 158,
    'Nevada': 2440, 'New Mexico': 167, 'North Carolina': 153, 'North Dakota State': 2449,
    'Northwestern': 77, 'Notre Dame': 87, 'Ohio': 195, 'Ohio State': 194,
    'Oklahoma': 201, 'Oklahoma State': 197, 'Ole Miss': 145, 'Oregon': 2483,
    'Oregon State': 204, 'Penn State': 213, 'Pittsburgh': 221, 'Purdue': 2509,
    'Rutgers': 164, 'San Diego State': 21, 'SMU': 2567, 'South Carolina': 2579,
    'Southern California': 30, 'Southern Mississippi': 2572, 'Stanford': 24,
    'Syracuse': 183, 'TCU': 2628, 'Tennessee': 2633, 'Texas': 251,
    'Texas A&M': 245, 'Texas Tech': 2641, 'Troy': 2653, 'Tulsa': 202,
    'UCLA': 26, 'USC': 30, 'Utah': 254, 'Utah State': 328, 'Vanderbilt': 238,
    'Virginia': 258, 'Virginia Tech': 259, 'Wake Forest': 154, 'Washington': 264,
    'Washington State': 265, 'West Virginia': 277, 'Western Kentucky': 98,
    'Western Michigan': 2711, 'Wisconsin': 275, 'Wyoming': 2751,
    'Appalachian State': 2026, 'Arkansas State': 2032, 'Ball State': 2050,
    'Boise State': 68, 'Bowling Green': 189, 'Buffalo': 2084,
    'Central Michigan': 2117, 'Cincinnati': 2132, 'Connecticut': 41,
    'Northern Illinois': 2459, 'Old Dominion': 2448, 'Temple': 218,
    'Toledo': 2649, 'UTEP': 2638, 'Akron': 2006, 'Idaho': 70, 'Hawaii': 62,
    'San Jose State': 23, 'UNLV': 2439, 'New Mexico State': 2396,
    'Coastal Carolina': 324, 'Liberty': 2335, 'James Madison': 256,
    'Sam Houston State': 2534, 'South Alabama': 6,
};

// Extract unique colleges for dropdown (populated after CSV loads in initGame)
let uniqueColleges = [];

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

// Game Modes
const gameModes = {
    training: {
        name: "Training Camp",
        timeLimit: null,      // No timer
        globalLives: false,   // Lives reset every new player
        startingLives: 3      // 3 guesses per player
    },
    season: {
        name: "Regular Season",
        timeLimit: 15,        // 15 seconds per player
        globalLives: true,    // Lives carry over (Total health)
        startingLives: 3      // 3 lives TOTAL for the whole game
    },
    suddenDeath: {
        name: "Sudden Death",
        timeLimit: 5,         // 5 seconds per player
        globalLives: true,    // Lives carry over
        startingLives: 1      // 1 mistake and game over
    }
};
let currentMode = gameModes.training;
let currentModeKey = 'training';
let currentLives = currentMode.startingLives;
let timerInterval;

async function initGame() {
    players = [];
    await loadPlayersFromCSV();
    uniqueColleges = [...new Set(players.map(player => player.college))].sort();
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
}

function startGame(selectedModeKey) {
    // Apply filters before starting
    applyFilters();
    if (!filteredPlayers || filteredPlayers.length === 0) {
        alert('No players match your selected filters. Please try a different combination.');
        return;
    }
    if (filteredPlayers.length < 8) {
        const proceed = confirm(`Only ${filteredPlayers.length} player(s) match these filters. Players will repeat once all have been shown. Continue?`);
        if (!proceed) return;
    }
    currentModeKey = selectedModeKey;
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
    timeLeft = currentMode.timeLimit;
    resumeTimer();
}

function resumeTimer() {
    if (currentMode.timeLimit === null) return;
    const timerDisplay = document.getElementById("timer-display");
    clearInterval(timerInterval);
    timerDisplay.innerText = `${timeLeft}`;
    timerDisplay.classList.toggle('urgent', timeLeft <= 5);
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

function restartSameMode() {
    score = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalPlayers = 0;
    usedPlayers = [];
    gameActive = true;
    currentLives = currentMode.startingLives;
    clearInterval(timerInterval);
    document.getElementById('timer-display').innerText = '';
    gameOverElement.classList.add('hidden');
    document.querySelector('.game-area').classList.remove('hidden');
    document.getElementById('game-container').style.display = 'block';
    updateScore();
    updateRunningScore();
    loadNewPlayer();
}

function triggerGameOver() {
    gameActive = false;
    clearInterval(timerInterval);
    finalScoreElement.textContent = score;
    document.querySelector('.game-area').classList.add('hidden');
    gameOverElement.classList.remove('hidden');
    document.getElementById('timer-display').innerText = '';
    // Pre-fill name input if previously used
    const saved = localStorage.getItem('lb_last_name');
    if (saved) document.getElementById('player-name-input').value = saved;
    document.getElementById('player-name-input').focus();
    renderLeaderboard(currentModeKey);
}

// --- LEADERBOARD ---

function getLeaderboard(modeKey) {
    return JSON.parse(localStorage.getItem('leaderboard_' + modeKey) || '[]');
}

function saveToLeaderboard(modeKey, name, playerScore) {
    const board = getLeaderboard(modeKey);
    board.push({ name, score: playerScore, date: new Date().toLocaleDateString() });
    board.sort((a, b) => b.score - a.score);
    board.splice(10); // Keep top 10
    localStorage.setItem('leaderboard_' + modeKey, JSON.stringify(board));
}

function renderLeaderboard(modeKey) {
    const board = getLeaderboard(modeKey);
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    if (board.length === 0) {
        list.innerHTML = '<li class="lb-empty">No scores yet. Be the first!</li>';
        return;
    }
    board.forEach((entry, i) => {
        const li = document.createElement('li');
        li.className = 'lb-entry' + (i === 0 ? ' lb-gold' : i === 1 ? ' lb-silver' : i === 2 ? ' lb-bronze' : '');
        li.innerHTML = `<span class="lb-rank">#${i + 1}</span><span class="lb-name">${entry.name}</span><span class="lb-score">${entry.score} pts</span><span class="lb-date">${entry.date}</span>`;
        list.appendChild(li);
    });
}

function loadNewPlayer() {
    if (usedPlayers.length >= filteredPlayers.length) {
        // Loop: reset used players so the round continues with the same pool
        usedPlayers = [];
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
    playerImgElement.alt = '';
    const badge = document.getElementById('difficulty-badge');
    const diff = (currentPlayer.difficulty || '').toLowerCase();
    badge.textContent = diff ? diff.charAt(0).toUpperCase() + diff.slice(1) : '';
    badge.className = 'difficulty-badge' + (diff ? ' difficulty-' + diff : '');
    badge.style.display = diff ? '' : 'none';
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

// Track arrow-key-highlighted dropdown item
let dropdownHighlightIndex = -1;

// Populate college dropdown
function populateCollegeDropdown(filter = '') {
    dropdownHighlightIndex = -1;
    collegeDropdownElement.innerHTML = '';
    
    const filteredColleges = uniqueColleges.filter(college => 
        college.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filteredColleges.length === 0) {
        collegeDropdownElement.classList.add('hidden');
        return;
    }
    
    filteredColleges.slice(0, 15).forEach(college => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.dataset.college = college;
        const logoId = collegeLogoMap[college];
        const logoHtml = logoId
            ? `<img class="dropdown-logo" src="https://a.espncdn.com/i/teamlogos/ncaa/500/${logoId}.png" alt="" onerror="this.style.display='none'">`
            : `<span class="dropdown-logo-placeholder"></span>`;
        option.innerHTML = `${logoHtml}<span class="dropdown-college-name">${college}</span>`;
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
            const timeBonus = currentMode.timeLimit !== null ? ' (+10s)' : '';
            feedbackElement.textContent = `Incorrect. Try again!${timeBonus}`;
            feedbackElement.className = 'feedback incorrect';
            previousGuessesElement.textContent = `Previous guesses: ${previousGuesses.join(', ')}`;
            guessInputElement.value = '';
            if (currentMode.timeLimit !== null) {
                timeLeft += 10;
                resumeTimer();
            }
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


// Event listeners
submitGuessButton.addEventListener('click', submitGuess);
passButton.addEventListener('click', passPlayer);

// Provided code: Add Enter key support for guess input
const inputField = document.querySelector('input[type="text"]');
const submitBtn = document.getElementById('submit-guess');
inputField.addEventListener("keydown", function(event) {
  const options = collegeDropdownElement.querySelectorAll('.dropdown-option');
  const isOpen = !collegeDropdownElement.classList.contains('hidden') && options.length > 0;

  if (event.key === "ArrowDown") {
    if (!isOpen) return;
    event.preventDefault();
    dropdownHighlightIndex = (dropdownHighlightIndex + 1) % options.length;
    updateDropdownHighlight(options);
  } else if (event.key === "ArrowUp") {
    if (!isOpen) return;
    event.preventDefault();
    dropdownHighlightIndex = (dropdownHighlightIndex - 1 + options.length) % options.length;
    updateDropdownHighlight(options);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (isOpen && dropdownHighlightIndex >= 0) {
      selectCollege(options[dropdownHighlightIndex].dataset.college);
    } else {
      submitBtn.click();
    }
  } else if (event.key === "Tab") {
    if (isOpen) {
      event.preventDefault();
      const target = dropdownHighlightIndex >= 0 ? options[dropdownHighlightIndex] : options[0];
      selectCollege(target.dataset.college);
    }
  }
});

function updateDropdownHighlight(options) {
  options.forEach((opt, i) => {
    opt.classList.toggle('dropdown-option-active', i === dropdownHighlightIndex);
  });
  if (dropdownHighlightIndex >= 0) {
    options[dropdownHighlightIndex].scrollIntoView({ block: 'nearest' });
  }
}

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
document.getElementById('end-game-btn').addEventListener('click', function() {
    if (confirm('End the game and submit your score to the leaderboard?')) {
        triggerGameOver();
    }
});
playAgainButton.addEventListener('click', initGame);
document.getElementById('play-again-same').addEventListener('click', restartSameMode);

// Save score to leaderboard
document.getElementById('save-score-btn').addEventListener('click', function() {
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput.value.trim() || 'Anonymous';
    localStorage.setItem('lb_last_name', name);
    saveToLeaderboard(currentModeKey, name, score);
    renderLeaderboard(currentModeKey);
    nameInput.value = '';
    this.textContent = 'Saved!';
    this.disabled = true;
    setTimeout(() => { this.textContent = 'Save Score'; this.disabled = false; }, 2000);
});

// Allow pressing Enter in the name input to save
document.getElementById('player-name-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('save-score-btn').click();
});

// Leaderboard tabs
document.querySelectorAll('.lb-tab').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        renderLeaderboard(this.dataset.mode);
    });
});

// Clear leaderboard
document.getElementById('clear-leaderboard-btn').addEventListener('click', function() {
    if (confirm('Clear all leaderboard scores?')) {
        ['training', 'season', 'suddenDeath'].forEach(k => localStorage.removeItem('leaderboard_' + k));
        const activeTab = document.querySelector('.lb-tab.active');
        renderLeaderboard(activeTab ? activeTab.dataset.mode : 'training');
    }
});

// Handle image loading errors
playerImgElement.addEventListener('error', function() {
    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTAwIDEwMEM4MS4wNDI5IDEwMCA2NiA4NC45NTcxIDY2IDY2QzY2IDQ3LjA0MjkgODEuMDQyOSAzMiAxMDAgMzJDMTE4Ljk1NyAzMiAxMzQgNDcuMDQyOSAxMzQgNjZDMTM0IDg0Ljk1NzEgMTE4Ljk1NyAxMDAgMTAwIDEwMFpNMTAwIDEzNEM4MS4wNDI5IDEzNCA2NiAxNDkuMDQzIDY2IDE2OEg0NkM0NiAxMzguMDcyIDcwLjA3MjEgMTE0IDEwMCAxMTRDMTI5LjkyOCAxMTQgMTU0IDEzOC4wNzIgMTU0IDE2OEgxMzRDMTM0IDE0OS4wNDMgMTE4Ljk1NyAxMzQgMTAwIDEzNFoiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+';
});
// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    renderLeaderboard('training');
});