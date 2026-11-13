# Boligdata-legeplads

A static web page where students write R/ggplot2 code against Danish housing
data and see the figure at once. R runs in the browser with
[webR](https://docs.r-wasm.org/webr/), so there is no server. The data file is
encrypted, and the page asks for the course password (posted on Absalon). The
gallery of student figures is stored in a Neon Postgres database.

```
index.html, style.css, app.js   the page
eksempler.js                    start code and example snippets (Danish)
config.js                       Neon URL, webR version, R packages
data/boligdata.bin              encrypted .rds with all tables (AES-GCM)
data/variabler.json             variable names and descriptions (not secret)
vendor/editor.js                CodeMirror 6 + R mode, bundled with esbuild
neon.sql                        table and access rules for the gallery
```

## Updating the data

The pipeline lives outside this repo (`boligdata/fuld/` in the course folder):

```sh
python3 01_hent_raa.py          # raw download (slow and polite; run rarely)
python3 02_flad.py              # flat CSV tables
Rscript 03_berig.R              # distances, DST municipality data, map, cities
Rscript 04_byg_data.R           # ud/boligdata.rds + ud/variabler.json + CSVs
node 05_krypter.mjs             # -> site/data/boligdata.bin, data/variabler.json
```

Then commit and push `data/`. To change the password, edit `fuld/.kodeord`,
rerun `05_krypter.mjs`, and also rerun the generated `ud/neon_udfyldt.sql` in
Neon (the submission check depends on the password).

## Gallery (Neon)

1. Create a Neon project. In the Console, open **Data API**, tick **Use Neon
   Auth**, and enable it.
2. Under **Auth > Settings**, allow anonymous access, and add the site's origin
   (for example `https://<user>.github.io`) as a trusted domain.
3. Run `fuld/ud/neon_udfyldt.sql` in the **SQL Editor**.
4. Put the database URL (without user, password or `?…`) into `config.js`.

New submissions wait until you tick `godkendt` in **Tables > indsendelser**.

## Testing locally

```sh
python3 -m http.server 8765     # then open http://localhost:8765
```

## Rebuilding the editor bundle

`vendor/editor-entry.js` is the source. Rebuild with
`npx esbuild vendor/editor-entry.js --bundle --format=esm --minify --outfile=vendor/editor.js`
after `npm i codemirror@6.0.2 @codemirror/legacy-modes@6.5.2 esbuild`.
