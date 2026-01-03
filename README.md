# I Need A Pint 🍺

A minimal web app that finds your nearest pub in one tap.

## Features

### Quick Find Mode
- **One-tap experience** - Just tap "Find My Pint" and you're on your way
- **Walking distance & time** - Shows actual walking distance and estimated time (not just straight-line)
- **No API keys required** - Uses OpenStreetMap's Overpass API and OSRM routing (free & open)
- **Works on mobile** - Responsive design, opens native maps for walking directions
- **Find alternatives** - Tap "Find Another" to cycle through nearby pubs

### Pub Crawl Planning Mode 🗺️
- **Interactive map** - Drop a pin anywhere to set your starting point
- **Nearby pub discovery** - Automatically finds pubs within 3km radius
- **Route planning** - Select and order pubs to create your perfect crawl
- **Drag & drop** - Easily reorder your pub sequence
- **Distance tracking** - See total distance and estimated walking time
- **Share your crawl** - Export your route with pub names and map links
- **Visual route** - See your planned route on the map with numbered stops

## How It Works

### Quick Mode
1. Tap "Find My Pint"
2. Allow location access
3. Get directed to the nearest pub

### Crawl Planning Mode
1. Tap "Plan My Pint"
2. Click anywhere on the map to set your starting point
3. Browse nearby pubs and click to add them to your crawl
4. Drag to reorder pubs in your preferred sequence
5. Share or start navigating your crawl

That's it. Go enjoy your pint(s)!

## What's Included?

The app searches for:
- **Pubs** - Traditional pubs and taverns
- **Bars** - Bars and cocktail lounges
- **Biergartens** - Beer gardens
- **Social Clubs** - Social clubs that serve alcohol (e.g., UK working men's clubs, British Legion clubs)

### Smart Filtering

OpenStreetMap data can be inconsistently tagged. This app uses smart filtering:
- **Name analysis** - Catches venues with "bar", "pub", "tavern", etc. in their name even if mis-tagged
- **Restaurant filtering** - Excludes restaurants unless they have clear pub/bar keywords in their name
- **Confidence tracking** - Venues are flagged as `high` or `medium` confidence (currently sorted by distance only, but you can change this in the code)

Note: Some social clubs may require membership for entry.

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
- [Leaflet.js](https://leafletjs.com/) for interactive maps (pub crawl mode)
- Google Fonts (Playfair Display + DM Sans)

## License

MIT - Go forth and find pints.
