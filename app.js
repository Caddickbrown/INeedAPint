// State management
const states = {
    initial: document.getElementById('state-initial'),
    loading: document.getElementById('state-loading'),
    result: document.getElementById('state-result'),
    error: document.getElementById('state-error'),
    crawl: document.getElementById('state-crawl')
};

// Elements
const btnFind = document.getElementById('btn-find');
const btnRetry = document.getElementById('btn-retry');
const btnBack = document.getElementById('btn-back');
const btnErrorRetry = document.getElementById('btn-error-retry');
const btnDirections = document.getElementById('btn-directions');
const btnInstall = document.getElementById('btn-install');
const installModal = document.getElementById('install-modal');
const modalClose = document.getElementById('modal-close');
const installInstructions = document.getElementById('install-instructions');
const pubName = document.getElementById('pub-name');
const pubDistance = document.getElementById('pub-distance');
const pubBadge = document.getElementById('pub-badge');
const confidenceBadge = document.getElementById('confidence-badge');
const errorMessage = document.getElementById('error-message');

// Pub Crawl Elements
const btnPlanCrawl = document.getElementById('btn-plan-crawl');
const btnCrawlBack = document.getElementById('btn-crawl-back');
const crawlMap = document.getElementById('crawl-map');
const crawlInstructions = document.getElementById('crawl-instructions');
const crawlPubsSection = document.getElementById('crawl-pubs-section');
const crawlPubsList = document.getElementById('crawl-pubs-list');
const crawlSelectedSection = document.getElementById('crawl-selected-section');
const crawlSelectedList = document.getElementById('crawl-selected-list');
const crawlCount = document.getElementById('crawl-count');
const crawlDistance = document.getElementById('crawl-distance');
const btnCrawlShare = document.getElementById('btn-crawl-share');
const btnCrawlNavigate = document.getElementById('btn-crawl-navigate');
const btnCrawlClear = document.getElementById('btn-crawl-clear');

// Get default map provider based on device
function getDefaultMapProvider() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
        return 'apple';
    } else if (isAndroid) {
        return 'google';
    } else {
        return 'google'; // Default for desktop/other
    }
}

// Current location and pubs data
let currentLat = null;
let currentLon = null;
let foundPubs = [];
let currentPubIndex = 0;
let navigationHistory = []; // Track navigation history for back button
let selectedMapProvider = localStorage.getItem('mapProvider') || getDefaultMapProvider();

// Pre-fetching configuration
const INITIAL_PREFETCH_COUNT = 5; // Pre-fetch top 5 on initial load
const PREFETCH_AHEAD_COUNT = 3; // Keep 3 pubs ahead loaded as user navigates

// OS Detection
function getOS() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Mac/.test(ua)) return 'mac';
    if (/Win/.test(ua)) return 'windows';
    return 'other';
}

// Switch between states
function showState(stateName) {
    Object.keys(states).forEach(key => {
        states[key].classList.remove('active');
    });
    states[stateName].classList.add('active');
}

// Calculate distance between two points using Haversine formula (as the crow flies)
// Used as a fallback if routing API fails
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calculate walking distance and duration using OSRM routing API
async function calculateWalkingRoute(lat1, lon1, lat2, lon2) {
    try {
        const url = `https://router.project-osrm.org/route/v1/foot/${lon1},${lat1};${lon2},${lat2}?overview=false`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Routing API request failed');
        }
        
        const data = await response.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }
        
        const route = data.routes[0];
        const distanceKm = route.distance / 1000; // Convert meters to km
        const distanceMeters = route.distance;
        
        // Calculate duration ourselves using realistic walking speed
        // OSRM's foot profile duration is unreliable (too fast)
        // Use Google Maps standard: 80 m/min (4.8 km/h)
        const durationMinutes = distanceMeters / 80; // 80 m/min walking speed
        
        return {
            distance: distanceKm,
            duration: durationMinutes
        };
    } catch (error) {
        console.warn('Walking route calculation failed, using straight-line distance:', error);
        // Fallback to straight-line distance
        const distance = calculateDistance(lat1, lon1, lat2, lon2);
        // Estimate walking time: Google Maps uses ~80 m/min walking speed
        const distanceInMeters = distance * 1000;
        const duration = distanceInMeters / 80; // minutes (80 m/min)
        return {
            distance: distance,
            duration: duration,
            isEstimate: true
        };
    }
}

// Check if we're in a secure context (HTTPS or localhost)
function isSecureContext() {
    return window.isSecureContext || 
           location.protocol === 'https:' || 
           location.hostname === 'localhost' || 
           location.hostname === '127.0.0.1';
}

// Get user's location
function getLocation() {
    return new Promise((resolve, reject) => {
        // Check for secure context first
        if (!isSecureContext()) {
            reject(new Error('Location requires HTTPS. Please access this site via https://'));
            return;
        }

        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        // Check permissions API if available (helps detect pre-denied state)
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then(result => {
                if (result.state === 'denied') {
                    reject(new Error('Location is blocked. On iPhone: Settings → Safari → Location → Allow. Then refresh this page.'));
                    return;
                }
                // Continue with geolocation request
                requestGeolocation(resolve, reject);
            }).catch(() => {
                // Permissions API not fully supported, try anyway
                requestGeolocation(resolve, reject);
            });
        } else {
            requestGeolocation(resolve, reject);
        }
    });
}

function getLocationErrorMessage(errorCode) {
    const os = getOS();
    
    if (errorCode === 1) { // PERMISSION_DENIED
        switch (os) {
            case 'ios':
                return 'Location blocked. Go to Settings → Privacy & Security → Location Services → Safari Websites → set to "While Using". Then refresh.';
            case 'android':
                return 'Location blocked. Tap the lock icon in Chrome\'s address bar → Permissions → Location → Allow. Then refresh.';
            case 'mac':
                return 'Location blocked. Go to System Settings → Privacy & Security → Location Services → enable for your browser. Then refresh.';
            case 'windows':
                return 'Location blocked. Click the lock icon in the address bar → Site permissions → Location → Allow. Then refresh.';
            default:
                return 'Location access denied. Please enable location in your browser settings and refresh.';
        }
    } else if (errorCode === 2) { // POSITION_UNAVAILABLE
        switch (os) {
            case 'ios':
                return 'Location unavailable. Check Settings → Privacy & Security → Location Services is ON.';
            case 'android':
                return 'Location unavailable. Check Settings → Location is turned ON.';
            default:
                return 'Location unavailable. Please check that Location Services is enabled on your device.';
        }
    } else if (errorCode === 3) { // TIMEOUT
        return 'Location request timed out. Please try again.';
    }
    return 'Could not get location. Please check your settings and try again.';
}

function requestGeolocation(resolve, reject) {
    navigator.geolocation.getCurrentPosition(
        position => {
            resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude
            });
        },
        error => {
            reject(new Error(getLocationErrorMessage(error.code)));
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }
    );
}

// Check if a venue name suggests it's a pub/bar based on keywords
function isPubByName(name) {
    if (!name) return false;
    
    const lowerName = name.toLowerCase();
    
    // Strong pub/bar indicators
    const pubKeywords = [
        'pub', 'bar', 'tavern', 'inn', 'alehouse', 'taproom', 'tap room',
        'brewery', 'brewpub', 'beer hall', 'biergarten', 'beer garden',
        'social club', 'working men', 'british legion', 'legion club',
        'arms', 'lounge bar', 'cocktail bar', 'wine bar'
    ];
    
    return pubKeywords.some(keyword => lowerName.includes(keyword));
}

// Find nearby pubs using Overpass API (OpenStreetMap)
async function findNearbyPubs(lat, lon) {
    const radius = 3000; // 3km radius
    
    // Query for pubs, bars, biergartens, social clubs, AND restaurants
    // (some pubs are mis-tagged as restaurants, we'll filter by name later)
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="pub"](around:${radius},${lat},${lon});
            node["amenity"="bar"](around:${radius},${lat},${lon});
            node["amenity"="biergarten"](around:${radius},${lat},${lon});
            node["amenity"="social_club"](around:${radius},${lat},${lon});
            node["amenity"="restaurant"](around:${radius},${lat},${lon});
            way["amenity"="pub"](around:${radius},${lat},${lon});
            way["amenity"="bar"](around:${radius},${lat},${lon});
            way["amenity"="biergarten"](around:${radius},${lat},${lon});
            way["amenity"="social_club"](around:${radius},${lat},${lon});
            way["amenity"="restaurant"](around:${radius},${lat},${lon});
        );
        out center;
    `;
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch nearby pubs');
    }
    
    const data = await response.json();
    
    if (!data.elements || data.elements.length === 0) {
        throw new Error('No pubs found nearby. Try a different location!');
    }
    
    // Process pubs and get their coordinates with straight-line distances first
    const pubsWithCoords = data.elements
        .map(element => {
            // Handle both nodes and ways (ways have center property)
            const pubLat = element.lat || element.center?.lat;
            const pubLon = element.lon || element.center?.lon;
            
            if (!pubLat || !pubLon) return null;
            
            const name = element.tags?.name || 'Unnamed Pub';
            const amenity = element.tags?.amenity;
            
            // Filter logic: Include if properly tagged OR has pub/bar in name
            const isProperlyTagged = ['pub', 'bar', 'biergarten', 'social_club'].includes(amenity);
            const hasBarName = isPubByName(name);
            
            // Skip restaurants unless they have clear pub/bar indicators in name
            if (amenity === 'restaurant' && !hasBarName) {
                return null;
            }
            
            // Calculate straight-line distance immediately
            const straightLineDistance = calculateDistance(lat, lon, pubLat, pubLon);
            // Estimate walking time: Google Maps uses ~80 m/min walking speed
            const distanceInMeters = straightLineDistance * 1000;
            const estimatedWalkingTime = distanceInMeters / 80; // minutes (80 m/min)
            
            return {
                name: name,
                lat: pubLat,
                lon: pubLon,
                type: amenity,
                distance: straightLineDistance,
                walkingTime: estimatedWalkingTime,
                isEstimate: true, // Mark as estimate initially
                needsRouteUpdate: true, // Flag to update with accurate route
                confidence: isProperlyTagged ? 'high' : 'medium' // Track data quality
            };
        })
        .filter(pub => pub !== null);
    
    // Sort by distance only (confidence flag preserved for future use)
    pubsWithCoords.sort((a, b) => a.distance - b.distance);
    
    return pubsWithCoords;
}

// Pre-fetch routing data for pubs around the current position
// This keeps routing data loaded ahead of where the user is navigating
async function prefetchRoutingData(userLat, userLon, pubs, currentIndex = 0) {
    if (!pubs || pubs.length === 0) return;
    
    // Allow multiple prefetch operations to run concurrently
    // Each pub tracks its own update state, so there's no conflict
    
    try {
        // Determine the range to pre-fetch:
        // - On initial load: fetch top INITIAL_PREFETCH_COUNT (5)
        // - During navigation: fetch current + PREFETCH_AHEAD_COUNT (3) ahead
        let startIndex, endIndex;
        
        if (currentIndex === 0 && pubs.every(pub => pub.needsRouteUpdate)) {
            // Initial load: fetch top 5
            startIndex = 0;
            endIndex = Math.min(INITIAL_PREFETCH_COUNT, pubs.length);
        } else {
            // During navigation: keep 3 ahead loaded
            startIndex = currentIndex;
            endIndex = Math.min(currentIndex + PREFETCH_AHEAD_COUNT + 1, pubs.length);
        }
        
        // Get pubs that need route updates in this range
        const pubsToCalculate = pubs
            .slice(startIndex, endIndex)
            .filter(pub => pub.needsRouteUpdate);
        
        if (pubsToCalculate.length === 0) {
            return;
        }
        
        console.log(`Pre-fetching routes for ${pubsToCalculate.length} pubs (indices ${startIndex}-${endIndex - 1})`);
        
        // Mark pubs as being updated to prevent duplicate requests
        pubsToCalculate.forEach(pub => pub.needsRouteUpdate = false);
        
        // Calculate routes in parallel (limited batch size keeps API usage reasonable)
        const routePromises = pubsToCalculate.map(async (pub) => {
            try {
                const route = await calculateWalkingRoute(userLat, userLon, pub.lat, pub.lon);
                
                // Update pub with accurate route data
                pub.distance = route.distance;
                pub.walkingTime = route.duration;
                pub.isEstimate = route.isEstimate || false;
                
                // If this pub is currently being displayed, update the UI
                if (foundPubs.length > 0 && foundPubs[currentPubIndex] === pub) {
                    updateDisplayedPubDistance(pub);
                }
            } catch (error) {
                console.warn(`Failed to calculate route for ${pub.name}:`, error);
                // Keep the estimate if route calculation fails
            }
        });
        
        await Promise.all(routePromises);
        
        console.log(`Pre-fetching complete for indices ${startIndex}-${endIndex - 1}`);
    } catch (error) {
        console.error('Error in prefetchRoutingData:', error);
    }
}

// Trigger pre-fetching when user navigates to a new pub
function triggerPrefetch() {
    if (currentLat && currentLon && foundPubs.length > 0) {
        // Pre-fetch routes for upcoming pubs (non-blocking)
        prefetchRoutingData(currentLat, currentLon, foundPubs, currentPubIndex);
    }
}

// Update the displayed pub's distance when accurate route data arrives
function updateDisplayedPubDistance(pub) {
    if (!pub) return;
    
    // Update distance display
    if (pub.distance < 1) {
        pubDistance.textContent = Math.round(pub.distance * 1000);
        document.querySelector('.distance-unit').textContent = 'm';
    } else {
        pubDistance.textContent = pub.distance.toFixed(1);
        document.querySelector('.distance-unit').textContent = 'km';
    }
    
    // Update walking time display
    const walkingTimeEl = document.getElementById('walking-time');
    if (walkingTimeEl) {
        walkingTimeEl.textContent = formatWalkingTime(pub.walkingTime);
    }
}

// Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Generate badge text based on position
function getPubBadgeText(index) {
    if (index === 0) {
        return "NEAREST PUB";
    } else {
        return getOrdinal(index + 1).toUpperCase() + " CLOSEST PUB";
    }
}

// Generate directions URL based on selected provider
function getDirectionsUrl(lat, lon, name, provider = selectedMapProvider) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    switch (provider) {
        case 'apple':
            return `maps://maps.apple.com/?daddr=${lat},${lon}&dirflg=w&q=${encodeURIComponent(name)}`;
        case 'waze':
            return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
        case 'google':
        default:
            // Use app URL schemes on mobile devices
            if (isIOS) {
                return `comgooglemaps://?daddr=${lat},${lon}&directionsmode=walking`;
            } else if (isAndroid) {
                return `google.navigation:q=${lat},${lon}&mode=w`;
            }
            // Fallback to web URL for desktop
            return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
    }
}

// Format walking time into readable string
function formatWalkingTime(minutes) {
    if (minutes < 1) {
        return '~< 1 min walk';
    } else if (minutes < 60) {
        return `~${Math.round(minutes)} min walk`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        if (mins === 0) {
            return `~${hours} hr walk`;
        }
        return `~${hours} hr ${mins} min walk`;
    }
}

// Update back button visibility based on navigation history
function updateBackButtonVisibility() {
    if (navigationHistory.length > 0) {
        btnBack.classList.add('visible');
    } else {
        btnBack.classList.remove('visible');
    }
}

// Display a pub result
function displayPub(pub, isBackNavigation = false) {
    pubName.textContent = pub.name;
    
    // Update badge with position
    pubBadge.textContent = getPubBadgeText(currentPubIndex);
    
    // Show confidence badge for uncertain matches
    if (pub.confidence === 'medium') {
        confidenceBadge.style.display = 'block';
        confidenceBadge.textContent = 'NAME MATCH ONLY';
    } else {
        confidenceBadge.style.display = 'none';
    }
    
    // Format distance
    if (pub.distance < 1) {
        pubDistance.textContent = Math.round(pub.distance * 1000);
        document.querySelector('.distance-unit').textContent = 'm';
    } else {
        pubDistance.textContent = pub.distance.toFixed(1);
        document.querySelector('.distance-unit').textContent = 'km';
    }
    
    // Update walking time
    const walkingTimeEl = document.getElementById('walking-time');
    if (walkingTimeEl) {
        walkingTimeEl.textContent = formatWalkingTime(pub.walkingTime);
    }
    
    btnDirections.href = getDirectionsUrl(pub.lat, pub.lon, pub.name);
    showState('result');
    
    // Update back button visibility
    updateBackButtonVisibility();
    
    // Trigger pre-fetching for upcoming pubs (keeps routing data loaded ahead)
    triggerPrefetch();
}

// Main function to find pint
async function findPint() {
    showState('loading');
    currentPubIndex = 0;
    navigationHistory = []; // Reset navigation history
    
    try {
        // Get location
        const location = await getLocation();
        currentLat = location.lat;
        currentLon = location.lon;
        
        // Find pubs
        foundPubs = await findNearbyPubs(currentLat, currentLon);
        
        if (foundPubs.length === 0) {
            throw new Error('No pubs found nearby. Are you in a desert?');
        }
        
        // Display the nearest pub (this will trigger initial pre-fetch)
        displayPub(foundPubs[0]);
        
    } catch (error) {
        errorMessage.textContent = error.message;
        showState('error');
    }
}

// Find another pub (next in the list)
function findAnother() {
    if (foundPubs.length > 1) {
        // Add current index to history before moving forward
        navigationHistory.push(currentPubIndex);
        currentPubIndex = (currentPubIndex + 1) % foundPubs.length;
        displayPub(foundPubs[currentPubIndex]);
    } else {
        // Re-search if only one pub was found
        findPint();
    }
}

// Go back to previous pub
function goBack() {
    if (navigationHistory.length > 0) {
        // Pop the last index from history
        currentPubIndex = navigationHistory.pop();
        displayPub(foundPubs[currentPubIndex], true);
    }
}

// Event listeners
btnFind.addEventListener('click', findPint);
btnRetry.addEventListener('click', findAnother);
btnBack.addEventListener('click', goBack);
btnErrorRetry.addEventListener('click', findPint);

// Handle map app fallback if app isn't installed
btnDirections.addEventListener('click', function(e) {
    const currentUrl = this.href;
    const pub = foundPubs[currentPubIndex];
    const isAppUrl = currentUrl.startsWith('comgooglemaps://') || 
                     currentUrl.startsWith('google.navigation:') || 
                     currentUrl.startsWith('maps://');
    
    if (isAppUrl) {
        // Try to open the app, but provide a web fallback if it fails
        setTimeout(() => {
            // Check if user is still on the page (app didn't open)
            if (document.hasFocus()) {
                // Fallback to web version
                const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${pub.lat},${pub.lon}&travelmode=walking`;
                window.open(webUrl, '_blank');
            }
        }, 1500);
    }
});

// Add keyboard support
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        const activeState = document.querySelector('.state.active');
        
        if (activeState.id === 'state-initial') {
            e.preventDefault();
            findPint();
        } else if (activeState.id === 'state-result') {
            e.preventDefault();
            window.open(btnDirections.href, '_blank');
        } else if (activeState.id === 'state-error') {
            e.preventDefault();
            findPint();
        }
    }
    
    // Close modal on Escape
    if (e.code === 'Escape' && installModal.classList.contains('active')) {
        closeInstallModal();
    }
});

// Install as Web App functionality
function getInstallInstructions() {
    const os = getOS();
    
    switch (os) {
        case 'ios':
            return `
                <ol>
                    <li>Tap the <span class="icon">•••</span> button at the bottom of Safari</li>
                    <li>Tap <span class="icon">⬆️</span> <strong>"Share"</strong></li>
                    <li>Tap <strong>"Add to Home Screen"</strong></li>
                    <li>Tap <strong>"Add"</strong> in the top right</li>
                </ol>
                <p style="margin-top: 1rem; font-size: 0.85rem; opacity: 0.7;">The app icon will appear on your home screen!</p>
            `;
        case 'android':
            return `
                <ol>
                    <li>Tap the <span class="icon">⋮</span> menu button (top right)</li>
                    <li>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
                    <li>Tap <strong>"Add"</strong> to confirm</li>
                </ol>
                <p style="margin-top: 1rem; font-size: 0.85rem; opacity: 0.7;">The app icon will appear on your home screen!</p>
            `;
        case 'mac':
            return `
                <ol>
                    <li>In Safari: File → <strong>"Add to Dock"</strong></li>
                    <li>Or in Chrome: Click <span class="icon">⋮</span> → <strong>"Save and Share"</strong> → <strong>"Install"</strong></li>
                </ol>
            `;
        case 'windows':
            return `
                <ol>
                    <li>In Chrome/Edge: Click the <span class="icon">⊕</span> install icon in the address bar</li>
                    <li>Or click <span class="icon">⋮</span> → <strong>"Install I Need A Pint"</strong></li>
                </ol>
            `;
        default:
            return `
                <ol>
                    <li>Look for an "Install" or "Add to Home Screen" option in your browser menu</li>
                    <li>This creates a shortcut for quick access</li>
                </ol>
            `;
    }
}

function openInstallModal() {
    installInstructions.innerHTML = getInstallInstructions();
    installModal.classList.add('active');
}

function closeInstallModal() {
    installModal.classList.remove('active');
}

// Install button events
btnInstall.addEventListener('click', openInstallModal);
modalClose.addEventListener('click', closeInstallModal);
installModal.addEventListener('click', (e) => {
    if (e.target === installModal) {
        closeInstallModal();
    }
});

// Map provider selection
document.querySelectorAll('.map-provider-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Update active state
        document.querySelectorAll('.map-provider-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        // Update selected provider
        selectedMapProvider = this.dataset.provider;
        localStorage.setItem('mapProvider', selectedMapProvider);
        
        // Update directions URL
        if (foundPubs.length > 0) {
            const pub = foundPubs[currentPubIndex];
            btnDirections.href = getDirectionsUrl(pub.lat, pub.lon, pub.name);
        }
    });
});

// Initialize map provider buttons on load
function initializeMapProvider() {
    document.querySelectorAll('.map-provider-btn').forEach(btn => {
        if (btn.dataset.provider === selectedMapProvider) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Check if app is installed (running in standalone mode)
function isAppInstalled() {
    // Check if running as standalone app on iOS/Android
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

// Hide install button if app is already installed
function updateInstallButtonVisibility() {
    if (isAppInstalled() && btnInstall) {
        btnInstall.style.display = 'none';
    }
}

// Initialize on page load
initializeMapProvider();
updateInstallButtonVisibility();

// ============================================
// PUB CRAWL PLANNING FEATURE
// ============================================

let crawlMapInstance = null;
let crawlMarker = null;
let crawlPubMarkers = [];
let crawlStartLocation = null;
let crawlNearbyPubs = [];
let crawlSelectedPubs = [];
let crawlPolyline = null;

// Initialize Leaflet map for pub crawl
function initCrawlMap() {
    if (crawlMapInstance) {
        crawlMapInstance.remove();
    }
    
    // Create map centered on UK
    crawlMapInstance = L.map('crawl-map', {
        zoomControl: true,
        attributionControl: true
    }).setView([51.5074, -0.1278], 6);
    
    // Add tile layer with dark theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19
    }).addTo(crawlMapInstance);
    
    // Add click handler for dropping pin
    crawlMapInstance.on('click', onMapClick);
    
    // Try to get user's location to center map
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                crawlMapInstance.setView([userLat, userLon], 13);
            },
            error => {
                console.log('Could not get user location for map centering:', error);
            },
            { timeout: 5000 }
        );
    }
}

// Custom map icons
function createPubIcon(color = '#f5a623', label = '') {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background: ${color};
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid #1a0f0a;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        ">
            <span style="
                transform: rotate(45deg);
                color: #1a0f0a;
                font-weight: bold;
                font-size: 14px;
            ">${label || '🍺'}</span>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

// Handle map click to drop pin
async function onMapClick(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    
    // Remove existing marker if any
    if (crawlMarker) {
        crawlMapInstance.removeLayer(crawlMarker);
    }
    
    // Add new marker
    crawlMarker = L.marker([lat, lon], {
        icon: createPubIcon('#ffc857', '📍')
    }).addTo(crawlMapInstance);
    
    crawlMarker.bindPopup('Starting Point').openPopup();
    
    // Store location
    crawlStartLocation = { lat, lon };
    
    // Update instructions
    crawlInstructions.innerHTML = '<p>🔍 Finding nearby pubs...</p>';
    
    // Clear previous data
    clearCrawlData();
    
    // Find nearby pubs
    try {
        crawlNearbyPubs = await findNearbyPubs(lat, lon);
        displayCrawlPubsList();
        crawlInstructions.style.display = 'none';
        crawlPubsSection.style.display = 'block';
    } catch (error) {
        crawlInstructions.innerHTML = `<p>❌ ${error.message}</p>`;
    }
}

// Display list of nearby pubs
function displayCrawlPubsList() {
    crawlPubsList.innerHTML = '';
    
    // Show top 20 pubs
    const pubsToShow = crawlNearbyPubs.slice(0, 20);
    
    if (pubsToShow.length === 0) {
        crawlPubsList.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 1rem;">No pubs found in this area. Try a different location!</p>';
        return;
    }
    
    pubsToShow.forEach((pub, index) => {
        const item = document.createElement('div');
        item.className = 'crawl-pub-item';
        
        const distanceText = pub.distance < 1 
            ? `${Math.round(pub.distance * 1000)}m` 
            : `${pub.distance.toFixed(1)}km`;
        
        item.innerHTML = `
            <div class="crawl-pub-info">
                <div class="crawl-pub-name">${pub.name}</div>
                <div class="crawl-pub-distance">${distanceText} away</div>
            </div>
            <div class="crawl-pub-action">+</div>
        `;
        
        item.addEventListener('click', () => addPubToCrawl(pub));
        
        crawlPubsList.appendChild(item);
        
        // Add marker to map
        const marker = L.marker([pub.lat, pub.lon], {
            icon: createPubIcon('#f5a623', '🍺')
        }).addTo(crawlMapInstance);
        
        marker.bindPopup(`<strong>${pub.name}</strong><br>${distanceText}`);
        
        // Add click handler to marker to add pub to crawl
        marker.on('click', () => addPubToCrawl(pub));
        
        crawlPubMarkers.push(marker);
    });
}

// Add pub to crawl selection
function addPubToCrawl(pub) {
    // Check if already added
    if (crawlSelectedPubs.find(p => p.lat === pub.lat && p.lon === pub.lon)) {
        // Flash feedback that it's already added
        const existingItems = crawlSelectedList.querySelectorAll('.crawl-selected-item');
        existingItems.forEach((item, i) => {
            if (crawlSelectedPubs[i].lat === pub.lat && crawlSelectedPubs[i].lon === pub.lon) {
                item.style.background = 'rgba(245, 166, 35, 0.3)';
                setTimeout(() => {
                    item.style.background = 'rgba(245, 166, 35, 0.1)';
                }, 300);
            }
        });
        return;
    }
    
    crawlSelectedPubs.push(pub);
    updateCrawlDisplay();
    
    // Show selected section if hidden
    if (crawlSelectedSection.style.display === 'none') {
        crawlSelectedSection.style.display = 'block';
    }
    
    // Scroll to selected section
    setTimeout(() => {
        crawlSelectedSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

// Remove pub from crawl
function removePubFromCrawl(index) {
    crawlSelectedPubs.splice(index, 1);
    updateCrawlDisplay();
    
    // Don't hide section completely, just show it's empty
    if (crawlSelectedPubs.length === 0) {
        // Keep section visible but with empty state
        updateCrawlRoute();
    }
}

// Update crawl display
function updateCrawlDisplay() {
    crawlSelectedList.innerHTML = '';
    
    if (crawlSelectedPubs.length === 0) {
        crawlSelectedList.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 1rem;">No pubs selected yet. Add pubs from the list above!</p>';
    }
    
    crawlSelectedPubs.forEach((pub, index) => {
        const item = document.createElement('div');
        item.className = 'crawl-selected-item';
        item.draggable = true;
        item.dataset.index = index;
        
        const distanceText = pub.distance < 1 
            ? `${Math.round(pub.distance * 1000)}m` 
            : `${pub.distance.toFixed(1)}km`;
        
        item.innerHTML = `
            <div class="crawl-order-num">${index + 1}</div>
            <div class="crawl-pub-info">
                <div class="crawl-pub-name">${pub.name}</div>
                <div class="crawl-pub-distance">${distanceText}</div>
            </div>
            <div class="crawl-pub-action" style="background: rgba(255, 0, 0, 0.2); border-color: #ff4444; color: #ff4444;">×</div>
        `;
        
        // Click to highlight on map
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('crawl-pub-action')) {
                highlightPubOnMap(index);
            }
        });
        
        // Remove button
        const removeBtn = item.querySelector('.crawl-pub-action');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removePubFromCrawl(index);
        });
        
        // Drag and drop handlers
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        
        crawlSelectedList.appendChild(item);
    });
    
    // Update stats
    updateCrawlStats();
    
    // Update route on map
    updateCrawlRoute();
}

// Highlight pub on map when clicked in list
function highlightPubOnMap(index) {
    if (crawlPubMarkers[index]) {
        const pub = crawlSelectedPubs[index];
        crawlMapInstance.setView([pub.lat, pub.lon], 16, {
            animate: true,
            duration: 0.5
        });
        crawlPubMarkers[index].openPopup();
    }
}

// Calculate total crawl stats
async function updateCrawlStats() {
    const count = crawlSelectedPubs.length;
    crawlCount.textContent = `${count} pub${count !== 1 ? 's' : ''}`;
    
    if (count === 0 || !crawlStartLocation) {
        crawlDistance.textContent = '0 km';
        return;
    }
    
    // Calculate total distance
    let totalDistance = 0;
    let prevLat = crawlStartLocation.lat;
    let prevLon = crawlStartLocation.lon;
    
    for (const pub of crawlSelectedPubs) {
        const dist = calculateDistance(prevLat, prevLon, pub.lat, pub.lon);
        totalDistance += dist;
        prevLat = pub.lat;
        prevLon = pub.lon;
    }
    
    // Calculate walking time (80m/min like Google Maps)
    const distanceMeters = totalDistance * 1000;
    const walkingMinutes = distanceMeters / 80;
    const walkingTime = formatWalkingTime(walkingMinutes);
    
    const distanceText = totalDistance < 1 
        ? `${Math.round(totalDistance * 1000)}m` 
        : `${totalDistance.toFixed(1)}km`;
    
    crawlDistance.textContent = `${distanceText} • ${walkingTime}`;
}

// Update route visualization on map
function updateCrawlRoute() {
    // Remove existing polyline
    if (crawlPolyline) {
        crawlMapInstance.removeLayer(crawlPolyline);
        crawlPolyline = null;
    }
    
    // Remove existing numbered markers
    crawlPubMarkers.forEach(marker => crawlMapInstance.removeLayer(marker));
    crawlPubMarkers = [];
    
    if (crawlSelectedPubs.length === 0 || !crawlStartLocation) {
        // If no selected pubs, re-show all available pub markers
        if (crawlNearbyPubs.length > 0 && crawlSelectedPubs.length === 0) {
            displayCrawlPubsList();
        }
        return;
    }
    
    // Create route coordinates
    const routeCoords = [[crawlStartLocation.lat, crawlStartLocation.lon]];
    crawlSelectedPubs.forEach(pub => {
        routeCoords.push([pub.lat, pub.lon]);
    });
    
    // Draw polyline
    crawlPolyline = L.polyline(routeCoords, {
        color: '#f5a623',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 5'
    }).addTo(crawlMapInstance);
    
    // Fit bounds to show full route (only if more than 1 pub)
    if (crawlSelectedPubs.length > 1) {
        const bounds = L.latLngBounds(routeCoords);
        crawlMapInstance.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Add numbered markers for selected pubs
    crawlSelectedPubs.forEach((pub, index) => {
        const marker = L.marker([pub.lat, pub.lon], {
            icon: createPubIcon('#f5a623', `${index + 1}`)
        }).addTo(crawlMapInstance);
        
        marker.bindPopup(`<strong>${index + 1}. ${pub.name}</strong>`);
        
        // Add click handler to highlight in list
        marker.on('click', () => {
            const items = crawlSelectedList.querySelectorAll('.crawl-selected-item');
            if (items[index]) {
                items[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                items[index].style.background = 'rgba(245, 166, 35, 0.3)';
                setTimeout(() => {
                    items[index].style.background = 'rgba(245, 166, 35, 0.1)';
                }, 300);
            }
        });
        
        crawlPubMarkers.push(marker);
    });
    
    // Also show unselected pubs with different icon
    const selectedCoords = new Set(crawlSelectedPubs.map(p => `${p.lat},${p.lon}`));
    crawlNearbyPubs.slice(0, 20).forEach(pub => {
        if (!selectedCoords.has(`${pub.lat},${pub.lon}`)) {
            const marker = L.marker([pub.lat, pub.lon], {
                icon: createPubIcon('#888', '🍺'),
                opacity: 0.5
            }).addTo(crawlMapInstance);
            
            const distanceText = pub.distance < 1 
                ? `${Math.round(pub.distance * 1000)}m` 
                : `${pub.distance.toFixed(1)}km`;
            
            marker.bindPopup(`<strong>${pub.name}</strong><br>${distanceText}`);
            marker.on('click', () => addPubToCrawl(pub));
        }
    });
}

// Drag and drop handlers
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedItem !== this) {
        const draggedIndex = parseInt(draggedItem.dataset.index);
        const targetIndex = parseInt(this.dataset.index);
        
        // Reorder array
        const item = crawlSelectedPubs.splice(draggedIndex, 1)[0];
        crawlSelectedPubs.splice(targetIndex, 0, item);
        
        updateCrawlDisplay();
    }
    
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
}

// Clear all crawl data
function clearCrawlData() {
    crawlSelectedPubs = [];
    crawlNearbyPubs = [];
    
    // Clear markers
    crawlPubMarkers.forEach(marker => crawlMapInstance.removeLayer(marker));
    crawlPubMarkers = [];
    
    // Clear polyline
    if (crawlPolyline) {
        crawlMapInstance.removeLayer(crawlPolyline);
        crawlPolyline = null;
    }
    
    // Hide sections
    crawlPubsSection.style.display = 'none';
    crawlSelectedSection.style.display = 'none';
}

// Share crawl functionality
function shareCrawl() {
    if (crawlSelectedPubs.length === 0) {
        alert('Please add pubs to your crawl first!');
        return;
    }
    
    // Generate share text with Google Maps links
    let shareText = '🍺 My Pub Crawl Plan:\n\n';
    
    if (crawlStartLocation) {
        shareText += `📍 Starting at: ${crawlStartLocation.lat.toFixed(4)}, ${crawlStartLocation.lon.toFixed(4)}\n\n`;
    }
    
    crawlSelectedPubs.forEach((pub, index) => {
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${pub.lat},${pub.lon}`;
        shareText += `${index + 1}. ${pub.name}\n   ${mapsUrl}\n\n`;
    });
    
    // Calculate total stats
    let totalDistance = 0;
    let prevLat = crawlStartLocation.lat;
    let prevLon = crawlStartLocation.lon;
    
    for (const pub of crawlSelectedPubs) {
        const dist = calculateDistance(prevLat, prevLon, pub.lat, pub.lon);
        totalDistance += dist;
        prevLat = pub.lat;
        prevLon = pub.lon;
    }
    
    const distanceMeters = totalDistance * 1000;
    const walkingMinutes = distanceMeters / 80;
    const walkingTime = formatWalkingTime(walkingMinutes);
    
    shareText += `Total: ${crawlSelectedPubs.length} pubs • ${totalDistance.toFixed(1)}km • ${walkingTime}`;
    shareText += `\n\nCreated with "I Need A Pint" 🍺`;
    
    // Try native share API
    if (navigator.share) {
        navigator.share({
            title: 'My Pub Crawl Plan',
            text: shareText
        }).catch(err => {
            console.log('Share cancelled or failed');
            // Fallback to clipboard
            copyToClipboard(shareText);
        });
    } else {
        // Fallback: copy to clipboard
        copyToClipboard(shareText);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Crawl plan copied to clipboard! 📋');
        }).catch(err => {
            console.error('Failed to copy:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        alert('Crawl plan copied to clipboard! 📋');
    } catch (err) {
        alert('Could not copy to clipboard. Please try again.');
    }
    
    document.body.removeChild(textArea);
}

// Start navigation through crawl
function startCrawlNavigation() {
    if (crawlSelectedPubs.length === 0) {
        alert('Please add pubs to your crawl first!');
        return;
    }
    
    const firstPub = crawlSelectedPubs[0];
    
    // If we have a start location, navigate from there to first pub
    if (crawlStartLocation) {
        const url = getDirectionsUrl(firstPub.lat, firstPub.lon, firstPub.name);
        window.open(url, '_blank');
    } else {
        // Just navigate to first pub
        const url = getDirectionsUrl(firstPub.lat, firstPub.lon, firstPub.name);
        window.open(url, '_blank');
    }
}

// Clear all selected pubs
function clearAllPubs() {
    if (crawlSelectedPubs.length === 0) return;
    
    if (confirm('Clear all pubs from your crawl?')) {
        crawlSelectedPubs = [];
        updateCrawlDisplay();
        
        // Remove polyline
        if (crawlPolyline) {
            crawlMapInstance.removeLayer(crawlPolyline);
            crawlPolyline = null;
        }
        
        // Remove numbered markers and re-display pub markers
        crawlPubMarkers.forEach(marker => crawlMapInstance.removeLayer(marker));
        crawlPubMarkers = [];
        displayCrawlPubsList();
    }
}

// Event listeners for pub crawl
btnPlanCrawl.addEventListener('click', () => {
    showState('crawl');
    
    // Initialize map after state is visible
    setTimeout(() => {
        initCrawlMap();
        crawlInstructions.style.display = 'block';
        crawlInstructions.innerHTML = '<p>📍 Click the map to set your starting point</p>';
    }, 100);
});

btnCrawlBack.addEventListener('click', () => {
    showState('initial');
    
    // Clean up map
    if (crawlMapInstance) {
        crawlMapInstance.remove();
        crawlMapInstance = null;
    }
    
    clearCrawlData();
    crawlMarker = null;
    crawlStartLocation = null;
});

btnCrawlShare.addEventListener('click', shareCrawl);
btnCrawlNavigate.addEventListener('click', startCrawlNavigation);
btnCrawlClear.addEventListener('click', clearAllPubs);

