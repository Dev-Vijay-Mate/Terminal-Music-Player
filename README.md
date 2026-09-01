# 🎵 Terminal Music Player

A simple and interactive terminal-based music player built with Node.js and MPV. Play your local music directly from the terminal using an interactive interface and keyboard controls.

## ✨ Features

- 🎵 Play local music files
- ▶️ Select and play songs
- ⏸️ Pause and resume playback
- ⏭️ Navigate between songs
- ⌨️ Keyboard-based controls
- 📊 Playback progress tracking
- 🖥️ Interactive terminal interface
- 🔊 Audio playback powered by MPV

## 🛠️ Tech Stack

- JavaScript
- Node.js
- MPV

## 📂 Project Structure

Terminal-Music-Player/
├── songs/          # Local music files
├── index.js        # Main application
├── .gitignore
└── README.md

## 🚀 Installation & Setup

### 1. Clone the Repository

    git clone https://github.com/Dev-Vijay-Mate/Terminal-Music-Player.git

### 2. Navigate to the Project

    cd Terminal-Music-Player

### 3. Install Dependencies

    npm install

### 4. Install MPV

This project uses MPV for audio playback.

On macOS, install MPV using Homebrew:

    brew install mpv

Verify the installation:

    mpv --version

### 5. Add Your Music

Place your `.mp3` files inside the `songs` folder.

Example:

    songs/
    ├── song1.mp3
    ├── song2.mp3
    └── song3.mp3

### 6. Start the Player

    node index.js

🎧 Enjoy your music directly from the terminal!

## ⌨️ Controls

| Key | Action |
|---|---|
| ↑ / ↓ | Navigate through songs |
| Enter | Select / Play |
| Space | Pause / Resume |
| Q | Quit |

## 🎬 Demo

The Terminal Music Player runs directly inside the terminal and provides an interactive way to browse and play local music.

Add a screenshot or GIF of the player here:

    ![Terminal Music Player Demo](demo.gif)

## 🧠 What I Learned

Building this project helped me understand and practice:

- Node.js process management
- Terminal input handling
- Asynchronous programming
- File-system operations
- Integration with external applications
- Audio playback
- Playback state management
- IPC communication

## 🔮 Future Improvements

- 🔀 Shuffle mode
- 🔁 Repeat mode
- 🔊 Volume controls
- 🔎 Song search and filtering
- 📋 Playlist management
- 🌍 Better cross-platform support
- 🎨 Improved terminal UI
- 🎼 Support for additional audio formats

## 👨‍💻 Author

**Vijay Mate**

GitHub: https://github.com/Dev-Vijay-Mate

## ⭐ Support

If you like this project, consider giving the repository a ⭐ on GitHub.

Feedback, suggestions, and contributions are always welcome.

---

🎧 Built with JavaScript, Node.js, and MPV.