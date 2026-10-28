"""Browser derivatives for the 3D landscape explorer, from the verified site packages.

Per site (dist/data/<site>/), all on one EPSG:3857 grid:
  terrain.png   Terrarium-encoded Copernicus DSM (R*256 + G + B/256 - 32768 m), cut into tiles in the browser
  dry.webp / wet.webp   Sentinel-2 true colour 2025 seasonal medians
  water.webp, ndvi.webp, landcover.webp, hand.webp   styled overlays
  values.png    lossless lookup for clicks/slider: R = HAND (0 nodata, 1 => -10 m, 0.5 m steps),
                G = WorldCover index*8 + water class, B = NDVI change (0 nodata, 1..255 => -1..+1), A = 255
  counts.png    R = dry usable dates, G = wet usable dates, B = JRC occurrence % (255 nodata), A = 255
  drainage.geojson, contours.geojson, box.geojson, temples.geojson (if present), meta.json
Source packages are read only.
"""
from pathlib import Path
import json
import sys

import geopandas as gpd
import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, transform_bounds, Resampling

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
PKG = PROJECT / "landscape_followup/gis"
SITES = {s["id"]: s for s in json.loads((PROJECT / "code/sites.json").read_text())}
WC = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]
WC_RGB = {10: (0, 100, 0), 20: (255, 187, 34), 30: (255, 255, 76), 40: (240, 150, 255), 50: (250, 0, 0),
          60: (180, 180, 180), 70: (240, 240, 240), 80: (0, 100, 200), 90: (0, 150, 160), 95: (0, 207, 117), 100: (250, 230, 160)}
WATER_RGBA = {2: (8, 105, 164, 230), 3: (65, 184, 213, 210), 4: (208, 155, 67, 230)}


def grid(site):
    with rasterio.open(PKG / site / "rasters/dem.tif") as src:
        merc = transform_bounds(src.crs, "EPSG:3857", *src.bounds, densify_pts=41)
    width = 2236
    height = round(width * (merc[3] - merc[1]) / (merc[2] - merc[0]))
    return merc, width, height, from_bounds(*merc, width, height)


def warp(site, name, g, band=1, nearest=True, keep_zero=False):
    merc, w, h, tr = g
    out = np.full((h, w), np.nan, dtype=np.float32)
    with rasterio.open(PKG / site / "rasters" / name) as src:
        a = src.read(band).astype(np.float32)
        nod = src.nodata
        if keep_zero:
            nod = None
        elif nod is not None and not np.isnan(nod):
            a[a == nod] = np.nan
            nod = None
        reproject(a, out, src_transform=src.transform, src_crs=src.crs, src_nodata=nod if nod is not None else np.nan,
                  dst_transform=tr, dst_crs="EPSG:3857", dst_nodata=np.nan,
                  resampling=Resampling.nearest if nearest else Resampling.bilinear)
    return out


def save(path, arr, lossless=False):
    img = Image.fromarray(arr.astype(np.uint8))
    if lossless:
        img.save(path, optimize=True)
    else:
        img.save(path, quality=82, method=6)


def write_geojson(frame, path, grid=1e-5):
    """Overwrite-safe GeoJSON writer (the drive mount forbids GDAL's delete-then-create)."""
    import shapely
    frame = frame.copy()
    frame["geometry"] = shapely.set_precision(frame.geometry.values, grid)
    Path(path).write_text(frame.to_json(drop_id=True), encoding="utf-8")


def fill_nearest(a):
    from scipy.ndimage import distance_transform_edt
    m = ~np.isfinite(a)
    if not m.any():
        return a
    idx = distance_transform_edt(m, return_distances=False, return_indices=True)
    return a[tuple(idx)]


def run(site):
    s = SITES[site]
    out = ROOT / "dist/data" / site
    out.mkdir(parents=True, exist_ok=True)
    g = grid(site)
    merc, w, h, _ = g
    inside = np.isfinite(warp(site, "dem.tif", g, nearest=False))

    # Terrain: fill outside-box corners with nearest height so the edge has no cliff.
    dem = fill_nearest(warp(site, "dem.tif", g, nearest=False))
    v = np.clip(dem, -500, 8000) + 32768
    r = np.floor(v / 256); gg = np.floor(v - r * 256); b = np.round((v - r * 256 - gg) * 256)
    b = np.clip(b, 0, 255)
    save(out / "terrain.png", np.dstack([r, gg, b]), lossless=True)

    # True colour composites.
    for season in ["dry", "wet"]:
        cube = np.stack([warp(site, f"{season}_composite.tif", g, band=k, nearest=False) for k in (3, 2, 1)], -1)
        ok = np.isfinite(cube).all(-1)
        rgb = np.power(np.clip(np.nan_to_num(cube) / 0.28, 0, 1), 1 / 1.1) * 255
        save(out / f"{season}.webp", np.dstack([rgb, np.where(ok, 255, 0)]))

    water = warp(site, "water_change.tif", g, keep_zero=True)
    rgba = np.zeros((h, w, 4), np.uint8)
    for k, c in WATER_RGBA.items():
        rgba[water == k] = c
    rgba[(water == 0) & inside] = (150, 150, 150, 110)
    save(out / "water.webp", rgba)

    ndvi = warp(site, "ndvi_wet_minus_dry_min2obs_2025.tif", g)
    t = np.clip(np.nan_to_num(ndvi) / 0.5, -1, 1)
    rgba = np.zeros((h, w, 4), np.uint8)
    pos, neg = t > 0, t < 0
    rgba[..., 0] = np.where(pos, 245 - 200 * t, np.where(neg, 245 + 0 * t, 245))
    rgba[..., 1] = np.where(pos, 245 - 80 * t, np.where(neg, 245 + 110 * t, 245))
    rgba[..., 2] = np.where(pos, 245 - 200 * t, np.where(neg, 245 + 200 * t, 245))
    # Fade near-zero change so the landscape shows through; strong change is opaque.
    rgba[..., 3] = np.where(np.isfinite(ndvi), np.clip(25 + 230 * np.abs(t) ** 0.8, 0, 235), 0)
    save(out / "ndvi.webp", rgba)

    wc = warp(site, "worldcover_2021.tif", g)
    rgba = np.zeros((h, w, 4), np.uint8)
    for k, c in WC_RGB.items():
        rgba[wc == k] = (*c, 200)
    save(out / "landcover.webp", rgba)

    hand = warp(site, "hand_m.tif", g)
    hand[hand <= -9999] = np.nan
    ramp = [(-10, (84, 39, 143)), (0, (8, 48, 107)), (2, (33, 113, 181)), (5, (107, 174, 214)), (10, (198, 219, 239)),
            (20, (247, 244, 233)), (50, (217, 182, 122)), (150, (140, 90, 43))]
    xs = [p[0] for p in ramp]
    rgba = np.zeros((h, w, 4), np.uint8)
    hv = np.nan_to_num(hand, nan=-10)
    for ch in range(3):
        rgba[..., ch] = np.interp(hv, xs, [p[1][ch] for p in ramp])
    # Strongest where ground is low (near drainage); higher ground fades out.
    rgba[..., 3] = np.where(np.isfinite(hand), np.clip(np.interp(hv, [-10, 0, 3, 10, 30, 150], [210, 200, 170, 90, 70, 110]), 0, 255), 0)
    save(out / "hand.webp", rgba)

    # Lossless lookup images (alpha fixed at 255 so browsers do not premultiply).
    hq = np.where(np.isfinite(hand), np.clip(np.round((hand + 10) * 2) + 1, 1, 255), 0)
    wci = np.zeros((h, w));
    for i, k in enumerate(WC):
        wci[wc == k] = i + 1
    wcl = np.nan_to_num(water, nan=0)
    gch = wci * 8 + wcl
    nq = np.where(np.isfinite(ndvi), np.clip(np.round((np.clip(ndvi, -1, 1) + 1) * 127) + 1, 1, 255), 0)
    save(out / "values.png", np.dstack([hq, gch, nq, np.full((h, w), 255)]), lossless=True)
    dc = np.nan_to_num(warp(site, "dry_observation_count.tif", g, keep_zero=True), nan=0)
    wcn = np.nan_to_num(warp(site, "wet_observation_count.tif", g, keep_zero=True), nan=0)
    jrc = warp(site, "jrc_occurrence_1984_2024.tif", g, keep_zero=True)
    jq = np.where(np.isfinite(jrc) & (jrc <= 100), jrc, 255)
    save(out / "counts.png", np.dstack([np.clip(dc, 0, 254), np.clip(wcn, 0, 254), jq, np.full((h, w), 255)]), lossless=True)

    # Vectors in lon/lat.
    gpkg = PKG / site / f"{site}.gpkg"
    dr = gpd.read_file(gpkg, layer="drainage_lines_dsm").to_crs(4326)
    dr["geometry"] = dr.simplify(0.0002)
    write_geojson(dr[["upstream_km2_in_box", "geometry"]].round({"upstream_km2_in_box": 1}), out / "drainage.geojson")
    co = gpd.read_file(gpkg, layer="contours_smoothed_dsm").to_crs(4326)
    co["geometry"] = co.simplify(0.0002)
    write_geojson(co[["elev_m", "index_contour", "geometry"]], out / "contours.geojson")
    write_geojson(gpd.read_file(gpkg, layer="comparison_area").to_crs(4326)[["geometry"]], out / "box.geojson")
    import pyogrio
    if "temples_osm" in [n for n, _ in pyogrio.list_layers(gpkg)]:
        t = gpd.read_file(gpkg, layer="temples_osm").to_crs(4326)
        write_geojson(t[["name", "name_en", "category", "historic", "religion", "osm_id", "geometry"]], out / "temples.geojson", 1e-6)

    lon0, lat0, lon1, lat1 = transform_bounds("EPSG:3857", "EPSG:4326", *merc)
    ver = json.loads((PKG / site / "verification.json").read_text())
    land = json.loads((PKG / site / "landform_summary.json").read_text())
    d = dem[inside]
    meta = dict(site=site, width=w, height=h, mercator=list(merc),
                corners=[[lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]],
                center=[s["lon"], s["lat"]], dry=s["dry"], wet=s["wet"],
                elev_p02=float(np.percentile(d, 2)), elev_p98=float(np.percentile(d, 98)),
                water_km2={k: round(v["vector_km2"], 1) for k, v in ver["water_polygon_area_checks_km2"].items()},
                landform=land, worldcover=WC, has_temples=(out / "temples.geojson").exists())
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    print(site, w, h, sorted(p.name for p in out.iterdir()))


if __name__ == "__main__":
    for site in sys.argv[1:] or ["angkor"]:
        run(site)
