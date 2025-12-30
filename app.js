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
const pubName = document.getElementById('pub-name');
const pubDistance = document.getElementById('pub-distance');
const errorMessage = document.getElementById('error-message');

// Current location and pubs data
let currentLat = null;
let currentLon = null;
let foundPubs = [];
let currentPubIndex = 0;

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

function requestGeolocation(resolve, reject) {
    navigator.geolocation.getCurrentPosition(
        position => {
            resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude
            });
        },
        error => {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    if (isIOS) {
                        reject(new Error('Location blocked. Go to Settings → Privacy & Security → Location Services → Safari Websites → set to "While Using". Then refresh.'));
                    } else {
                        reject(new Error('Location access denied. Please enable location in your browser settings and refresh.'));
                    }
                    break;
                case error.POSITION_UNAVAILABLE:
                    reject(new Error('Location unavailable. Please check that Location Services is enabled on your device.'));
                    break;
                case error.TIMEOUT:
                    reject(new Error('Location request timed out. Please try again.'));
                    break;
                default:
                    reject(new Error('Could not get location. Please check your settings and try again.'));
            }
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

// Generate directions URL (works on both iOS and Android)
function getDirectionsUrl(lat, lon, name) {
    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
        // Apple Maps
        return `maps://maps.apple.com/?daddr=${lat},${lon}&dirflg=w&q=${encodeURIComponent(name)}`;
    } else {
        // Google Maps (works everywhere)
        return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
    }
}

// Display a pub result
function displayPub(pub) {
    pubName.textContent = pub.name;
    
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

// Handle iOS Safari to use Google Maps as fallback if Apple Maps doesn't open
btnDirections.addEventListener('click', function(e) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
        // Try Apple Maps first, fallback to Google Maps after a delay
        const pub = foundPubs[currentPubIndex];
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pub.lat},${pub.lon}&travelmode=walking`;
        
        // Set a fallback to Google Maps
        setTimeout(() => {
            // If we're still on the page, Apple Maps likely didn't open
            window.location.href = googleMapsUrl;
        }, 2500);
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
});

