const btn = document.getElementById("randomizeButton");
const result = document.getElementById("result");

const MAX_DISTANCE = 5000;
const COMPLETION_RADIUS = 50;
const HISTORY_LIMIT = 8;

let latitude = null;
let longitude = null;
let gpsWatch = null;

let activeChallenge = null;
let challengeHistory = [];

let map = null;
let playerMarker = null;
let targetMarker = null;
let routeLine = null;

let xp = Number(localStorage.getItem("greencheckXP")) || 0;
let level = Number(localStorage.getItem("greencheckLevel")) || 1;

// ============================================================
// CHALLENGES
// ============================================================

const challenges = {

forest: [
    "Find an interesting tree.",
    "Find two different types of trees.",
    "Find a tree with an unusual shape.",
    "Find something naturally fallen from a tree.",
    "Find three different shades of green.",
    "Find a plant growing underneath a tree."
],

park: [
    "Find three different plants.",
    "Find the biggest tree you can see.",
    "Find a quiet green area.",
    "Find something natural you haven't noticed before.",
    "Find two different types of vegetation."
],

garden: [
    "Find a flower.",
    "Find two different types of plants.",
    "Find a plant with an interesting shape.",
    "Find three different colours.",
    "Find unusual leaves."
],

meadow: [
    "Find three different plants.",
    "Find a flower growing in the grass.",
    "Find an interesting natural object.",
    "Find three different shades of green.",
    "Find the most interesting plant you can see."
],

scrub: [
    "Find an interesting bush.",
    "Find two different types of plants.",
    "Find three different leaf shapes.",
    "Find something naturally growing near the path."
],

orchard: [
    "Find two different-looking trees.",
    "Find a tree with interesting branches.",
    "Find the most interesting tree you can see."
],

vineyard: [
    "Find three rows of plants.",
    "Find something growing between the rows.",
    "Find the most interesting-looking plant."
],

nature_reserve: [
    "Find three different types of plants.",
    "Find something completely natural.",
    "Find an interesting tree.",
    "Find two different types of vegetation."
],

wetland: [
    "Find vegetation growing near the wetland.",
    "Find three different plants.",
    "Find an interesting natural feature."
],

water: [
    "Find a plant growing near the water.",
    "Find an interesting reflection.",
    "Find vegetation close to the water."
],

viewpoint: [
    "Reach the viewpoint and find the best view.",
    "Find three natural features from the viewpoint.",
    "Find the most interesting thing you can see."
],

path: [
    "Find a plant growing beside the path.",
    "Find three different natural objects.",
    "Find something interesting along the path."
],

heath: [
    "Find an interesting plant.",
    "Find three different types of vegetation.",
    "Find something that stands out in the landscape."
]

};

// ============================================================
// FALLBACK
// ============================================================

const fallbackChallenges = [
"Find something green nearby.",
"Find an interesting plant.",
"Find something natural.",
"Find something you haven't noticed before."
];

// ============================================================
// START LOCATION
// ============================================================

navigator.geolocation.getCurrentPosition(

position => {

    latitude = position.coords.latitude;
    longitude = position.coords.longitude;

    console.log("📍 Location received:", latitude, longitude);

    initializeMap();

    updatePlayerMarker();

    startGPS();

},

error => {

    console.error("Location error:", error);

    if (error.code === 1) {
        result.textContent =
            "📍 Please allow location access to use GreenCheck.";
    } else {
        result.textContent =
            "Couldn't get your location.";
    }

},

{
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 10000
}

);

// ============================================================
// MAP
// ============================================================

function initializeMap() {

if (map) return;

map = L.map("map").setView(
    [latitude, longitude],
    14
);

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors"
    }
).addTo(map);

}

// ============================================================
// PLAYER MARKER
// ============================================================

function updatePlayerMarker() {

if (!map || latitude === null) return;

const position = [
    latitude,
    longitude
];

if (!playerMarker) {

    playerMarker = L.marker(position)
        .addTo(map)
        .bindPopup("📍 You");

} else {

    playerMarker.setLatLng(position);

}

}

// ============================================================
// RANDOMIZE
// ============================================================

btn.addEventListener("click", async () => {

if (latitude === null || longitude === null) {

    result.textContent =
        "📍 Waiting for your location...";

    return;
}

if (activeChallenge) {

    result.textContent =
        "🎯 Finish your current challenge first!";

    return;
}

result.textContent =
    "🌍 Searching nearby green areas...";

btn.disabled = true;

try {

    const places =
        await getNearbyPlaces(latitude, longitude);

    const processed =
        processPlaces(places);

    if (!processed.length) {

        result.textContent =
            "Couldn't find a suitable nearby location.";

        return;
    }

    const place =
        choosePlace(processed);

    const challenge =
        createChallenge(place);

    activeChallenge = {
        ...place,
        text: challenge
    };

    showChallenge();

    setTarget();

    startGPS();

} catch (error) {

    console.error(error);

    result.textContent =
        "🌐 Couldn't load map data. Try again.";

} finally {

    btn.disabled = false;

}

});

// ============================================================
// OPENSTREETMAP
// ============================================================

async function getNearbyPlaces(lat, lon) {

const query = `

[out:json][timeout:25];

(
nwr(around:${MAX_DISTANCE},${lat},${lon})["natural"~"wood|scrub|grassland|heath|wetland|water"];

nwr(around:${MAX_DISTANCE},${lat},${lon})["landuse"~"forest|meadow|grass|orchard|vineyard"];

nwr(around:${MAX_DISTANCE},${lat},${lon})["leisure"~"park|garden|nature_reserve"];

nwr(around:${MAX_DISTANCE},${lat},${lon})["tourism"="viewpoint"];

nwr(around:${MAX_DISTANCE},${lat},${lon})["waterway"~"river|stream"];

nwr(around:${MAX_DISTANCE},${lat},${lon})["highway"~"path|footway|pedestrian"];

);

out center tags;
`;

const response = await fetch(
    "https://overpass-api.de/api/interpreter",
    {
        method: "POST",
        body: query
    }
);

if (!response.ok) {
    throw new Error("Overpass request failed");
}

const data = await response.json();

return data.elements || [];

}

// ============================================================
// PROCESS PLACES
// ============================================================

function processPlaces(places) {

return places
    .map(place => {

        const tags = place.tags || {};

        const placeLat =
            place.lat ?? place.center?.lat;

        const placeLon =
            place.lon ?? place.center?.lon;

        if (
            placeLat === undefined ||
            placeLon === undefined
        ) {
            return null;
        }

        const distance =
            calculateDistance(
                latitude,
                longitude,
                placeLat,
                placeLon
            );

        if (distance > MAX_DISTANCE) {
            return null;
        }

        const type =
            getPlaceType(tags);

        if (!type) {
            return null;
        }

        return {
            id: place.id,
            latitude: placeLat,
            longitude: placeLon,
            distance,
            type,
            name: tags.name || null,
            tags
        };

    })
    .filter(Boolean);

}

// ============================================================
// TYPE
// ============================================================

function getPlaceType(tags) {

if (tags.leisure === "nature_reserve")
    return "nature_reserve";

if (
    tags.natural === "wood" ||
    tags.landuse === "forest"
)
    return "forest";

if (tags.leisure === "park")
    return "park";

if (tags.leisure === "garden")
    return "garden";

if (tags.landuse === "orchard")
    return "orchard";

if (tags.landuse === "vineyard")
    return "vineyard";

if (
    tags.landuse === "meadow" ||
    tags.landuse === "grass" ||
    tags.natural === "grassland"
)
    return "meadow";

if (tags.natural === "scrub")
    return "scrub";

if (tags.natural === "heath")
    return "heath";

if (tags.natural === "wetland")
    return "wetland";

if (
    tags.natural === "water" ||
    tags.waterway === "river" ||
    tags.waterway === "stream"
)
    return "water";

if (tags.tourism === "viewpoint")
    return "viewpoint";

if (
    tags.highway === "path" ||
    tags.highway === "footway" ||
    tags.highway === "pedestrian"
)
    return "path";

return null;

}

// ============================================================
// DISTANCE
// ============================================================

function calculateDistance(
lat1,
lon1,
lat2,
lon2
) {

const R = 6371000;

const p1 =
    lat1 * Math.PI / 180;

const p2 =
    lat2 * Math.PI / 180;

const dLat =
    (lat2 - lat1) * Math.PI / 180;

const dLon =
    (lon2 - lon1) * Math.PI / 180;

const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) *
    Math.cos(p2) *
    Math.sin(dLon / 2) ** 2;

return R *
    2 *
    Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

}

// ============================================================
// CHOOSE PLACE
// ============================================================

function choosePlace(places) {

const weighted = [];

places.forEach(place => {

    let weight;

    if (place.distance < 500)
        weight = 10;

    else if (place.distance < 1000)
        weight = 8;

    else if (place.distance < 2000)
        weight = 5;

    else if (place.distance < 3500)
        weight = 3;

    else
        weight = 1;

    for (let i = 0; i < weight; i++) {
        weighted.push(place);
    }

});

return weighted[
    Math.floor(
        Math.random() * weighted.length
    )
];

}

// ============================================================
// CREATE CHALLENGE
// ============================================================

function createChallenge(place) {

const list =
    challenges[place.type] ||
    fallbackChallenges;

let available =
    list.filter(
        challenge =>
            !challengeHistory.includes(challenge)
    );

if (!available.length)
    available = list;

const selected =
    available[
        Math.floor(
            Math.random() * available.length
        )
    ];

challengeHistory.push(selected);

if (
    challengeHistory.length >
    HISTORY_LIMIT
) {
    challengeHistory.shift();
}

return selected;

}

// ============================================================
// SHOW CHALLENGE
// ============================================================

function showChallenge() {

const distance =
    formatDistance(
        activeChallenge.distance
    );

const name =
    activeChallenge.name ||
    activeChallenge.type.replace(
        "_",
        " "
    );

result.innerHTML =
    `<strong>🌿 ${activeChallenge.text}</strong>
    <br>
    📍 ${name}
    <br>
    🚶 ${distance} away`;

}

// ============================================================
// TARGET
// ============================================================

function setTarget() {

if (!map || !activeChallenge)
    return;

if (targetMarker)
    map.removeLayer(targetMarker);

if (routeLine)
    map.removeLayer(routeLine);

targetMarker =
    L.marker([
        activeChallenge.latitude,
        activeChallenge.longitude
    ])
    .addTo(map)
    .bindPopup("🎯 Challenge location");

routeLine =
    L.polyline([
        [latitude, longitude],
        [
            activeChallenge.latitude,
            activeChallenge.longitude
        ]
    ])
    .addTo(map);

map.fitBounds(
    routeLine.getBounds(),
    {
        padding: [30, 30]
    }
);

}

// ============================================================
// GPS TRACKING
// ============================================================

function startGPS() {

if (gpsWatch !== null)
    return;

gpsWatch =
    navigator.geolocation.watchPosition(

        position => {

            latitude =
                position.coords.latitude;

            longitude =
                position.coords.longitude;

            updatePlayerMarker();

            if (activeChallenge)
                updateChallengeDistance();

        },

        error => {

            console.log(
                "GPS tracking error:",
                error
            );

        },

        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000
        }

    );

}

// ============================================================
// LIVE DISTANCE
// ============================================================

function updateChallengeDistance() {

const distance =
    calculateDistance(
        latitude,
        longitude,
        activeChallenge.latitude,
        activeChallenge.longitude
    );

if (routeLine) {

    routeLine.setLatLngs([
        [latitude, longitude],
        [
            activeChallenge.latitude,
            activeChallenge.longitude
        ]
    ]);

}

const name =
    activeChallenge.name ||
    activeChallenge.type.replace(
        "_",
        " "
    );

result.innerHTML =
    `<strong>🌿 ${activeChallenge.text}</strong>
    <br>
    📍 ${name}
    <br>
    🚶 ${formatDistance(distance)}`;

if (distance <= COMPLETION_RADIUS) {
    completeChallenge();
}

}

// ============================================================
// COMPLETE
// ============================================================

function completeChallenge() {

const completed =
    activeChallenge;

activeChallenge = null;

if (targetMarker) {

    map.removeLayer(targetMarker);
    targetMarker = null;

}

if (routeLine) {

    map.removeLayer(routeLine);
    routeLine = null;

}

addXP(100);

result.innerHTML =
    `✅ <strong>Challenge reached!</strong>
    <br>
    ⭐ +100 XP`;

console.log(
    "Challenge completed:",
    completed
);

}

// ============================================================
// XP
// ============================================================

function addXP(amount) {

xp += amount;

while (
    xp >= getXPRequired()
) {

    xp -= getXPRequired();

    level++;

}

localStorage.setItem(
    "greencheckXP",
    xp
);

localStorage.setItem(
    "greencheckLevel",
    level
);

updateXPUI();

}

// ============================================================
// XP REQUIRED
// ============================================================

function getXPRequired() {

return 100 + (level - 1) * 50;

}

// ============================================================
// XP UI
// ============================================================

function updateXPUI() {

const levelText =
    document.getElementById("levelText");

const xpText =
    document.getElementById("xpText");

const fill =
    document.getElementById("xpFill");

if (
    !levelText ||
    !xpText ||
    !fill
)
    return;

const required =
    getXPRequired();

const percentage =
    Math.min(
        100,
        xp / required * 100
    );

levelText.textContent =
    `Level ${level}`;

xpText.textContent =
    `${xp} / ${required} XP`;

fill.style.width =
    `${percentage}%`;

}

// ============================================================
// FORMAT DISTANCE
// ============================================================

function formatDistance(distance) {

if (distance < 1000) {
    return Math.round(distance) + " m";
}

return (
    distance / 1000
).toFixed(1) + " km";

}

updateXPUI();