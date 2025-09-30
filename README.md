# Football Alumni Game

A trivia style game where you guess which college NFL players attended!

## 🎮 How to Play

- Look at the NFL player's name and image
- Enter the college/university you think they attended
- You have 3 guesses per player
- Try to get the highest score possible!

## 🚀 Live Demo

The game is deployed and available at: https://jacobfullerobu.github.io/Football-Alumni-Game/

## 🛠️ Development

This is a pure HTML, CSS, and JavaScript game with no build dependencies.

### Local Development

1. Clone the repository
2. Open `index.html` in your browser, or serve it with a local HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
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
name,college,image
Player Name,College Name,Image URL
```

Example:
```csv
name,college,image
Cooper Kupp,Eastern Washington,https://images.unsplash.com/photo-1566577739112-5180d4bf9390?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80
```

The game will automatically load and merge players from the CSV file with the hardcoded players when the page loads.
