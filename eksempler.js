// Start code and examples for the playground (Danish, for students).

export const STARTKODE = `# Velkommen! Tryk Kør (eller Ctrl/⌘ + Enter).
# Tabellen boliger indeholder alle boliger til salg i Danmark.
# Se variablerne under fanen "Variabler" og flere idéer under "Eksempler".

boliger |>
  filter(property_type %in% c("villa", "condo")) |>
  ggplot(aes(x = living_area_m2, y = price_dkk / 1e6, colour = property_type)) +
  geom_point(alpha = 0.2, size = 0.7) +
  scale_x_log10() +
  scale_y_log10() +
  labs(x = "Boligareal (m²)", y = "Udbudspris (mio. kr.)", colour = "Boligtype",
       title = "Større boliger koster mere, men hvor meget?")
`;

export const EKSEMPLER = [
  {
    titel: "Kvadratmeterpris pr. region",
    tekst: "Boksplot af m²-priser for villaer i de fem regioner.",
    kode: `boliger |>
  filter(property_type == "villa") |>
  ggplot(aes(x = region, y = price_per_m2)) +
  geom_boxplot(outlier.alpha = 0.1) +
  labs(x = NULL, y = "Kvadratmeterpris (kr./m²)",
       title = "Villaer: kvadratmeterpris pr. region")
`,
  },
  {
    titel: "Danmarkskort over kvadratmeterpriser",
    tekst: "Hver bolig er et punkt på kortet, farvet efter m²-pris.",
    kode: `boliger |>
  filter(property_type %in% c("villa", "terraced house")) |>
  arrange(price_per_m2) |>
  ggplot(aes(x = lon, y = lat, colour = price_per_m2)) +
  geom_point(size = 0.3) +
  scale_colour_viridis_c(trans = "log10", labels = scales::label_number(big.mark = ".", decimal.mark = ",")) +
  coord_quickmap() +
  theme_void() +
  labs(colour = "kr./m²", title = "Kvadratmeterpris for huse til salg")
`,
  },
  {
    titel: "Kort over kommuner (koropletkort)",
    tekst: "Median-m²-pris pr. kommune, koblet på kommunegrænserne.",
    kode: `pris_kommune <- boliger |>
  filter(property_type == "villa") |>
  group_by(municipality_code) |>
  summarise(median_pris = median(price_per_m2, na.rm = TRUE))

kommunekort |>
  left_join(pris_kommune, by = "municipality_code") |>
  ggplot(aes(x = long, y = lat, group = group, fill = median_pris)) +
  geom_polygon(colour = "white", linewidth = 0.1) +
  scale_fill_viridis_c(labels = scales::label_number(big.mark = ".", decimal.mark = ",")) +
  coord_quickmap() +
  theme_void() +
  labs(fill = "kr./m²", title = "Villaer: median-kvadratmeterpris pr. kommune")
`,
  },
  {
    titel: "Betaler man for at bo ved vandet?",
    tekst: "Kvadratmeterpris mod afstand til kysten, med en udglattet kurve.",
    kode: `boliger |>
  filter(property_type == "villa", dist_coast_km < 30) |>
  ggplot(aes(x = dist_coast_km, y = price_per_m2)) +
  geom_point(alpha = 0.05) +
  geom_smooth() +
  facet_wrap(~ region) +
  coord_cartesian(ylim = c(0, 75000)) +
  scale_y_continuous(labels = scales::label_number(big.mark = ".", decimal.mark = ",")) +
  labs(x = "Afstand til kysten (km)", y = "Kvadratmeterpris (kr./m²)",
       title = "Villaer: pris og afstand til kysten")
`,
  },
  {
    titel: "Afstand til nærmeste storby",
    tekst: "Brug byer-tabellen og afstand_km() til selv at regne afstanden ud.",
    kode: `# Afstand fra hver bolig til Aarhus' bymidte
aarhus <- byer |> filter(city == "Aarhus")

boliger |>
  filter(property_type == "villa") |>
  mutate(km_til_aarhus = afstand_km(lat, lon, aarhus$lat, aarhus$lon)) |>
  filter(km_til_aarhus < 60) |>
  ggplot(aes(x = km_til_aarhus, y = price_per_m2)) +
  geom_point(alpha = 0.15) +
  geom_smooth(method = "lm") +
  labs(x = "Afstand til Aarhus (km)", y = "Kvadratmeterpris (kr./m²)",
       title = "Jo længere fra Aarhus, jo billigere?")
`,
  },
  {
    titel: "Hvor ligger de 20 største byer?",
    tekst: "Kommunekort med byerne som punkter, størrelse efter indbyggertal.",
    kode: `ggplot() +
  geom_polygon(data = kommunekort, aes(long, lat, group = group),
               fill = "grey92", colour = "white", linewidth = 0.2) +
  geom_point(data = byer, aes(lon, lat, size = population), colour = "firebrick") +
  geom_text(data = byer, aes(lon, lat, label = city), size = 3, vjust = -0.9,
            check_overlap = TRUE) +
  scale_size_area(labels = scales::label_number(big.mark = ".", decimal.mark = ",")) +
  coord_quickmap() +
  theme_void() +
  labs(size = "Indbyggere", title = "Danmarks 20 største byer")
`,
  },
  {
    titel: "Energimærke og pris",
    tekst: "Koster et godt energimærke ekstra?",
    kode: `boliger |>
  filter(property_type == "villa", !is.na(energy_label)) |>
  ggplot(aes(x = energy_label, y = price_per_m2)) +
  geom_boxplot(outlier.shape = NA) +
  coord_cartesian(ylim = c(0, 50000)) +
  labs(x = "Energimærke", y = "Kvadratmeterpris (kr./m²)",
       title = "Villaer: kvadratmeterpris efter energimærke")
`,
  },
  {
    titel: "Hvor længe er boligerne til salg?",
    tekst: "Histogram over liggetid for de almindeligste boligtyper.",
    kode: `boliger |>
  filter(property_type %in% c("villa", "condo", "holiday house", "terraced house")) |>
  ggplot(aes(x = days_on_market_total)) +
  geom_histogram(binwidth = 30, boundary = 0) +
  facet_wrap(~ property_type, scales = "free_y") +
  coord_cartesian(xlim = c(0, 730)) +
  labs(x = "Dage til salg i alt", y = "Antal boliger",
       title = "Liggetid for boliger til salg")
`,
  },
  {
    titel: "Prisudvikling siden 1992",
    tekst: "Brug salg-tabellen: median-salgspris pr. år (kun fri handel).",
    kode: `salg |>
  filter(sale_type == "normal", sale_year < 2026) |>
  group_by(sale_year) |>
  summarise(median_pris = median(sale_price_dkk), antal = n()) |>
  ggplot(aes(x = sale_year, y = median_pris / 1e6)) +
  geom_line() +
  geom_point(aes(size = antal)) +
  labs(x = "År", y = "Median-salgspris (mio. kr.)", size = "Antal salg",
       title = "Tidligere salg af boliger, der er til salg i dag")
`,
  },
  {
    titel: "Hvad er huset steget siden sidst?",
    tekst: "Udbudspris i dag mod prisen ved seneste salg.",
    kode: `boliger |>
  filter(property_type == "villa", last_sale_type == "normal",
         last_sale_date >= as.Date("2010-01-01")) |>
  mutate(stigning = price_dkk / last_sale_price_dkk,
         aar_siden = as.numeric(as.Date("2026-11-13") - last_sale_date) / 365.25) |>
  ggplot(aes(x = aar_siden, y = stigning)) +
  geom_point(alpha = 0.1) +
  geom_smooth() +
  scale_y_log10() +
  labs(x = "År siden seneste salg", y = "Udbudspris / seneste salgspris (log-skala)",
       title = "Villaer: prisstigning siden seneste salg")
`,
  },
  {
    titel: "Indkomst og huspriser",
    tekst: "Kobl boliger med kommuner (left_join): bor de rige dyrt?",
    kode: `boliger |>
  filter(property_type == "villa") |>
  group_by(municipality_code) |>
  summarise(median_pris = median(price_per_m2, na.rm = TRUE), antal = n()) |>
  left_join(kommuner, by = "municipality_code") |>
  ggplot(aes(x = mean_disp_income_dkk / 1000, y = median_pris)) +
  geom_point(aes(size = antal), alpha = 0.6) +
  geom_smooth(method = "lm") +
  labs(x = "Gns. disponibel indkomst i kommunen (1.000 kr.)",
       y = "Median-kvadratmeterpris (kr./m²)", size = "Antal villaer",
       title = "Villapriser og indkomst, én prik pr. kommune")
`,
  },
  {
    titel: "Tæt på toget",
    tekst: "Ejerlejligheder i hovedstadsområdet: pris og afstand til station.",
    kode: `boliger |>
  filter(property_type == "condo", region == "Hovedstaden", dist_station_km < 3) |>
  ggplot(aes(x = dist_station_km, y = price_per_m2, colour = nearest_station_type)) +
  geom_point(alpha = 0.15, size = 0.8) +
  geom_smooth(method = "lm", se = FALSE) +
  labs(x = "Afstand til nærmeste station (km)", y = "Kvadratmeterpris (kr./m²)",
       colour = "Stationstype", title = "Ejerlejligheder i Region Hovedstaden")
`,
  },
  {
    titel: "Hvad står der i annoncen?",
    tekst: "Andel af boligerne pr. region, hvis annonce nævner havudsigt.",
    kode: `boliger |>
  group_by(region) |>
  summarise(andel_havudsigt = mean(txt_havudsigt)) |>
  ggplot(aes(x = andel_havudsigt, y = fct_reorder(region, andel_havudsigt))) +
  geom_col() +
  scale_x_continuous(labels = scales::label_percent()) +
  labs(x = "Andel af annoncer der nævner havudsigt", y = NULL,
       title = "Havudsigt i boligannoncer")
`,
  },
];
