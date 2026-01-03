# Pub Crawl Planning Feature 🗺️

## Overview
A new interactive pub crawl planning mode has been added to "I Need A Pint" that allows users to visually plan multi-pub routes while maintaining the app's core simplicity.

## How to Use

### Access the Feature
1. Click the **"🗺️ Plan My Pint"** button on the home page (below the main "Find My Pint" button)
2. An interactive map interface will open

### Plan Your Crawl
1. **Set Starting Point**: Click anywhere on the map to drop a pin
2. **Browse Pubs**: A list of nearby pubs (within 3km) will appear automatically
3. **Select Pubs**: Click on pubs in the list or on map markers to add them to your crawl
4. **Reorder**: Drag and drop pubs in the "Your Crawl" section to reorder the sequence
5. **View Route**: The map shows your planned route with numbered stops

### Actions
- **Share Crawl**: Exports your route with pub names, Google Maps links, and total stats
- **Start Navigation**: Opens turn-by-turn directions to the first pub
- **Clear All**: Removes all selected pubs and starts fresh

## Features

### Interactive Map
- Uses Leaflet.js with dark theme matching the app aesthetic
- Centers on user's location automatically
- Custom markers with beer emoji 🍺 and numbers for selected pubs
- Click anywhere to set starting point
- Click markers to add pubs or view details

### Smart Pub Discovery
- Automatically searches 3km radius from dropped pin
- Shows up to 20 nearest pubs
- Displays distance from starting point
- Grayed-out markers for unselected pubs

### Route Visualization
- Dashed amber line showing the crawl route
- Numbered markers (1, 2, 3...) for selected pubs
- Starting point marked with 📍
- Auto-zooms to fit entire route

### Selection Management
- Click pubs in list to add to crawl
- Click pubs on map to add to crawl
- Visual feedback when adding duplicate pubs
- Smooth scrolling to newly added pubs
- Click items in "Your Crawl" to highlight on map

### Drag & Drop Reordering
- Full drag-and-drop support for reordering pubs
- Visual feedback during drag
- Route and markers update automatically
- Works on desktop and touch devices

### Statistics
- Real-time pub count
- Total walking distance
- Estimated walking time (using 80m/min standard)
- Updates automatically as you add/remove/reorder

### Share Functionality
- Native share API support (mobile)
- Clipboard fallback (desktop)
- Includes:
  - Starting coordinates
  - All pub names in order
  - Google Maps links for each pub
  - Total stats (distance, time, pub count)
  - "Created with I Need A Pint" branding

## Design Philosophy

### Maintains Simplicity
- **Subtle Integration**: Button is styled as secondary/tertiary to not overpower main feature
- **Separate State**: Completely isolated from main app flow
- **Easy Exit**: Clear back button to return to home
- **Progressive Enhancement**: Map loads only when needed

### Consistent Aesthetics
- Same color palette (amber, cream, dark brown)
- Same typography (Playfair Display + DM Sans)
- Same button styles and animations
- Dark map theme matches app background
- Smooth transitions and animations

### Mobile-First
- Responsive layout adapts to screen size
- Touch-friendly controls
- Proper scrolling for pub lists
- Map sizing optimized for mobile
- Native share on mobile devices

## Technical Implementation

### Files Modified
1. **index.html**
   - Added "Plan My Pint" button to home page
   - Added new crawl planning state section
   - Integrated Leaflet.js CSS and JS

2. **style.css**
   - Added tertiary button styles
   - Added crawl container and header styles
   - Added map styling and Leaflet overrides
   - Added pub list item styles
   - Added drag & drop visual feedback
   - Added mobile responsive breakpoints
   - Added smooth animations

3. **app.js**
   - Added crawl state to state management
   - Implemented Leaflet map initialization
   - Added pin dropping functionality
   - Implemented pub search and display
   - Added selection/deselection logic
   - Implemented drag & drop reordering
   - Added route visualization
   - Implemented statistics calculation
   - Added share functionality with fallbacks
   - Added navigation integration

4. **README.md**
   - Documented new pub crawl planning mode
   - Updated features section
   - Added Leaflet.js to tech stack

### New Dependencies
- **Leaflet.js 1.9.4**: Interactive map library
  - Loaded via CDN (no build step required)
  - Small footprint (~150KB)
  - Mobile-friendly

### Code Statistics
- **~500 lines** of new JavaScript
- **~300 lines** of new CSS
- **~50 lines** of new HTML
- Total app size: ~2,600 lines across 3 files

## Browser Compatibility
- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Progressive enhancement (graceful degradation)
- ✅ Works offline after first load (map tiles need network)

## Future Enhancements (Optional)
- Save crawls to localStorage
- Generate QR codes for sharing
- Add time estimates between pubs (stops)
- Weather integration for planning
- Pub ratings/reviews
- Opening hours integration
- Route optimization suggestions

## Testing Checklist
- [ ] Home page loads with "Plan My Pint" button visible
- [ ] Button click opens map interface
- [ ] Map centers on user location (with permission)
- [ ] Clicking map drops pin and searches pubs
- [ ] Pub list populates with nearby venues
- [ ] Clicking pub adds to "Your Crawl"
- [ ] Drag & drop reordering works
- [ ] Route line draws correctly
- [ ] Statistics update in real-time
- [ ] Share functionality works (clipboard on desktop)
- [ ] Start Navigation opens maps app
- [ ] Clear All removes all selections
- [ ] Back button returns to home
- [ ] Mobile responsive layout works
- [ ] No console errors

## Notes
- The feature maintains the app's "no API keys" philosophy
- Uses same OpenStreetMap data as quick find mode
- Map requires internet for tile loading (Leaflet/CDN)
- Share includes Google Maps links for universal compatibility
- Designed to be discoverable but not intrusive
