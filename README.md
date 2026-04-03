# NataCarto - Swimming pools in France
**Interactive mapping of the location of the swimming pools in France**  
_M1 OTG • UNISTRA Strasbourg • 2025-2026_

**Live demo**: https://bapti100.github.io/webmap_natation.m1otg.baptiste.io/

---

## Summary

**NataCarto** is an interactive web mapping application that visualises the distribution of swimming pools across France (metropolitan and overseas territories). The app is composed of two complementary pages:

- A **map page** allowing users to explore facilities by region or département, with a dynamic bar chart updating in real time to show the breakdown of pools by urban/rural density type according to INSEE classification.
- An **infographic page** providing static charts on population, surface area, and number of pools per density category, alongside an INSEE reference map.

---

## Features

### 🗺️ Interactive map (`carte.html`)
- Built with **MapLibre GL JS** on an OpenStreetMap base layer
- **Heatmap** at low zoom levels (< 7) showing pool density across the territory
- **Point layer** at high zoom levels (≥ 7) showing individual pools as clickable markers
- Clicking a pool displays a **popup** with its name and commune (e.g. *"Bassin de 25m de Paulhan"*)
- Clicking a **région** or **département** filters the chart to that territory — using the full geometry, not the visible viewport

### 📊 Dynamic bar chart (`app.js`)
- Built with **D3.js v7**
- Displays the count of pools per INSEE urban/rural density category
- Updates automatically as the map is panned or a territory is selected
- 6 density categories, from *urbain dense* to *rural autonome très peu dense*

### 🔖 Geographic bookmarks
Quick-navigation buttons displayed below the map for:
- France métropolitaine
- La Réunion
- Mayotte
- Guyane
- Martinique
- Guadeloupe

### 📈 Infographic page (`index.html` + `infographie.js`)
- Three static bar charts built with **D3.js v7**:
  - Population per urban/rural density type
  - Cadastral surface area per type
  - Number of pools per type
- Shared tooltip across all charts
- Data loaded from a local TSV file (`population_par_densite_valeur.csv`)
- Reference map image from INSEE displayed alongside the charts

### 📱 Responsive design
- Layout adapts to portrait orientation and small screens (map/image stacked above chart)
- Compatible with desktop, tablet, and mobile browsers

---

## Data sources

| Data | Provider | Link |
|---|---|---|
| Swimming pool facilities | Ministère des Sports | [equipements.sports.gouv.fr](https://equipements.sports.gouv.fr/pages/accueil/) |
| Communes & administrative boundaries | IGN — ADMIN Express | [geoservices.ign.fr](https://geoservices.ign.fr/adminexpress) |
| Urban/rural density typology | INSEE | [insee.fr](https://www.insee.fr/fr/statistiques/5039991?sommaire=5040030#onglet-2) |

---

## Tech stack

| Library | Version | Usage |
|---|---|---|
| MapLibre GL JS | 2.1.9 | Interactive map rendering |
| D3.js | v7 | Bar charts (map page & infographic page) |
| Turf.js | 6 | Point-in-polygon spatial filtering |
| Poppins (Google Fonts) | — | Typography |

---

## Project structure

```
├── carte.html            # Map page (interactive map + bar chart)
├── index.html            # Infographic page (static charts + INSEE image)
├── style.css             # Styles (layout, responsive, bookmarks, charts)
├── app.js                # Map logic, dynamic chart, bookmarks, interactions
├── infographie.js        # Static charts logic for the infographic page
├── population_par_densite_valeur.csv
├── departement_lite_4326.geojson
├── region_lite_4326.geojson
└── data-es-equipement_natation_4326_jointure_lite_net.geojson
```

---

## Author

**M1 OTG — UNISTRA Strasbourg (2025-2026)**
- Baptiste Fantou

---

## License

This project is part of an academic work at the UNISTRA Strasbourg. For any use or reproduction, please contact the author.

---

## Contact

For questions or collaboration opportunities, please contact:
- Email: baptiste.de.livry@gmail.com

---

**© 2025-2026 - NataCarto - UNISTRA Strasbourg**
