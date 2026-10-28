/* Landscape signatures in 3D: Angkor, Srei Santhor, Sukhothai, Prambanan.
   Static site: MapLibre GL + precomputed rasters from the verified GIS packages. */
"use strict";

const E = 20037508.342789244;
const $ = (id) => document.getElementById(id);

const SITES = {
  angkor: { name: "Angkor", country: "Cambodia" },
  srei_santhor: { name: "Srei Santhor", country: "Cambodia" },
  sukhothai: { name: "Sukhothai", country: "Thailand" },
  prambanan: { name: "Prambanan", country: "Indonesia" },
};
const READY = new Set(["angkor"]);
const SITE_EX = { angkor: 5, srei_santhor: 10, sukhothai: 3, prambanan: 1.5 }; // updated after data load (see init)

const WC_NAMES = { 10: "Tree cover", 20: "Shrubland", 30: "Grassland", 40: "Cropland", 50: "Built-up", 60: "Bare / sparse", 70: "Snow / ice", 80: "Open water", 90: "Herbaceous wetland", 95: "Mangroves", 100: "Moss / lichen" };
const WATER_NAMES = { 0: "No usable image in a window", 1: "Not open water", 2: "Water in both seasons", 3: "Water in wet season only", 4: "Water in dry season only" };

const LAYERS = [
  { id: "water", name: "Open water 2025", note: "Dry, wet or both seasons", sw: "linear-gradient(90deg,#0869a4 50%,#41b8d5 50%)", on: true },
  { id: "ndvi", name: "Vegetation change", note: "Wet minus dry greenness", sw: "linear-gradient(90deg,#9a6a2f,#f5f5f5,#2d8b37)" },
  { id: "landcover", name: "Land cover 2021", note: "ESA WorldCover; pink = cropland", sw: "linear-gradient(90deg,#006400 33%,#f096ff 33% 66%,#fa0000 66%)" },
  { id: "hand", name: "Height above drainage", note: "Low ground near flow paths", sw: "linear-gradient(90deg,#08306b,#6baed6,#f7f4e9,#8c5a2b)" },
  { id: "drainage", name: "Modelled flow paths", note: "Draining ≥ 5 km², from terrain", sw: "linear-gradient(#1e6ec8,#1e6ec8) center/100% 3px no-repeat" },
  { id: "contours", name: "Contours", note: "Levels from smoothed terrain", sw: "repeating-linear-gradient(0deg,#8c643c 0 1px,transparent 1px 4px)" },
  { id: "temples", name: "Temples, wat / candi", note: "OpenStreetMap, undated", sw: "radial-gradient(circle,#b2182b 35%,transparent 40%)" },
  { id: "box", name: "Comparison window", note: "Original ~2,000 km² box", sw: "linear-gradient(90deg,#18252a 40%,transparent 40% 60%,#18252a 60%) center/100% 2px no-repeat" },
];

const TOURS = {
  angkor: [
    { title: "A landscape, not a monument",
      text: "This window covers about 2,000 km² around Angkor. Height is exaggerated five times: the ground falls roughly 50 m from the Kulen foothills in the north-east to the Tonle Sap in the south. Blue lines are flow paths modelled from the terrain.",
      cam: { center: [103.88, 13.40], zoom: 10.25, pitch: 58, bearing: -18 }, season: "dry", layers: ["drainage", "box"], level: 0 },
    { title: "Water starts in the north-east",
      text: "Groslier read Angkor through levels and connections across the plain towards the lake. Darker blue marks ground lying less than about 2 m above a modelled drainage line. This highlights low-lying terrain; it does not predict the timing or extent of flooding.",
      cam: { center: [103.99, 13.52], zoom: 11.2, pitch: 64, bearing: 215 }, season: "dry", layers: ["hand", "drainage"], level: 0 },
    { title: "Two barays, two present roles",
      text: "Compare the seasonal water signatures of the West Baray (left) and East Baray (right). Water is detected in the West Baray in both 2025 windows; the East Baray has a different present land-cover pattern. These observations prompt questions about landscape inheritance, but do not establish current productive use. Narrow or vegetated moats may be missed at this analysis resolution.",
      cam: { center: [103.85, 13.445], zoom: 11.55, pitch: 52, bearing: 0 }, season: "dry", layers: ["water", "box"], level: 0 },
    { title: "Fields between the temples",
      text: "Hawken and Cobo Castillo describe small field patches around Pre Rup and a more ordered field system at Phnom Bok. Green marks land that was greener in the 2025 wet season than in the dry season, brown the reverse. Greening alone does not show rice or irrigation.",
      cam: { center: [103.95, 13.455], zoom: 12.3, pitch: 56, bearing: 28 }, season: "dry", layers: ["ndvi", "temples"], level: 0 },
    { title: "The wet season spreads towards the lake",
      text: "Within the pixels observed in both 2025 windows, mapped open water covered 337.6 km² in the wet window and 76.2 km² in the dry window. Common observation coverage is 84.1% of the box. Use the low-ground threshold to explore height above modelled drainage, or click a point to compare the seasonal observations.",
      cam: { center: [103.84, 13.31], zoom: 10.9, pitch: 50, bearing: 8 }, season: "wet", layers: ["water"], level: 0 },
  ],
};

TOURS.sukhothai = [
  { title: "Hills, terrace and river plain",
    text: "Sukhothai is not a flat plain. Hills rise in the south-west, a gently sloping terrace runs east from them, and the Yom River lowland lies in the east. Van Liere (1989) argues that water was managed differently in each of these settings. Height is exaggerated three times.",
    cam: { center: [99.70, 17.00], zoom: 10.3, pitch: 58, bearing: 20 }, season: "dry", layers: ["drainage", "box"], level: 0 },
  { title: "Monasteries on the hill edge",
    text: "West of the old city, monasteries such as Wat Kamphaeng Hin and Wat Chang Rob stand where the hills meet the terrace. Streams leave the high ground here and flow east, past the old city, towards the river. Red points are mapped archaeological sites.",
    cam: { center: [99.69, 17.02], zoom: 12.6, pitch: 62, bearing: 75 }, season: "dry", layers: ["temples", "drainage", "contours"], level: 0 },
  { title: "The wet season belongs to the eastern plain",
    text: "Open water grew from 24.4 km² in the 2025 dry window to 257.3 km² in the wet window, almost all of it on the Yom lowland in the east. The terrace and old city stay largely dry.",
    cam: { center: [99.79, 17.01], zoom: 10.8, pitch: 52, bearing: -10 }, season: "wet", layers: ["water"], level: 0 },
  { title: "Low ground and high ground",
    text: "Dark blue marks ground less than about 2 m above the nearest modelled stream, not the main river. Even the terrace is crossed by low strips along small streams running west to east, the kind of seasonal streams Van Liere links to local water management. Click anywhere to compare the two seasons at that spot.",
    cam: { center: [99.75, 17.02], zoom: 10.6, pitch: 55, bearing: 0 }, season: "dry", layers: ["hand", "temples"], level: 0 },
];
TOURS.prambanan = [
  { title: "On the slope of Merapi",
    text: "The Prambanan window lies on the lower slope of the Merapi volcano. Streams run outwards from the volcano to the north, and the Opak valley runs south past the temples towards the southern hills. Height is exaggerated only 1.5 times: most of this relief is real.",
    cam: { center: [110.49, -7.70], zoom: 10.4, pitch: 60, bearing: 180 }, season: "dry", layers: ["drainage", "box"], level: 0 },
  { title: "A dense temple landscape",
    text: "Around Prambanan the candi cluster closely: Plaosan to the north-east, Gana nearby, and Banyunibo and other sites on the higher ground to the south. OpenStreetMap records 571 temple and heritage points in this window, many of them single shrines inside the large compounds.",
    cam: { center: [110.49, -7.76], zoom: 13.1, pitch: 58, bearing: 10 }, season: "dry", layers: ["temples"], level: 0 },
  { title: "Water you cannot see from space",
    text: "Only about 2 km² of open water was classified in either seasonal window. Small or vegetated channels may be missed at the 20 m analysis resolution, so low mapped water area does not establish limited water access. The selected Java windows are wet January to March and dry July to September 2025.",
    cam: { center: [110.47, -7.74], zoom: 11.6, pitch: 55, bearing: 200 }, season: "dry", layers: ["water", "drainage"], level: 0 },
];
TOURS.srei_santhor = [
  { title: "A floodplain landscape",
    text: "This Mekong floodplain has very low relief, and much of the analysed terrain lies close in height to modelled drainage. Surface-model errors, vegetation and buildings can be substantial relative to that relief. Height is exaggerated ten times to make small differences visible.",
    cam: { center: [105.02, 11.76], zoom: 10.3, pitch: 58, bearing: -10 }, season: "dry", layers: ["hand", "box"], level: 0 },
  { title: "The wet season",
    text: "Open water grew from 179.8 km² in the 2025 dry window to 515.8 km² in the wet window, the largest seasonal change of the four sites. Most of the new water lies on the floodplain away from the main channel.",
    cam: { center: [105.02, 11.78], zoom: 10.6, pitch: 50, bearing: 0 }, season: "wet", layers: ["water"], level: 0 },
  { title: "Wats, and a gap in the map",
    text: "OpenStreetMap records 187 temple points here, almost all active wats, and no archaeological sites at all. That is a gap in the mapping, not evidence that no older sites exist. In ground this flat, trees and villages are as tall as the landforms, so the terrain layers are least reliable here.",
    cam: { center: [105.03, 11.79], zoom: 11.4, pitch: 52, bearing: 15 }, season: "dry", layers: ["temples", "water"], level: 0 },
];

const state = { site: "angkor", meta: null, season: "dry", ex: 5, level: 0, on: new Set(), tour: -1, raster: null };
let map;

/* ---------- raster helpers ---------- */
async function loadPixels(url) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  return { w: c.width, h: c.height, canvas: c, data: ctx.getImageData(0, 0, c.width, c.height).data };
}
function encodeTerrarium(m) { const v = m + 32768; return [Math.floor(v / 256), Math.floor(v % 256), 0]; }

/* Terrain tiles are cut in the browser from one Terrarium image per site. */
const terrainCache = {};
maplibregl.addProtocol("dem", async (params) => {
  const [, site, z, x, y] = params.url.match(/dem:\/\/(\w+)\/(\d+)\/(\d+)\/(\d+)/);
  const t = terrainCache[site];
  const size = 256, span = (2 * E) / 2 ** +z;
  const x0 = -E + +x * span, y1 = E - +y * span;
  const [mx0, my0, mx1, my1] = t.meta.mercator;
  const rx = (mx1 - mx0) / t.px.w, ry = (my1 - my0) / t.px.h;
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const [r, g, b] = encodeTerrarium(Math.round(t.meta.elev_p02));
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(t.px.canvas, (x0 - mx0) / rx, (my1 - y1) / ry, span / rx, span / ry, 0, 0, size, size);
  const blob = await c.convertToBlob({ type: "image/png" });
  return { data: await blob.arrayBuffer() };
});

/* ---------- map ---------- */
const OFFLINE = new URLSearchParams(location.search).has("offline"); // testing without internet basemap
function baseStyle() {
  if (OFFLINE) return { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#e4e1d8" } }] };
  return {
    version: 8,
    sources: {
      basemap: { type: "raster", tileSize: 256, maxzoom: 19,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#e4e1d8" } },
      { id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": 0.65 } },
    ],
  };
}

function addSiteLayers(site, meta) {
  const base = `data/${site}/`;
  const coords = meta.corners;
  map.addSource("dem", { type: "raster-dem", tiles: [`dem://${site}/{z}/{x}/{y}`], tileSize: 256, encoding: "terrarium", maxzoom: 13,
    attribution: "Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus 2014-2018, provided under COPERNICUS by the EU and ESA" });
  map.addSource("dem-hs", { type: "raster-dem", tiles: [`dem://${site}/{z}/{x}/{y}`], tileSize: 256, encoding: "terrarium", maxzoom: 13 });
  for (const s of ["dry", "wet"]) map.addSource(`img-${s}`, { type: "image", url: base + `${s}.webp`, coordinates: coords });
  for (const id of ["water", "ndvi", "landcover", "hand"]) map.addSource(`ov-${id}`, { type: "image", url: base + `${id}.webp`, coordinates: coords });
  map.addSource("level", { type: "canvas", canvas: state.levelCanvas, coordinates: coords, animate: false });
  map.addSource("drainage", { type: "geojson", data: base + "drainage.geojson" });
  map.addSource("contours", { type: "geojson", data: base + "contours.geojson" });
  map.addSource("box", { type: "geojson", data: base + "box.geojson" });
  if (meta.has_temples) map.addSource("temples", { type: "geojson", data: base + "temples.geojson" });

  map.addLayer({ id: "img-dry", type: "raster", source: "img-dry", paint: { "raster-fade-duration": 0 } });
  map.addLayer({ id: "img-wet", type: "raster", source: "img-wet", layout: { visibility: "none" }, paint: { "raster-fade-duration": 0 } });
  map.addLayer({ id: "hillshade", type: "hillshade", source: "dem-hs", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#2b2b2b", "hillshade-highlight-color": "#ffffff" } });
  for (const id of ["landcover", "ndvi", "hand", "water"]) map.addLayer({ id, type: "raster", source: `ov-${id}`, layout: { visibility: "none" }, paint: { "raster-opacity": 0.9, "raster-fade-duration": 0 } });
  map.addLayer({ id: "level", type: "raster", source: "level", paint: { "raster-opacity": 0.8, "raster-fade-duration": 0 } });
  map.addLayer({ id: "contours", type: "line", source: "contours", layout: { visibility: "none" },
    paint: { "line-color": "#8c643c", "line-opacity": 0.75, "line-width": ["case", ["get", "index_contour"], 1.2, 0.5] } });
  map.addLayer({ id: "drainage", type: "line", source: "drainage", layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1e6ec8", "line-width": ["interpolate", ["linear"], ["get", "upstream_km2_in_box"], 5, 1, 50, 2.5, 250, 5] } });
  map.addLayer({ id: "box", type: "line", source: "box", layout: { visibility: "none" }, paint: { "line-color": "#18252a", "line-width": 1.6, "line-dasharray": [3, 2] } });
  if (meta.has_temples) map.addLayer({ id: "temples", type: "circle", source: "temples", layout: { visibility: "none" },
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 14, 6], "circle-stroke-color": "#fff", "circle-stroke-width": 1,
      "circle-color": ["match", ["get", "category"], "archaeological_site", "#b2182b", "historic_temple_or_ruin", "#ef8a62", "active_place_of_worship", "#7b3294", "temple_building", "#e7b416", "#777"] } });
  map.setTerrain({ source: "dem", exaggeration: state.ex });
}

/* ---------- water-level canvas ---------- */
function drawLevel() {
  const v = state.raster.values, c = state.levelCanvas, ctx = c.getContext("2d");
  const img = ctx.createImageData(v.w, v.h), d = img.data, src = v.data;
  let n = 0, total = 0;
  if (state.level > 0) {
    const q = Math.round((state.level + 10) * 2) + 1; // values.png R channel encoding
    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      if (r === 0) continue;
      total++;
      if (r <= q) { d[i] = 30; d[i + 1] = 110; d[i + 2] = 200; d[i + 3] = 175; n++; }
    }
  }
  ctx.putImageData(img, 0, 0);
  const s = map.getSource("level");
  if (s) { s.play(); requestAnimationFrame(() => requestAnimationFrame(() => s.pause())); }
  $("level-label").textContent = state.level > 0 ? `${state.level} m` : "off";
  $("level-note").textContent = state.level > 0
    ? `${(100 * n / Math.max(total, 1)).toFixed(0)}% of valid display pixels are at or below ${state.level} m above modelled drainage. This terrain threshold is not a flood simulation.`
    : "Shade terrain up to this height above modelled drainage. This is not a water-level simulation.";
}

/* ---------- UI ---------- */
function renderSites() {
  $("sites").innerHTML = Object.entries(SITES).map(([id, s]) =>
    `<button data-site="${id}" class="${id === state.site ? "on" : ""}" ${READY.has(id) ? "" : "disabled"}>${s.name}<small>${READY.has(id) ? s.country : "coming next"}</small></button>`).join("");
  $("sites").querySelectorAll("button").forEach((b) => b.onclick = () => loadSite(b.dataset.site));
}
function renderLayers() {
  $("layers").innerHTML = LAYERS.filter((l) => l.id !== "temples" || state.meta?.has_temples).map((l) =>
    `<button class="layer ${state.on.has(l.id) ? "on" : ""}" data-id="${l.id}"><span class="sw" style="background:${l.sw}"></span><span class="txt">${l.name}<small>${l.note}</small></span><span class="tog"></span></button>`).join("");
  $("layers").querySelectorAll(".layer").forEach((b) => b.onclick = () => { toggle(b.dataset.id); });
}
function toggle(id, force) {
  const on = force ?? !state.on.has(id);
  on ? state.on.add(id) : state.on.delete(id);
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  renderLayers(); renderLegend();
}
function setSeason(s) {
  state.season = s;
  map.setLayoutProperty("img-dry", "visibility", s === "dry" ? "visible" : "none");
  map.setLayoutProperty("img-wet", "visibility", s === "wet" ? "visible" : "none");
  document.querySelectorAll("#season button").forEach((b) => b.classList.toggle("on", b.dataset.season === s));
  const m = state.meta, w = m[s];
  $("season-dates").textContent = `${s === "dry" ? "Dry" : "Wet"} window: ${fmtDate(w[0])} – ${fmtDate(w[1])}. Seasonal median of usable Sentinel-2 images.`;
}
const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function setLevel(v) { state.level = +v; $("level").value = v; drawLevel(); }
function setEx(v) {
  state.ex = +v; map.setTerrain({ source: "dem", exaggeration: state.ex });
  document.querySelectorAll("#topbar [data-ex]").forEach((b) => b.classList.toggle("on", +b.dataset.ex === state.ex));
}

function renderLegend() {
  const parts = [];
  if (state.on.has("water")) parts.push(`<div class="lg"><b>Open water, 2025</b>
    <div class="row"><i style="background:#0869a4"></i>Both seasons · ${state.meta.water_km2["2"]} km²</div>
    <div class="row"><i style="background:#41b8d5"></i>Wet season only · ${state.meta.water_km2["3"]} km²</div>
    <div class="row"><i style="background:#d09b43"></i>Dry season only · ${state.meta.water_km2["4"]} km²</div>
    <div class="row"><i style="background:#969696"></i>No usable image (cloud)</div></div>`);
  if (state.on.has("ndvi")) parts.push(`<div class="lg"><b>Wet minus dry greenness (NDVI)</b><div class="ramp" style="background:linear-gradient(90deg,#9a6a2f,#f5f5f5,#2d8b37)"></div><div class="ends"><span>greener in dry</span><span>greener in wet</span></div></div>`);
  if (state.on.has("hand")) parts.push(`<div class="lg"><b>Height above modelled drainage</b><div class="ramp" style="background:linear-gradient(90deg,#08306b,#2171b5 8%,#6baed6 18%,#c6dbef 30%,#f7f4e9 50%,#d9b67a 75%,#8c5a2b)"></div><div class="ends"><span>0 m</span><span>10</span><span>50</span><span>150 m</span></div></div>`);
  if (state.on.has("landcover")) parts.push(`<div class="lg"><b>Land cover 2021</b>${[[10,"#006400"],[40,"#f096ff"],[50,"#fa0000"],[80,"#0064c8"],[30,"#ffff4c"],[90,"#0096a0"]].map(([k,c]) => `<div class="row"><i style="background:${c}"></i>${WC_NAMES[k]}</div>`).join("")}</div>`);
  if (state.on.has("temples")) parts.push(`<div class="lg"><b>Temples (OpenStreetMap)</b><div class="row"><i style="background:#b2182b;border-radius:50%"></i>Archaeological site</div><div class="row"><i style="background:#ef8a62;border-radius:50%"></i>Historic temple / ruin</div><div class="row"><i style="background:#7b3294;border-radius:50%"></i>Active temple or wat</div><div class="row"><i style="background:#e7b416;border-radius:50%"></i>Temple building, no other details</div><div class="note">${state.meta.temples} points. Mapping is uneven: a gap is not an absence.</div></div>`);
  $("legend").innerHTML = parts.join("");
}

/* ---------- click inspection ---------- */
let pin;
function pixelAt(lngLat) {
  const p = maplibregl.MercatorCoordinate.fromLngLat(lngLat);
  const mx = p.x * 2 * E - E, my = E - p.y * 2 * E;
  const [mx0, my0, mx1, my1] = state.meta.mercator, w = state.meta.width, h = state.meta.height;
  const px = Math.floor((mx - mx0) / (mx1 - mx0) * w), py = Math.floor((my1 - my) / (my1 - my0) * h);
  return px < 0 || py < 0 || px >= w || py >= h ? -1 : (py * w + px) * 4;
}
function inspect(e) {
  const i = pixelAt(e.lngLat);
  if (pin) pin.remove();
  if (i < 0) { $("inspect").hidden = true; return; }
  const el = document.createElement("div"); el.className = "pin";
  pin = new maplibregl.Marker({ element: el }).setLngLat(e.lngLat).addTo(map);
  const v = state.raster.values.data, c = state.raster.counts.data, t = terrainCache[state.site].px.data;
  const hand = v[i] ? (v[i] - 1) / 2 - 10 : null;
  const wc = state.meta.worldcover[(v[i + 1] >> 3) - 1];
  const wcls = v[i + 1] & 7;
  const ndvi = v[i + 2] ? (v[i + 2] - 1) / 127 - 1 : null;
  const elev = t[i] * 256 + t[i + 1] + t[i + 2] / 256 - 32768;
  const dry = c[i], wet = c[i + 1], jrc = c[i + 2] === 255 ? null : c[i + 2];
  const dryWater = wcls === 2 || wcls === 4, wetWater = wcls === 2 || wcls === 3;
  const maxCount = 12;
  const bar = (label, val, max, color, txt) => `<div class="bar"><span>${label}</span><span class="track"><span class="fill" style="width:${Math.min(100, 100 * val / max)}%;background:${color}"></span></span><b>${txt}</b></div>`;
  const lat = e.lngLat.lat, ns = lat >= 0 ? "N" : "S";
  $("inspect-title").textContent = `${Math.abs(lat).toFixed(4)}° ${ns}, ${e.lngLat.lng.toFixed(4)}° E`;
  let templeRow = "";
  if (map.getLayer("temples") && state.on.has("temples")) {
    const f = map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ["temples"] })[0];
    if (f) {
      const p = f.properties, cat = { archaeological_site: "Archaeological site", historic_temple_or_ruin: "Historic temple or ruin", active_place_of_worship: "Active temple or wat", temple_building: "Temple building", shrine: "Shrine" }[p.category] || "Temple or heritage";
      templeRow = `<div class="irow"><span>${cat}</span><span>${p.name_en || p.name || "unnamed"}</span></div>`;
    }
  }
  $("inspect-body").innerHTML = `${templeRow}
    <div class="irow"><span>Surface height</span><span>${elev.toFixed(0)} m</span></div>
    <div class="irow"><span>Above modelled drainage</span><span>${hand === null ? "–" : hand < 0 ? "hollow, below outlet" : hand.toFixed(1) + " m"}</span></div>
    <div class="irow"><span>Land cover 2021</span><span>${wc ? WC_NAMES[wc] : "–"}</span></div>
    <div class="irow"><span>Open water 2025</span><span>${WATER_NAMES[wcls]}</span></div>
    <div class="bars"><h4>Dry vs wet season</h4>
      ${bar("Water, dry", dryWater ? 1 : 0, 1, "#d09b43", wcls === 0 ? "?" : dryWater ? "yes" : "no")}
      ${bar("Water, wet", wetWater ? 1 : 0, 1, "#41b8d5", wcls === 0 ? "?" : wetWater ? "yes" : "no")}
      ${bar("Images, dry", dry, maxCount, "#9fb0b3", dry)}
      ${bar("Images, wet", wet, maxCount, "#9fb0b3", wet)}
      ${bar("Greening", ndvi === null ? 0 : Math.max(0, ndvi), 0.5, "#2d8b37", ndvi === null ? "–" : (ndvi > 0 ? "+" : "") + ndvi.toFixed(2))}
    </div>
    <div class="bars"><h4>Long-term record</h4>${bar("Water months", jrc ?? 0, 100, "#0869a4", jrc === null ? "–" : jrc + "%")}</div>
    <p class="note">Usable images = cloud-free Sentinel-2 dates in each 2025 window. “Water months” = share of months with open water, 1984–2024 (JRC). Surface height includes trees and buildings.</p>`;
  $("inspect").hidden = false;
}

/* ---------- tour ---------- */
function showStep(k) {
  const steps = TOURS[state.site];
  if (!steps) return;
  state.tour = k;
  const s = steps[k];
  $("tour").hidden = false;
  $("tour-title").textContent = s.title;
  $("tour-text").textContent = s.text;
  $("tour-count").textContent = `${k + 1} / ${steps.length}`;
  $("tour-bar").style.width = `${100 * (k + 1) / steps.length}%`;
  $("tour-prev").disabled = k === 0;
  $("tour-next").textContent = k === steps.length - 1 ? "✓" : "›";
  $("tour-next").setAttribute("aria-label", k === steps.length - 1 ? "Finish" : "Next");
  for (const l of LAYERS) toggle(l.id, s.layers.includes(l.id));
  setSeason(s.season);
  setLevel(s.level);
  if (s.ex) setEx(s.ex);
  map.flyTo({ ...s.cam, duration: 3800, essential: true });
}
function endTour() { state.tour = -1; $("tour").hidden = true; }

/* ---------- sources dialog ---------- */
function renderSources() {
  $("sources-body").innerHTML = `
  <ul>
    <li><b>Seasonal imagery and water:</b> Copernicus Sentinel-2 L2A, 2025. Median of cloud-free dates in each window. Open water: MNDWI &gt; 0, NDVI &lt; 0.3, NIR &lt; 0.25.</li>
    <li><b>Vegetation change:</b> wet-season NDVI minus dry-season NDVI, only where both windows have at least two usable dates.</li>
    <li><b>Land cover:</b> ESA WorldCover 2021 v200 (CC BY 4.0). A 2021 baseline, not a 2025 crop map.</li>
    <li><b>Long-term water:</b> JRC Global Surface Water occurrence 1984–2024, v1.5.</li>
    <li><b>Terrain:</b> Copernicus GLO-30 surface model (~30 m), including tree canopy and buildings. Flow paths and height above drainage are modelled from it (pit and depression filling, D8 flow). They are not mapped canals.</li>
    <li><b>Temples:</b> © OpenStreetMap contributors (ODbL). Locations as mapped; names do not date a site.</li>
    <li><b>Reading:</b> Groslier (1979); Van Liere (1980, 1989); Evans et al. (2007); Hawken and Cobo Castillo, <i>Angkor's Agrarian Economy</i>.</li>
  </ul>
  <p>Exploratory assessment of 2025 seasonal patterns. It does not date features, estimate 2025 agricultural area or prove present-day function. Full methods and GIS packages are available on request.</p>`;
}

/* ---------- site loading ---------- */
async function loadSite(site) {
  state.site = site;
  const base = `data/${site}/`;
  const meta = await (await fetch(base + "meta.json")).json();
  state.meta = meta;
  const [terrain, values, counts] = await Promise.all([loadPixels(base + "terrain.png"), loadPixels(base + "values.png"), loadPixels(base + "counts.png")]);
  terrainCache[site] = { meta, px: terrain };
  state.raster = { values, counts };
  state.levelCanvas = document.createElement("canvas");
  state.levelCanvas.width = meta.width; state.levelCanvas.height = meta.height;
  $("site-title").textContent = `${SITES[site].name} in 3D`;
  document.title = `${SITES[site].name} in 3D | Water, fields and terrain`;
  renderSites();
  if (pin) pin.remove();
  $("inspect").hidden = true;
  endTour();
  if (map.getTerrain && map.getTerrain()) map.setTerrain(null);
  const loaded = new Promise((r) => map.once("style.load", r));
  map.setStyle(baseStyle(), { diff: false });
  await loaded;
  addSiteLayers(site, meta);
  state.on = new Set();
  for (const l of LAYERS) if (l.on) toggle(l.id, true);
  renderLayers();
  setSeason("dry");
  setLevel(0);
  map.jumpTo({ center: [meta.center[0], meta.center[1] - 0.03], zoom: 10.45, pitch: 55, bearing: -15 });
  setEx(SITE_EX[site] || 3);
  $("start-tour").hidden = !TOURS[site];
}

async function init() {
  map = new maplibregl.Map({ container: "map", style: baseStyle(), center: [103.867, 13.36], zoom: 10, pitch: 55, maxPitch: 80, attributionControl: { compact: false }, preserveDrawingBuffer: false });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.setPadding({ left: window.innerWidth > 820 ? 340 : 0, top: 0, right: 0, bottom: 0 });
  window._map = map;
  await new Promise((r) => map.once("load", r));
  for (const id of Object.keys(SITES)) {
    if (id === "angkor") continue;
    try { if ((await fetch(`data/${id}/meta.json`, { method: "HEAD" })).ok) READY.add(id); } catch (_) {}
  }
  renderSources();
  document.querySelectorAll("#season button").forEach((b) => b.onclick = () => setSeason(b.dataset.season));
  document.querySelectorAll("#topbar [data-ex]").forEach((b) => b.onclick = () => setEx(b.dataset.ex));
  $("toggle-3d").onclick = () => { const flat = map.getPitch() > 5; map.easeTo({ pitch: flat ? 0 : 55, duration: 900 }); $("toggle-3d").classList.toggle("on", !flat); };
  let pending;
  $("level").oninput = (e) => { clearTimeout(pending); const v = e.target.value; pending = setTimeout(() => setLevel(v), 30); };
  $("start-tour").onclick = () => showStep(0);
  $("tour-prev").onclick = () => state.tour > 0 && showStep(state.tour - 1);
  $("tour-next").onclick = () => state.tour < TOURS[state.site].length - 1 ? showStep(state.tour + 1) : endTour();
  $("tour-close").onclick = endTour;
  $("inspect-close").onclick = () => { $("inspect").hidden = true; if (pin) pin.remove(); };
  $("open-sources").onclick = () => $("sources").showModal();
  $("close-sources").onclick = () => $("sources").close();
  map.on("click", inspect);
  map.on("mouseenter", "temples", () => (map.getCanvas().style.cursor = "pointer"));
  await loadSite("angkor");
}
init().catch((e) => { console.error(e); document.body.insertAdjacentHTML("beforeend", `<p style="position:absolute;top:10px;right:10px;background:#fff;padding:8px">Could not load: ${e.message}</p>`); });
