# Product composition sources

## USDA SR Legacy

Source: U.S. Department of Agriculture, Agricultural Research Service, FoodData Central, SR Legacy April 2018 release.
- https://fdc.nal.usda.gov/download-datasets/
- https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
- https://fdc.nal.usda.gov/Foundation_Foods_Documentation/

The bundled catalog contains 7,793 records from the official archive. FoodData Central data are public domain / CC0 1.0. Archive SHA-256: `b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0`.

Rebuild with `python scripts/build-food-catalog.py path/to/archive.zip`. The script preserves missing nutrients as absent, retains original descriptions for translated records and saves FDC identifiers. Most original descriptions are English; 55 common records have explicit Russian names, with a Russian/English search dictionary for additional common ingredients. No complete Russian translation is claimed.

All values are per 100 g edible portion of the precise raw/cooked record. Vitamin A is RAE; folate is DFE; vitamin K is phylloquinone (K1). No conversion from A IU / RE or folate total to RAE / DFE is invented. Vitamin D is mcg (40 IU per mcg). Fluoride in USDA is mcg and is converted to mg. Omega-3 is the sum of explicitly identified ALA, EPA, DHA and DPA; an incomplete component set is flagged partial. Unspecified PUFA 18:3 is not treated as omega-3. Iodine, biotin, chromium, molybdenum and chloride often have no measured values in this release.

## Open Food Facts

- https://world.openfoodfacts.org/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- https://world.openfoodfacts.org/terms-of-use

Open Food Facts database: Open Database License (ODbL); individual database contents: Database Contents License (DbCL). This application credits the source in product details and exports. The bundled USDA catalog is independent of OFF; no OFF database dump is bundled. User-selected OFF values remain identified as OFF in their private local diary/export. No product photographs are included.

Read-only full text search uses the supported legacy `/cgi/search.pl` endpoint because `/api/v2/search` does not implement plain text search; barcode reads use `/api/v3/product`. Search is only triggered explicitly and throttled to one request per 6.5 seconds, with a per-session result cache. Values ending `_100g` are normalized mass values (grams, except energy), regardless of original label `_unit`; these are converted to the application's canonical mg/mcg units. Products labeled by volume require an explicit density before conversion to grams. The user is asked to check label basis for branded records. Unavailable data are not inferred from other foods. API/network errors leave the diary intact.

## Personal goals

The public source contains no personal nutrition targets. Targets are entered on-device or imported from a private JSON backup. Blank goals remain unknown and do not produce percentages. Goal changes retain an effective-date history; private notes can accompany imported goals. These are user-selected settings, not dietary recommendations.
