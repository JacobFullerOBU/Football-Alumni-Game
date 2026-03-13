# Football Alumni Game

A trivia style game where you guess which college NFL players attended!

## 🎮 How to Play

- Look at the NFL player's name and image
- Enter the college/university you know (or think) they attended
- You have 3 guesses per player
- Try to get the highest score possible!

## 🚀 Live Demo

The game is deployed and available at: https://jacobfullerobu.github.io/Football-Alumni-Game/

## 🛠️ Development

This is a pure HTML, CSS, and JavaScript game with no build dependencies.

### Local Development

1. Clone the repository
2. Open `index.html` in your browser, or run in a local HTTP server.
   you can set it up using the following commands in terminal:
   python3 -m http.server 8000
3. Navigate to `http://localhost:8000`

### Deployment

The site is automatically deployed to GitHub Pages using GitHub Actions when changes are pushed to the `main` branch.

## 📁 Project Structure

- `index.html` - Main game interface
- `script.js` - Game logic and player data
- `style.css` - Styling and responsive design
- `players.csv` - External CSV file with additional NFL players
- `.github/workflows/deploy.yml` - GitHub Pages deployment workflow

## 📝 Adding More Players

You can easily add more players to the game by editing the `players.csv` file. The CSV format is:

```csv
name,college
name,draft_year,college,time_period,difficulty,image_url
```

Example:
```csv
name,draft_year,college,time_period,difficulty,image_url
Bryce Young,2023,Alabama,2020s,easy,https://upload.wikimedia.org/wikipedia/commons/3/3a/Bryce_Young_at_W.P.T._Hill_Field_-_2024_-_02_%28cropped%29.jpg
Will Levis,2023,Kentucky,2020s,medium,https://upload.wikimedia.org/wikipedia/commons/8/82/Will_Levis_Titans-Steelers_NOV2023.png
Brock Purdy,2022,Iowa State,2020s,medium,https://upload.wikimedia.org/wikipedia/commons/4/49/BrockPurdy2021_%28cropped%29.jpg
```

The game will automatically load and merge players from the CSV file with the hardcoded players when the page loads.
