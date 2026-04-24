// Configuration for the Porirua Locality events + map preview.
// Themes are derived from the Porirua Assembly Recommendations:
// https://static1.squarespace.com/static/61a403b442b8840d9ed2143a/t/68355b24fb37801191c0ad0a/1748327214881/Porirua+Assembly+Recommendations-compressed.pdf

// Lucide-style stroked SVG icon paths (24x24, inner markup only).
// Rendered by map.js into theme badges, map markers, and sub-theme pills.
window.PORIRUA_ICONS = {
  // Rangatahi — sprout: youth, growth, connection to te taiao
  sprout:
    '<path d="M7 20h10"/>' +
    '<path d="M10 20c5.5-2.5.8-6.4 3-10"/>' +
    '<path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/>' +
    '<path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  // Weaving Porirua Together — network: connected rōpū
  network:
    '<rect x="16" y="16" width="6" height="6" rx="1"/>' +
    '<rect x="2" y="16" width="6" height="6" rx="1"/>' +
    '<rect x="9" y="2" width="6" height="6" rx="1"/>' +
    '<path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>' +
    '<path d="M12 12V8"/>',
  // Te Taiao — trees: native forests, environment
  trees:
    '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/>' +
    '<path d="M7 16v6"/>' +
    '<path d="M13 19h6"/>' +
    '<path d="M16 22V5"/>' +
    '<path d="M16 5a3 3 0 0 1 3 3c.4.7.7 1.5.7 2.3A3.5 3.5 0 0 1 19 14a4 4 0 0 1-4.3-3.1"/>',
  // How We Roll — compass: direction, plan
  compass:
    '<circle cx="12" cy="12" r="10"/>' +
    '<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  // Know More Do More — book-open: wānanga, lifelong learning
  "book-open":
    '<path d="M12 7v14"/>' +
    '<path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  // How Stuff Works — cog: infrastructure
  cog:
    '<path d="M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"/>' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M12 2v2"/><path d="M12 20v2"/>' +
    '<path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/>' +
    '<path d="M2 12h2"/><path d="M20 12h2"/>' +
    '<path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/>',

  // Sub-theme icons (How Stuff Works)
  droplet:
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  recycle:
    '<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/>' +
    '<path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/>' +
    '<path d="m14 16-3 3 3 3"/>' +
    '<path d="M8.293 13.596 7.196 9.5 3.1 10.598"/>' +
    '<path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/>' +
    '<path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>',
  bus:
    '<path d="M8 6v6"/><path d="M15 6v6"/>' +
    '<path d="M2 12h19.6"/>' +
    '<path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>' +
    '<circle cx="7" cy="18" r="2"/>' +
    '<path d="M9 18h5"/>' +
    '<circle cx="16" cy="18" r="2"/>',
  zap:
    '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  "heart-pulse":
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>' +
    '<path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',

  // Organisation-type icons (Lucide)
  landmark:
    '<line x1="3" x2="21" y1="22" y2="22"/>' +
    '<line x1="6" x2="6" y1="18" y2="11"/>' +
    '<line x1="10" x2="10" y1="18" y2="11"/>' +
    '<line x1="14" x2="14" y1="18" y2="11"/>' +
    '<line x1="18" x2="18" y1="18" y2="11"/>' +
    '<polygon points="12 2 20 7 4 7"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
    '<circle cx="9" cy="7" r="4"/>' +
    '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' +
    '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  "users-round":
    '<path d="M18 21a8 8 0 0 0-16 0"/>' +
    '<circle cx="10" cy="8" r="5"/>' +
    '<path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  "graduation-cap":
    '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>' +
    '<path d="M22 10v6"/>' +
    '<path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  "building-2":
    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>' +
    '<path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>' +
    '<path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>' +
    '<path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  store:
    '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>' +
    '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>' +
    '<path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>' +
    '<path d="M2 7h20"/>' +
    '<path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
  megaphone:
    '<path d="m3 11 18-5v12L3 14v-3z"/>' +
    '<path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
};

// Map sub-theme string -> icon key. Used for the "How Stuff Works" pills.
window.PORIRUA_SUBTHEME_ICONS = {
  Water: "droplet",
  Waste: "recycle",
  Transport: "bus",
  Energy: "zap",
  Health: "heart-pulse",
};

// Organisation types — used for the second filter bar.
// `id` is the exact string editors put in the `orgType` column.
window.PORIRUA_ORG_TYPES = [
  { id: "Iwi & Marae",          title: "Iwi & Marae",          icon: "landmark",        color: "#6b2a3d" },
  { id: "Community Group",      title: "Community Group",      icon: "users",           color: "#a04a1f" },
  { id: "Kaupapa Group",        title: "Kaupapa Group",        icon: "users-round",     color: "#7a4a1f" },
  { id: "School / Kura",        title: "School / Kura",        icon: "graduation-cap",  color: "#335577" },
  { id: "Council / Government", title: "Council / Government", icon: "building-2",      color: "#4a4a5a" },
  { id: "Social Enterprise",    title: "Social Enterprise",    icon: "store",           color: "#5a6a3a" },
  { id: "Advocacy / Research",  title: "Advocacy / Research",  icon: "megaphone",       color: "#583e74" },
];

window.PORIRUA_MAP_CONFIG = {
  // ---------------- Data source ----------------
  // The inventory is loaded in this order of preference:
  //   1. googleSheetCsvUrl   (if set) — live from a Google Sheet
  //   2. dataCsvUrl          (default) — bundled local CSV
  //
  // If both fail the map renders an empty state and the status line under
  // the map says what went wrong.
  //
  // Two ways to wire up a Google Sheet URL:
  //
  //  A) Direct export (what we're using — no publish step required).
  //     Requires the sheet's link-sharing to be "Anyone with the link → Viewer".
  //     Pattern:  https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<TAB_ID>
  //
  //  B) Publish-to-web (for wider distribution / a stable permalink).
  //     File → Share → Publish to web → CSV → Publish, then use the resulting URL
  //     (ends with `/pub?output=csv`).
  //
  // Live sheet: https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/edit
  googleSheetCsvUrl:
    "https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/export?format=csv&gid=0",

  // Fallback CSV (shipped in the repo). Used whenever googleSheetCsvUrl is
  // empty or fails to load. Requires the page to be served over http(s).
  dataCsvUrl: "./data/organisations.csv",

  // Map initial view (Porirua city centre).
  center: { lat: -41.1350, lng: 174.8400 },
  zoom: 12,

  // The six overarching recommendation themes. Colours are tuned to
  // harmonise with the Porirua Locality brand palette (plum + crimson).
  themes: [
    {
      id: "Rangatahi",
      title: "Rangatahi",
      subtitle: "Youth",
      color: "#CF2028", // brand crimson
      icon: "sprout",
      description:
        "Intentionally include, enable and empower our rangatahi to set their own " +
        "kaupapa and participate meaningfully and equitably in design, decision-making " +
        "and implementation across all aspects of environmental management.",
    },
    {
      id: "Weaving Porirua Together",
      title: "Weaving Porirua Together",
      subtitle: "Resilient People Network",
      color: "#D97706", // warm orange
      icon: "network",
      description:
        "Build and sustain momentum for courageous, bold and collaborative action by " +
        "establishing a sustainable network that connects, strengthens, and leverages " +
        "existing community-led rōpū.",
    },
    {
      id: "Te Taiao",
      title: "Te Taiao",
      subtitle: "Our Environment",
      color: "#2E7D4F", // forest green
      icon: "trees",
      description:
        "Protect and restore the mauri of our whenua, taonga and our wai, including " +
        "our waterways, flora and fauna, local food systems, native forests, harbour " +
        "and shorelines.",
    },
    {
      id: "How We Roll",
      title: "How We Roll",
      subtitle: "Approach & Implementation",
      color: "#60174C", // brand plum
      icon: "compass",
      description:
        "Develop an evidence-based, community-informed, Iwi-led action plan, ensuring " +
        "present and intergenerational commitment from everyone with skin in the game " +
        "in Porirua.",
    },
    {
      id: "Know More Do More",
      title: "Know More Do More",
      subtitle: "Action Through Education and Awareness",
      color: "#0E7490", // teal
      icon: "book-open",
      description:
        "Guarantee equitable access to environmental education and lifelong learning " +
        "that enables people to connect with te taiao and act.",
    },
    {
      id: "How Stuff Works",
      title: "How Stuff Works",
      subtitle: "Resilient Infrastructure",
      color: "#7E3FA0", // grape purple
      icon: "cog",
      description:
        "Invest in water, waste, energy, health and transport systems that reflect " +
        "the needs of our people and place — driven by indigenous and local innovation " +
        "and solutions.",
      subthemes: ["Water", "Waste", "Transport", "Energy", "Health"],
    },
  ],

  defaultColor: "#60174C",

  recommendationsPdfUrl:
    "https://static1.squarespace.com/static/61a403b442b8840d9ed2143a/t/68355b24fb37801191c0ad0a/1748327214881/Porirua+Assembly+Recommendations-compressed.pdf",
};
