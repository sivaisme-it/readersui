# READERS — EPUB Terminal Reader

A cyberpunk-themed EPUB reader with text-to-speech, custom backgrounds, and interactive stickers.

## Features

### Core Reader
- Drag & drop EPUB file loading
- Chapter navigation with table of contents
- Reading progress tracking
- Bookmark system
- Full-text search
- Font size controls
- Dark/Light theme toggle

### Text-to-Speech
- Microsoft voice support
- Adjustable speed and pitch
- Chapter-by-chapter playback
- Pause/Resume from last position
- Word highlighting while reading

### Customization
- **Backgrounds**: Upload custom images or choose from 8 preset backgrounds
- **Background Opacity**: Adjust background visibility
- **Text Opacity**: Control text transparency (20%-100%)
- **Text Brightness**: Adjust text brightness (50%-150%)
- **Color Presets**: 8 dark/light color themes

### Interactive Elements
- Floating cat stickers (auto-spawn every 60 seconds)
- Manual sticker button (click to send)
- Click spark effects

## File Structure

```
readqith me/
├── readers.html      # Main HTML file
├── readers.css       # Styles
├── readers.js        # JavaScript logic
├── cat/              # Cat sticker GIFs
│   ├── Cat Blush Sticker by Capoo.gif
│   ├── Cat Kitten Sticker.gif
│   ├── Cat Shining Sticker by Capoo.gif
│   ├── Cat Sleeping Sticker.gif
│   ├── Cat Smh Sticker by ACHTUNG.gif
│   ├── cat Sticker by Capoo.gif
│   ├── Gesturing Excuse Me Sticker by Justin (1).gif
│   ├── Hello Kitty Cat Sticker.gif
│   └── In Love Kiss Sticker by MYAOWL.gif
└── hi/               # Background presets
    ├── 87dd4916a6cff36e4f0ac0318df119da.jpg
    ├── 0aaaddebcbf023e4cbbebe07598845e6.gif
    ├── 2ef6ce0a6a5dedb9a4c990d682145b11.gif
    ├── 99921a006dd86658c16dc8b63873f6f3.gif
    ├── b39d004739a48bcc60f771089bb7ecd3.gif
    ├── b6c610397150ed9f4ecaf65bf107ca56.gif
    ├── bec1174a050a92e8735410d1346b3a61.gif
    └── f5cc882eaa11aff3d06e02ebd6dbe4aa.gif
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` / `↓` | Next chapter |
| `←` / `↑` | Previous chapter |
| `Space` | Play/Pause TTS |
| `S` | Stop TTS |

## Usage

1. Open `readers.html` in a browser
2. Click **LOAD EPUB** or drag & drop an `.epub` file
3. Use the right sidebar to customize your reading experience
4. Click the 🐱 button to send stickers while reading

## Browser Support

- Chrome (recommended)
- Edge
- Firefox
- Safari

## Dependencies

- [JSZip](https://github.com/nicklockwood/JSZip) — EPUB parsing
- Google Fonts — Black Ops One, Russo One, Share Tech Mono, Crimson Pro

## License

Free to use and modify.
