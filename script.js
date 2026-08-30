const btn = document.getElementById("randomizeButton");
const result = document.getElementById("result");

const SEARCH_RADIUS = 5000;
const COMPLETION_RADIUS = 20;
const HISTORY_LIMIT = 8;

let latitude = null;
let longitude = null;
let gpsWatch = null;

let map = null;
let playerMarker = null;
let environmentLayers = [];

let activeChallenge = null;
let challengeHistory = [];

let xp = Number(localStorage.getItem("greencheckXP")) || 0;
let level = Number(localStorage.getItem("greencheckLevel")) || 1;

// ============================================================
// CHALLENGE DATABASE
// ============================================================

const challengeSets = {

forest: [
    ["🌲 Find 2 different types of trees.", 100],
    ["🌲 Find a tree with an unusual shape.", 100],
    ["🍃 Find 3 different shades of green.", 75],
    ["🌿 Find a plant growing underneath a tree.", 100],
    ["🌳 Find something interesting growing on a tree.", 125]
],

park: [
    ["🌿 Find 3 different types of plants.", 100],
    ["🌳 Find the biggest tree you can see.", 100],
    ["🍃 Find 3 different shades of green.", 75],
    ["🌱 Find something natural you haven't noticed before.", 100],
    ["🌿 Find 2 different types of vegetation.", 125]
],

garden: [
    ["🌸 Find a flower.", 75],
    ["🌿 Find 3 different plants.", 100],
    ["🍃 Find 3 different leaf shapes.", 100],
    ["🌱 Find a plant with an unusual shape.", 100]
],

meadow: [
    ["🌱 Find 3 different plants.", 100],
    ["🌸 Find a flower growing in the grass.", 100],
    ["🍃 Find 3 different shades of green.", 75],
    ["🌿 Find the most interesting plant you can see.", 100]
],

scrub: [
    ["🌿 Find 2 different types of bushes.", 100],
    ["🍃 Find 3 different leaf shapes.", 100],
    ["🌱 Find a plant with an unusual shape.", 100]
],

orchard: [
    ["🌳 Find 2 different-looking trees.", 100],
    ["🌿 Find the most interesting tree you can see.", 100],
    ["🍃 Find 3 different shades of green.", 75]
],

vineyard: [
    ["🌿 Find 3 different-looking plants.", 100],
    ["🍃 Find something growing between the rows.", 100],
    ["🌱 Find the most interesting plant you can see.", 100]
],

nature_reserve: [
    ["🌿 Find 3 different types of plants.", 125],
    ["🌳 Find an interesting tree.", 100],
    ["🍃 Find 3 different types of vegetation.", 125],
    ["🌱 Find something completely natural.", 100]
],

wetland: [
    ["🌿 Find vegetation growing near the wetland.", 100],
    ["🌱 Find 3 different plants.", 125],
    ["🍃 Find something adapted to a wet environment.", 150]
],

water: [
    ["🌿 Find a plant growing near the water.", 100],
    ["💧 Find an interesting reflection.", 75],
    ["🍃 Find vegetation growing close to the water.", 100]
],

viewpoint: [
    ["👀 Find 3 natural features around you.", 100],
    ["🌿 Find something green that stands out.", 75],
    ["🌳 Find the most interesting natural thing you can see.", 100]
],

path: [
    ["🌱 Find a plant growing beside the path.", 75],
    ["🍃 Find 3 different natural objects.", 100],
    ["🌿 Find something interesting along the path.", 100]
],

heath: [
    ["🌿 Find 3 different types of vegetation.", 125],
    ["🌱 Find an interesting plant.", 100],
    ["🍃 Find something that stands out in the landscape.", 100]
]

};

// ============================================================
// GENERIC CHALLENGES
// ============================================================

const genericChallenges = [

["🌿 Find 3 different types of plants.", 100, "vegetation"],
["🍃 Find 3 different shades of green.", 75, "vegetation"],
["🌱 Find something natural you haven't noticed before.", 100, "vegetation"],
["🌳 Find an interesting tree.", 100, "forest"],
["🌿 Find 2 different types of vegetation.", 100, "vegetation"]

];

// ============================================================
// LOCATION
// ============================================================

navigator.geolocation.getCurrentPosition(

position => {

    latitude = position.coords.latitude;
    longitude = position.coords.longitude;

    console.log(
        "📍 GreenCheck location:",
        latitude,
        longitude
    );

    initializeMap();
    updatePlayer();
    startTracking();

},

error => {

    console.error(
        "Location error:",
        error
    );

    if (error.code === 1) {

        result.textContent =
            "📍 Please allow location access.";

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
        attribution:
            "© OpenStreetMap contributors"
    }
).addTo(map);

}

// ============================================================
// PLAYER MARKER
// ============================================================

function updatePlayer() {

if (!map || latitude === null)
    return;

const position = [
    latitude,
    longitude
];

if (!playerMarker) {

    playerMarker =
        L.marker(position)
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

if (
    latitude === null ||
    longitude === null
) {

    result.textContent =
        "📍 Waiting for your location...";

    return;

}

if (activeChallenge) {

    result.textContent =
        "🎯 Finish your current challenge first!";

    return;

}

btn.disabled = true;

result.textContent =
    "🌍 Analyzing your surroundings...";

try {

    const places =
        await getEnvironment();

    const nearby =
        processPlaces(places);

    if (!nearby.length) {

        result.textContent =
            "🌍 Couldn't find environmental data nearby.";

        return;

    }

    const environment =
        analyzeEnvironment(nearby);

    console.log(
        "🌿 Environment:",
        environment
    );

    showEnvironment(nearby);

    activeChallenge =
        createChallenge(environment);

    if (!activeChallenge) {

        result.textContent =
            "Couldn't generate a challenge.";

        return;

    }

    showChallenge(environment);

} catch (error) {

    console.error(error);

    result.textContent =
        "🌐 Couldn't load nearby map data.";

} finally {

    btn.disabled = false;

}

});

// ============================================================
// OPENSTREETMAP DATA
// ============================================================

async function getEnvironment() {

const query = `

[out:json][timeout:25];

(
nwr(
around:${SEARCH_RADIUS},
${latitude},
${longitude}
)["natural"];

nwr(
    around:${SEARCH_RADIUS},
    ${latitude},
    ${longitude}
)["landuse"];

nwr(
    around:${SEARCH_RADIUS},
    ${latitude},
    ${longitude}
)["leisure"];

nwr(
    around:${SEARCH_RADIUS},
    ${latitude},
    ${longitude}
)["waterway"];

nwr(
    around:${SEARCH_RADIUS},
    ${latitude},
    ${longitude}
)["tourism"];

nwr(
    around:${SEARCH_RADIUS},
    ${latitude},
    ${longitude}
)["highway"];

);

out center tags;
`;

const response =
    await fetch(
        "https://overpass-api.de/api/interpreter",
        {
            method: "POST",
            body: query
        }
    );

if (!response.ok) {

    throw new Error(
        "Overpass request failed"
    );

}

const data =
    await response.json();

return data.elements || [];

}

// ============================================================
// PROCESS PLACES
// ============================================================

function processPlaces(places) {

return places
    .map(place => {

        const tags =
            place.tags || {};

        const placeLat =
            place.lat ??
            place.center?.lat;

        const placeLon =
            place.lon ??
            place.center?.lon;

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

        if (
            distance >
            SEARCH_RADIUS
        ) {

            return null;

        }

        const type =
            getType(tags);

        if (!type)
            return null;

        return {

            id: place.id,

            latitude: placeLat,

            longitude: placeLon,

            distance,

            type,

            tags

        };

    })
    .filter(Boolean);

}

// ============================================================
// IDENTIFY TYPE
// ============================================================

function getType(tags) {

if (
    tags.leisure ===
    "nature_reserve"
)
    return "nature_reserve";

if (
    tags.natural === "wood" ||
    tags.landuse === "forest"
)
    return "forest";

if (
    tags.leisure === "park"
)
    return "park";

if (
    tags.leisure === "garden"
)
    return "garden";

if (
    tags.landuse === "meadow" ||
    tags.landuse === "grass" ||
    tags.natural === "grassland"
)
    return "meadow";

if (
    tags.natural === "scrub"
)
    return "scrub";

if (
    tags.natural === "heath"
)
    return "heath";

if (
    tags.landuse === "orchard"
)
    return "orchard";

if (
    tags.landuse === "vineyard"
)
    return "vineyard";

if (
    tags.natural === "wetland"
)
    return "wetland";

if (
    tags.natural === "water" ||
    tags.waterway === "river" ||
    tags.waterway === "stream"
)
    return "water";

if (
    tags.tourism === "viewpoint"
)
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
// ENVIRONMENT ANALYSIS
// ============================================================

function analyzeEnvironment(places) {

const counts = {};

places.forEach(place => {

    counts[place.type] =
        (counts[place.type] || 0) + 1;

});

const vegetationTypes = [

    "forest",
    "park",
    "garden",
    "meadow",
    "scrub",
    "orchard",
    "vineyard",
    "nature_reserve",
    "wetland",
    "heath"

];

const vegetationCount =
    vegetationTypes.filter(
        type => counts[type]
    ).length;

const waterNearby =
    !!(
        counts.water ||
        counts.wetland
    );

let dominant = null;
let highest = 0;

Object.keys(counts).forEach(type => {

    if (
        counts[type] >
        highest
    ) {

        highest =
            counts[type];

        dominant =
            type;

    }

});

return {

    counts,

    dominant,

    vegetationCount,

    waterNearby,

    total:
        places.length

};

}

// ============================================================
// CHALLENGE CREATION
// ============================================================

function createChallenge(environment) {

let pool = [];

const dominant =
    environment.dominant;

if (
    dominant &&
    challengeSets[dominant]
) {

    pool.push(
        ...challengeSets[dominant]
            .map(item => [
                item[0],
                item[1],
                dominant
            ])
    );

}

if (
    environment.waterNearby
) {

    pool.push(
        ...challengeSets.water
            .map(item => [
                item[0],
                item[1],
                "water"
            ])
    );

}

if (
    environment.vegetationCount >= 3
) {

    pool.push(

        [
            "🌿 Find 3 different types of vegetation.",
            150,
            "vegetation"
        ],

        [
            "🍃 Find 4 different shades of green.",
            125,
            "vegetation"
        ],

        [
            "🌱 Find 3 different types of plants.",
            125,
            "vegetation"
        ]

    );

}

if (!pool.length)
    pool = genericChallenges;

let available =
    pool.filter(
        item =>
            !challengeHistory.includes(
                item[0]
            )
    );

if (!available.length)
    available = pool;

const selected =
    available[
        Math.floor(
            Math.random() *
            available.length
        )
    ];

challengeHistory.push(
    selected[0]
);

if (
    challengeHistory.length >
    HISTORY_LIMIT
) {

    challengeHistory.shift();

}

return {

    text: selected[0],

    xp: selected[1],

    requiredType:
        selected[2] || "vegetation"

};

}

// ============================================================
// SHOW CHALLENGE
// ============================================================

function showChallenge(environment) {

const environmentName =
    environment.dominant
        ? environment.dominant
            .replaceAll("_", " ")
        : "mixed environment";

result.innerHTML =

    `<strong>${activeChallenge.text}</strong>
    <br>
    🌍 ${environmentName}
    <br>
    ⭐ ${activeChallenge.xp} XP
    <br>
    <small>Get within 20 m of a suitable area to complete it.</small>`;

}

// ============================================================
// GPS TRACKING
// ============================================================

function startTracking() {

if (gpsWatch !== null)
    return;

gpsWatch =
    navigator.geolocation.watchPosition(

        position => {

            latitude =
                position.coords.latitude;

            longitude =
                position.coords.longitude;

            updatePlayer();

            if (activeChallenge) {

                checkChallengeCompletion();

            }

        },

        error => {

            console.log(
                "GPS tracking:",
                error
            );

        },

        {

            enableHighAccuracy: true,

            maximumAge: 3000,

            timeout: 15000

        }

    );

}

// ============================================================
// CHALLENGE COMPLETION
// ============================================================

let checkingCompletion = false;

async function checkChallengeCompletion() {

if (
    !activeChallenge ||
    checkingCompletion
)
    return;

checkingCompletion = true;

try {

    const places =
        await getEnvironment();

    const nearby =
        processPlaces(places);

    const suitable =
        nearby.some(place => {

            const distance =
                calculateDistance(
                    latitude,
                    longitude,
                    place.latitude,
                    place.longitude
                );

            if (
                distance >
                COMPLETION_RADIUS
            ) {

                return false;

            }

            return isSuitable(
                place.type,
                activeChallenge.requiredType
            );

        });

    if (suitable) {

        completeChallenge();

    }

} catch (error) {

    console.log(
        "Completion check:",
        error
    );

} finally {

    checkingCompletion = false;

}

}

// ============================================================
// SUITABLE ENVIRONMENT
// ============================================================

function isSuitable(
placeType,
requiredType
) {

if (
    requiredType ===
    "vegetation"
) {

    return [

        "forest",
        "park",
        "garden",
        "meadow",
        "scrub",
        "orchard",
        "vineyard",
        "nature_reserve",
        "wetland",
        "heath"

    ].includes(placeType);

}

if (
    requiredType ===
    "forest"
) {

    return placeType ===
        "forest";

}

if (
    requiredType ===
    "water"
) {

    return [
        "water",
        "wetland"
    ].includes(placeType);

}

return (
    placeType ===
    requiredType
);

}

// ============================================================
// COMPLETE
// ============================================================

function completeChallenge() {

if (!activeChallenge)
    return;

const reward =
    activeChallenge.xp;

activeChallenge = null;

addXP(reward);

result.innerHTML =

    `✅ <strong>Challenge completed!</strong>
    <br>
    ⭐ +${reward} XP`;

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
    (lat2 - lat1) *
    Math.PI / 180;

const dLon =
    (lon2 - lon1) *
    Math.PI / 180;

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
// MAP ENVIRONMENT
// ============================================================

function showEnvironment(places) {

if (!map)
    return;

environmentLayers.forEach(
    layer =>
        map.removeLayer(layer)
);

environmentLayers = [];

places.forEach(place => {

    if (
        ![
            "forest",
            "park",
            "garden",
            "meadow",
            "scrub",
            "orchard",
            "vineyard",
            "nature_reserve",
            "wetland",
            "heath",
            "water"
        ].includes(place.type)
    ) {

        return;

    }

    const circle =
        L.circle(
            [
                place.latitude,
                place.longitude
            ],
            {
                radius: 35
            }
        ).addTo(map);

    environmentLayers.push(
        circle
    );

});

}

// ============================================================
// XP
// ============================================================

function addXP(amount) {

xp += amount;

while (
    xp >= getXPRequired()
) {

    xp -=
        getXPRequired();

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
// XP REQUIREMENT
// ============================================================

function getXPRequired() {

return 100 +
    (level - 1) * 50;

}

// ============================================================
// XP UI
// ============================================================

function updateXPUI() {

const levelText =
    document.getElementById(
        "levelText"
    );

const xpText =
    document.getElementById(
        "xpText"
    );

const fill =
    document.getElementById(
        "xpFill"
    );

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
    percentage + "%";

}

// ============================================================
// START
// ============================================================

updateXPUI();