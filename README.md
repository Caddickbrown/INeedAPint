# I Need A Pint 🍺

A minimal web app that finds your nearest pub in one tap.

## Features

- **One-tap experience** - Just tap "Find My Pint" and you're on your way
- **Walking distance & time** - Shows actual walking distance and estimated time (not just straight-line)
- **No API keys required** - Uses OpenStreetMap's Overpass API and OSRM routing (free & open)
- **Works on mobile** - Responsive design, opens native maps for walking directions
- **Find alternatives** - Tap "Find Another" to cycle through nearby pubs

## How It Works

1. Tap the button
2. Allow location access
3. Get directed to the nearest pub

That's it. Go enjoy your pint.

## Running Locally

Just serve the files with any static server:

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve

# Or just open index.html in your browser
```

## Tech Stack

- Vanilla HTML/CSS/JS (no frameworks, no build step)
- [Overpass API](https://overpass-api.de/) for pub data from OpenStreetMap
- [OSRM](http://project-osrm.org/) for walking distance and time calculations
- Google Fonts (Playfair Display + DM Sans)

## License

MIT - Go forth and find pints.
