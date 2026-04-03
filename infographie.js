// ─── COULEURS PAR CODE URBAIN/RURAL ────────────────────────────────────────────
const densityColors = {
    1: "#036237",
    2: "#008143",
    3: "#19A458",
    4: "#C0E0CA",
    5: "#F6B9C2",
    6: "#E4003A"
};

// ─── TOOLTIP PARTAGÉ ──────────────────────────────────────────────────────────
const tooltip = d3.select("#tooltip");

function showTooltip(event, html) {
    tooltip
        .style("opacity", 1)
        .style("left", (event.clientX + 12) + "px")
        .style("top",  (event.clientY - 28) + "px")
        .html(html);
}

function moveTooltip(event) {
    tooltip
        .style("left", (event.clientX + 12) + "px")
        .style("top",  (event.clientY - 28) + "px");
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

// ─── FORMATTEURS ──────────────────────────────────────────────────────────────
function formatMillions(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + " M";
    if (v >= 1e3) return (v / 1e3).toFixed(0) + " k";
    return String(v);
}

function formatHa(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + " M ha";
    if (v >= 1e3) return (v / 1e3).toFixed(0) + " k ha";
    return v + " ha";
}

function formatNombre(v) {
    return v.toLocaleString("fr-FR");
}

// ─── RENDU D'UN GRAPHIQUE DANS UN CONTENEUR ───────────────────────────────────
function renderChart(container, rows, valueKey, title, formatter) {
    // Vider le contenu précédent
    d3.select(container).selectAll("*").remove();

    const margin = { top: 36, right: 14, bottom: 22, left: 56 };
    const W = container.clientWidth  - margin.left - margin.right;
    const H = container.clientHeight - margin.top  - margin.bottom;

    if (W <= 0 || H <= 0) return; // Pas de dimensions : on ne dessine pas

    const svg = d3.select(container)
        .append("svg")
        .attr("width",  W + margin.left + margin.right)
        .attr("height", H + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(rows.map(d => d.label))
        .range([0, W])
        .padding(0.25);

    const y = d3.scaleLinear()
        .domain([0, d3.max(rows, d => d[valueKey]) * 1.08])
        .range([H, 0]);

    // Axe Y avec lignes de grille légères
    svg.append("g")
        .attr("class", "y-axis")
        .call(
            d3.axisLeft(y)
                .ticks(4)
                .tickFormat(d => formatter ? formatter(d) : d)
        )
        .call(g => g.select(".domain").attr("stroke", "#ccc"))
        .call(g => g.selectAll(".tick line").attr("stroke", "#eee").attr("x2", W))
        .call(g => g.selectAll("text")
            .style("font-size", "9px")
            .style("font-family", "'Poppins', sans-serif")
        );

    // Axe X masqué (labels trop longs, info via tooltip)
    svg.append("g")
        .attr("transform", `translate(0,${H})`)
        .call(d3.axisBottom(x).tickSize(0))
        .call(g => g.select(".domain").attr("stroke", "#ccc"))
        .call(g => g.selectAll("text").style("display", "none"));

    // Barres
    svg.selectAll(".bar")
        .data(rows)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x",      d => x(d.label))
        .attr("y",      H)
        .attr("width",  x.bandwidth())
        .attr("height", 0)
        .attr("fill",   d => d.color)
        .attr("rx", 2)
        .on("mouseover", function (event, d) {
            const val = formatter
                ? formatter(d[valueKey])
                : d[valueKey].toLocaleString("fr-FR");
            showTooltip(event, `<strong>${d.label}</strong><br>${val}`);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout",  hideTooltip)
        .transition().duration(600).delay((_, i) => i * 60)
        .attr("y",      d => y(d[valueKey]))
        .attr("height", d => H - y(d[valueKey]));

    // Titre
    svg.append("text")
        .attr("x", W / 2).attr("y", -18)
        .attr("text-anchor", "middle")
        .text(title)
        .style("font-size", "11px").style("font-weight", "600")
        .style("fill", "#333").style("font-family", "'Poppins', sans-serif");
}

// ─── OBSERVE UN CONTENEUR ET DESSINE QUAND IL A DES DIMENSIONS ───────────────
function observeAndDraw(containerId, rows, valueKey, title, formatter) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let drawn = false;

    const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                renderChart(container, rows, valueKey, title, formatter);
                drawn = true;
                // On continue d'observer pour redessiner si la taille change (rotation, resize)
            }
        }
    });

    observer.observe(container);
}

// ─── CHARGEMENT DU CSV ET INITIALISATION ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {

    d3.dsv("\t", "population_par_densite_valeur.csv").then(function (data) {

        const rows = data
            .filter(d => d.code_urb_rur && d.code_urb_rur.trim() !== "")
            .map(d => ({
                label:      d.typo_urb_rur,
                code:       +d.code_urb_rur,
                population: +d.population,
                superficie: +d.superficie_cadastrale,
                bassins:    +d.nbr_bassin,
                color:      densityColors[+d.code_urb_rur] ?? "#CCCCCC"
            }))
            .sort((a, b) => a.code - b.code);

        observeAndDraw("chart-population", rows, "population",  "Population par type urbain/rural",       formatMillions);
        observeAndDraw("chart-superficie", rows, "superficie",  "Superficie cadastrale (ha) par type",    formatHa);
        observeAndDraw("chart-bassins",    rows, "bassins",     "Nombre de bassins par type",              formatNombre);

    }).catch(function (error) {
        console.error("Erreur lors du chargement du CSV :", error);
        const panel = document.getElementById("graphs-panel");
        if (panel) {
            panel.innerHTML = `<p class="error-message">Impossible de charger le fichier population_par_densite_valeur.csv</p>`;
        }
    });

});
