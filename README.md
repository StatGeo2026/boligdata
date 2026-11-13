# Boligdata-legeplads

A static web page where students write R/ggplot2 code against Danish housing
data and see the figure at once. R runs in the browser with
[webR](https://docs.r-wasm.org/webr/), so there is no server. The data file is
encrypted, and the page asks for the course password (posted on Absalon). The
gallery of student figures is stored in a Neon Postgres database.

```
index.html, style.css, app.js   the page
eksempler.js                    start code and example snippets (Danish)
eksempler_skjulte.js            more examples, kept out of git (not on the site)
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
Neon (the submission check depends on the password). After editing only
`neon.sql`, `node 05_krypter.mjs --kun-sql` regenerates `ud/neon_udfyldt.sql`
without re-encrypting the data.

## Gallery (Neon)

Neon project `boligdata-galleri` (`rough-rice-14034312`, Frankfurt):
https://console.neon.tech/app/projects/rough-rice-14034312

New submissions wait until you tick `godkendt` in **Tables > indsendelser**
(or run `update indsendelser set godkendt = true where id = '...'` in the SQL
Editor). See `neon.sql` for the access rules: the page reads approved figures
through the view `galleri` (which has `where godkendt` built in), and a trigger
checks the course code on every insert, so moderation still holds if row-level
security on the table is switched off in the console.

How it was set up (Neon CLI, `npx neon@latest`):

```sh
neon projects create --name boligdata-galleri --region-id aws-eu-central-1
neon neon-auth enable --project-id <id> --database-name neondb
neon data-api create --project-id <id> --database neondb \
  --auth-provider neon_auth --db-anon-role anonymous --db-max-rows 500
neon neon-auth domain add https://statgeo2026.github.io --project-id <id>
# then run fuld/ud/neon_udfyldt.sql as the owner, and
neon data-api refresh-schema --project-id <id> --database neondb
```

## Testing locally

```sh
python3 -m http.server 8765     # then open http://localhost:8765
```

## Rebuilding the editor bundle

`vendor/editor-entry.js` is the source. Rebuild with
`npx esbuild vendor/editor-entry.js --bundle --format=esm --minify --outfile=vendor/editor.js`
after `npm i codemirror@6.0.2 @codemirror/legacy-modes@6.5.2 esbuild`.
