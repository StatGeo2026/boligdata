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
];
