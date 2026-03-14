const densityLabels = {
    6: "urbain dense",
    5: "urbain densité intermédiaire",
    4: "rural sous forte influence d'un pôle",
    3: "rural sous faible influence d'un pôle",
    2: "rural autonome très peu dense",
    1: "rural autonome peu dense"
};

const densityColors = {
    1: "#036237",
    2: "#008143",
    3: "#19A458",
    4: "#C0E0CA",
    5: "#F6B9C2",
    6: "#E4003A"
};

let map, geojsonData;
let selection = { type: null, id: null };

// ─── GÉOSIGNETS ────────────────────────────────────────────────────────────────

const FIXED_BOOKMARKS = [
    { label: "France métropolitaine", center: [2.552,    46.559],  zoom: 5  },
    { label: "La Réunion",            center: [55.5325, -21.133],  zoom: 8 },
    { label: "Mayotte",               center: [45.1466, -12.821],  zoom: 9 },
    { label: "Guyane",                center: [-53.24,    3.915],  zoom: 5.5  },
    { label: "Martinique",            center: [-61.020,  14.655],  zoom: 8 },
    { label: "Guadeloupe",            center: [-61.54,   16.198],  zoom: 8 },
];

let activeBookmarkIndex = 0; // France métropolitaine active par défaut

function renderBookmarkBar() {
    const bar = document.getElementById("bookmark-bar");
    if (!bar) return;

    bar.innerHTML = "";
    FIXED_BOOKMARKS.forEach(({ label, center, zoom }, i) => {
        const btn = document.createElement("button");
        btn.className = "bookmark-btn" + (i === activeBookmarkIndex ? " active" : "");
        btn.textContent = label;
        btn.addEventListener("click", () => {
            activeBookmarkIndex = i;
            // Mettre à jour l'état actif visuellement
            bar.querySelectorAll(".bookmark-btn").forEach((b, j) => {
                b.classList.toggle("active", j === i);
            });
            map.flyTo({ center, zoom, duration: 1200 });
        });
        bar.appendChild(btn);
    });
}

// ─── INITIALISATION ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async function () {
    const mapDiv = document.getElementById("map");
    if (!mapDiv) return;

    renderBookmarkBar();

    map = new maplibregl.Map({
        container: "map",
        style: {
            version: 8,
            sources: {
                osm: {
                    type: "raster",
                    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                }
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }]
        },
        center: [2.552, 46.559],
        zoom: 5
    });

    map.on("load", async () => {
        try {
            const [departements, regions, piscines] = await Promise.all([
                fetch("departement_lite_4326.geojson").then(r => r.json()),
                fetch("region_lite_4326.geojson").then(r => r.json()),
                fetch("data-es-equipement_natation_4326_jointure_lite_net.geojson").then(r => r.json())
            ]);

            const ensureId = features =>
                features.map(f => ({
                    ...f,
                    id: f.id ?? f.properties?.code_insee ?? Math.random().toString(36).substr(2, 9)
                }));

            departements.features = ensureId(departements.features);
            regions.features      = ensureId(regions.features);
            geojsonData = {
                ...piscines,
                features: ensureId(piscines.features).filter(
                    f => f.properties?.code_urb_rur != null
                )
            };

            map.addSource("departements", { type: "geojson", data: departements });
            map.addSource("regions",      { type: "geojson", data: regions });
            map.addSource("piscines",     { type: "geojson", data: geojsonData });

            map.addLayer({
                id: "regions-layer", type: "fill", source: "regions",
                paint: {
                    "fill-color":         ["case", ["boolean", ["feature-state", "selected"], false], "#FFD700", "#87CEEB"],
                    "fill-opacity":       ["case", ["boolean", ["feature-state", "selected"], false], 0.8, 0.5],
                    "fill-outline-color": "#333333"
                }
            });

            map.addLayer({
                id: "departements-layer", type: "fill", source: "departements",
                paint: {
                    "fill-color":         ["case", ["boolean", ["feature-state", "selected"], false], "#FFD700", "#627BC1"],
                    "fill-opacity":       ["case", ["boolean", ["feature-state", "selected"], false], 0.8, 0.5],
                    "fill-outline-color": "#333333"
                }
            });

            map.addLayer({
                id: "departements-outline", type: "line", source: "departements",
                paint: {
                    "line-color":   ["case", ["boolean", ["feature-state", "selected"], false], "#FF8C00", "#000000"],
                    "line-width":   ["case", ["boolean", ["feature-state", "selected"], false], 2, 1],
                    "line-opacity": 0.8
                }
            });

            map.addLayer({
                id: "piscines-heat", type: "heatmap", source: "piscines", maxzoom: 7,
                paint: {
                    "heatmap-weight":    ["interpolate", ["linear"], ["get", "code_urb_rur"], 1, 0.1, 6, 1],
                    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 7, 3],
                    "heatmap-radius":    ["interpolate", ["linear"], ["zoom"], 0, 2, 7, 20],
                    "heatmap-color": [
                        "interpolate", ["linear"], ["heatmap-density"],
                        0, "rgba(0,0,255,0)", 0.2, "royalblue", 0.4, "cyan",
                        0.6, "lime", 0.8, "yellow", 1, "red"
                    ],
                    "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 7, 0]
                }
            });

            map.addLayer({
                id: "piscines-layer", type: "circle", source: "piscines", minzoom: 7,
                paint: {
                    "circle-radius":       5,
                    "circle-color":        "#3bb2d0",
                    "circle-opacity":      0.8,
                    "circle-stroke-width": 1,
                    "circle-stroke-color": "#fff"
                }
            });

            updateGraph(getVisibleFeatures());
            map.resize();

            // Le clic piscine pose un flag pour bloquer région/département
            let piscineClicked = false;

            map.on("click", "piscines-layer", e => {
                const f = e.features[0];
                if (!f) return;
                piscineClicked = true;
                const { nom, commune } = f.properties;
                const label = (nom && commune) ? `${nom} de ${commune}`
                            : nom              ? nom
                            : commune          ? commune
                            : "Piscine inconnue";
                new maplibregl.Popup({ closeButton: true, maxWidth: "220px" })
                    .setLngLat(e.lngLat)
                    .setHTML(`<span style="font-family:'Poppins',sans-serif;font-size:0.8rem;font-weight:600">${label}</span>`)
                    .addTo(map);
            });

            map.on("click", "regions-layer", e => {
                if (piscineClicked) { piscineClicked = false; return; }
                e.features[0] && handleSelectionClick(e.features[0], "regions");
            });
            map.on("click", "departements-layer", e => {
                if (piscineClicked) { piscineClicked = false; return; }
                e.features[0] && handleSelectionClick(e.features[0], "departements");
            });

            // Curseur pointer au survol des piscines
            map.on("mouseenter", "piscines-layer", () => map.getCanvas().style.cursor = "pointer");
            map.on("mouseleave", "piscines-layer", () => map.getCanvas().style.cursor = "");

        } catch (error) {
            console.error("Erreur de chargement des données :", error);
        }
    });

    map.on("zoomend", updateLayersVisibility);
    map.on("moveend", () => {
        if (!selection.id) updateGraph(getVisibleFeatures());
    });
});

// ─── CARTE ─────────────────────────────────────────────────────────────────────

function getVisibleFeatures() {
    if (!geojsonData) return [];
    const bounds = map.getBounds();
    return geojsonData.features.filter(f =>
        f.geometry?.coordinates &&
        bounds.contains([f.geometry.coordinates[0], f.geometry.coordinates[1]])
    );
}

function updateLayersVisibility() {
    const isZoomedIn = map.getZoom() >= 7;
    map.setLayoutProperty("regions-layer",       "visibility", isZoomedIn ? "none"    : "visible");
    map.setLayoutProperty("departements-layer",   "visibility", isZoomedIn ? "visible" : "none");
    map.setLayoutProperty("departements-outline", "visibility", isZoomedIn ? "visible" : "none");
    map.setLayoutProperty("piscines-layer",       "visibility", isZoomedIn ? "visible" : "none");
    map.setLayoutProperty("piscines-heat",        "visibility", isZoomedIn ? "none"    : "visible");
}

function handleSelectionClick(feature, source) {
    if (!feature?.id) return;

    const isSameSelection = selection.type === source && selection.id === feature.id;

    if (selection.id) {
        map.setFeatureState({ source: selection.type, id: selection.id }, { selected: false });
    }

    if (isSameSelection) {
        selection = { type: null, id: null };
        updateGraph(getVisibleFeatures());
    } else {
        selection = { type: source, id: feature.id };
        map.setFeatureState({ source, id: feature.id }, { selected: true });

        if (!feature.geometry) {
            console.warn("Géométrie manquante pour la feature", feature.id);
            return;
        }

        const filteredFeatures = geojsonData.features.filter(f =>
            f.geometry?.coordinates &&
            turf.booleanPointInPolygon(
                [f.geometry.coordinates[0], f.geometry.coordinates[1]],
                feature.geometry
            )
        );
        updateGraph(filteredFeatures);
    }
}

// ─── GRAPHIQUE ─────────────────────────────────────────────────────────────────

function updateGraph(features) {
    const graphEl = document.getElementById("graph");
    d3.select(graphEl).selectAll("*").remove();

    const densityCodes = features
        .map(f => f.properties?.code_urb_rur)
        .filter(code => code != null);

    if (densityCodes.length === 0) {
        d3.select(graphEl).append("p")
            .text("Aucune donnée visible.")
            .style("text-align", "center")
            .style("padding", "20px")
            .style("margin-top", "50px");
        return;
    }

    const margin = { top: 50, right: 20, bottom: 30, left: 40 };
    const width  = graphEl.clientWidth  - margin.left - margin.right;
    const height = graphEl.clientHeight - margin.top  - margin.bottom;

    if (width <= 0 || height <= 0) {
        requestAnimationFrame(() => updateGraph(features));
        return;
    }

    const densityCounts = d3.rollup(densityCodes, v => v.length, d => d);

    const fullData = Object.entries(densityLabels).map(([code, label]) => ({
        key:   label,
        value: densityCounts.get(parseInt(code)) ?? 0,
        code:  parseInt(code),
        color: densityColors[code] ?? "#CCCCCC"
    }));

    const svg = d3.select(graphEl)
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(fullData.map(d => d.key)).range([0, width]).padding(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(fullData, d => d.value)]).range([height, 0]);

    const tooltip = d3.select(graphEl).append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute");

    svg.selectAll(".bar")
        .data(fullData, d => d.key)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("y", height)
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .attr("fill", d => d.color)
        .on("mouseover", function (event, d) {
            const rect      = this.getBoundingClientRect();
            const graphRect = graphEl.getBoundingClientRect();
            tooltip
                .style("opacity", 1)
                .style("left",  `${rect.left + rect.width / 2 - graphRect.left}px`)
                .style("top",   `${rect.top  - graphRect.top  - 30}px`)
                .html(`${d.key}: ${d.value}`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .transition().duration(800)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value));

    svg.append("g").attr("class", "y-axis").call(d3.axisLeft(y).ticks(5));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .text("Répartition par type de densité (INSEE)")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("fill", "#333");
}
