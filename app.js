// State management
const states = {
    initial: document.getElementById('state-initial'),
    loading: document.getElementById('state-loading'),
    result: document.getElementById('state-result'),
    error: document.getElementById('state-error')
};

// Elements
const btnFind = document.getElementById('btn-find');
const btnRetry = document.getElementById('btn-retry');
const btnErrorRetry = document.getElementById('btn-error-retry');
const btnDirections = document.getElementById('btn-directions');
const btnInstall = document.getElementById('btn-install');
const installModal = document.getElementById('install-modal');
const modalClose = document.getElementById('modal-close');
const installInstructions = document.getElementById('install-instructions');
const pubName = document.getElementById('pub-name');
const pubDistance = document.getElementById('pub-distance');
const pubBadge = document.getElementById('pub-badge');
const errorMessage = document.getElementById('error-message');

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
let selectedMapProvider = localStorage.getItem('mapProvider') || getDefaultMapProvider();

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

// Calculate distance between two points using Haversine formula
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

// Find nearby pubs using Overpass API (OpenStreetMap)
async function findNearbyPubs(lat, lon) {
    const radius = 3000; // 3km radius
    
    // Query for pubs, bars, and biergartens
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="pub"](around:${radius},${lat},${lon});
            node["amenity"="bar"](around:${radius},${lat},${lon});
            node["amenity"="biergarten"](around:${radius},${lat},${lon});
            way["amenity"="pub"](around:${radius},${lat},${lon});
            way["amenity"="bar"](around:${radius},${lat},${lon});
            way["amenity"="biergarten"](around:${radius},${lat},${lon});
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
    
    // Process and sort by distance
    const pubs = data.elements
        .map(element => {
            // Handle both nodes and ways (ways have center property)
            const pubLat = element.lat || element.center?.lat;
            const pubLon = element.lon || element.center?.lon;
            
            if (!pubLat || !pubLon) return null;
            
            const distance = calculateDistance(lat, lon, pubLat, pubLon);
            
            return {
                name: element.tags?.name || 'Unnamed Pub',
                lat: pubLat,
                lon: pubLon,
                distance: distance,
                type: element.tags?.amenity
            };
        })
        .filter(pub => pub !== null)
        .sort((a, b) => a.distance - b.distance);
    
    return pubs;
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

// Display a pub result
function displayPub(pub) {
    pubName.textContent = pub.name;
    
    // Update badge with position
    pubBadge.textContent = getPubBadgeText(currentPubIndex);
    
    // Format distance
    if (pub.distance < 1) {
        pubDistance.textContent = Math.round(pub.distance * 1000);
        document.querySelector('.distance-unit').textContent = 'm away';
    } else {
        pubDistance.textContent = pub.distance.toFixed(1);
        document.querySelector('.distance-unit').textContent = 'km away';
    }
    
    btnDirections.href = getDirectionsUrl(pub.lat, pub.lon, pub.name);
    showState('result');
}

// Main function to find pint
async function findPint() {
    showState('loading');
    currentPubIndex = 0;
    
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
        
        // Display the nearest pub
        displayPub(foundPubs[0]);
        
    } catch (error) {
        errorMessage.textContent = error.message;
        showState('error');
    }
}

// Find another pub (next in the list)
function findAnother() {
    if (foundPubs.length > 1) {
        currentPubIndex = (currentPubIndex + 1) % foundPubs.length;
        displayPub(foundPubs[currentPubIndex]);
    } else {
        // Re-search if only one pub was found
        findPint();
    }
}

// Event listeners
btnFind.addEventListener('click', findPint);
btnRetry.addEventListener('click', findAnother);
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
                    <li>Tap the <span class="icon">⎙</span> Share button at the bottom of Safari</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
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

// Initialize on page load
initializeMapProvider();

