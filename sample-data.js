// Fallback organisation inventory. Only used when BOTH
// cfg.googleSheetCsvUrl AND cfg.dataCsvUrl fail (or return zero rows).
// Canonical data lives in data/organisations.csv.
//
// Shape mirrors the CSV columns:
//   name, orgType, theme, themes, venue, address, lat, lng, url,
//   description, initiatives, labels
//
// `theme`       = primary Porirua Assembly recommendation (exact theme id
//                 from config.js, e.g. "Te Taiao").
// `themes`      = additional cross-cutting themes (array here; comma-
//                 separated string in the CSV / Sheet).
// `orgType`     = id from PORIRUA_ORG_TYPES (e.g. "Iwi & Marae").
// `initiatives` = flagship programmes / kaupapa; `|` or `;` separated
//                 in the CSV / Sheet.
// `labels`      = free-form descriptor tags for this org, rendered as
//                 small chips and useful for future search / filtering.
//                 `|` or `;` separated in the CSV / Sheet.
window.PORIRUA_SAMPLE_ORGS = [
  // ================= Iwi & Marae =================
  {
    name: "Ngāti Toa Rangatira",
    orgType: "Iwi & Marae",
    theme: "Weaving Porirua Together",
    themes: ["Weaving Porirua Together", "How We Roll", "Te Taiao", "Rangatahi"],
    venue: "Takapūwāhia Marae",
    address: "Takapūwāhia, Porirua",
    lat: -41.1363, lng: 174.8405,
    url: "https://www.ngatitoa.iwi.nz/",
    description:
      "Mana whenua of Porirua. Iwi-led kaitiakitanga of Te Awarua-o-Porirua, hosting " +
      "the Porirua Assembly and Te Wāhi Tiaki Tātou kaupapa. Marae at Takapūwāhia and " +
      "Hongoeka (Plimmerton).",
    initiatives: [
      "Te Wāhi Tiaki Tātou / Porirua Assembly auspice",
      "Marae Resilience Support programme",
      "Rangatahi wānanga across Takapūwāhia and Hongoeka",
    ],
    labels: ["mana whenua", "kaitiakitanga", "marae", "Te Tiriti"],
  },

  // ================= Community Groups =================
  {
    name: "Te Wāhi Tiaki Tātou",
    orgType: "Community Group",
    theme: "Weaving Porirua Together",
    themes: ["Weaving Porirua Together", "How We Roll", "Know More Do More"],
    venue: "Porirua",
    address: "Porirua",
    lat: -41.1355, lng: 174.8423,
    url: "https://reindeer-avocado-974t.squarespace.com/",
    description:
      "Iwi-led community rōpū convening leaders across Porirua, running the Reimagining " +
      "Hui, the Porirua Community Leaders' Forum and the Porirua Assembly. Coordinates " +
      "shared priorities for collective impact.",
    initiatives: [
      "Reimagining Hui (mental health, diabetes, dental, tāngata whaikaha)",
      "Monthly e-Pānui",
      "Porirua Community Leaders' Forum",
    ],
    labels: ["iwi-led", "convening", "deliberative", "e-pānui"],
  },
  {
    name: "Porirua Community Leaders' Forum (PCLF)",
    orgType: "Community Group",
    theme: "Weaving Porirua Together",
    themes: ["Weaving Porirua Together", "How We Roll"],
    venue: "Te Rauparaha Arena",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1367, lng: 174.8409,
    url: "https://reindeer-avocado-974t.squarespace.com/porirua-community-leaders-forum",
    description:
      "Forum of Porirua's iwi, Pacific, community, migrant, business and education " +
      "leaders. Hosts kaupapa groups that turn shared priorities into practical action " +
      "on kai, housing and wider systems.",
    initiatives: [
      "Kaupapa Groups (Kai, Housing)",
      "PCLF Operating Model",
      "Collective impact coordination",
    ],
    labels: ["leaders forum", "convening", "collective impact"],
  },
  {
    name: "Porirua Assembly",
    orgType: "Community Group",
    theme: "How We Roll",
    themes: ["How We Roll", "Te Taiao", "Weaving Porirua Together"],
    venue: "Te Rauparaha Arena",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1366, lng: 174.8411,
    url: "https://reindeer-avocado-974t.squarespace.com/porirua-assembly",
    description:
      "Aotearoa's first iwi-led citizens' assembly on climate. Produced six overarching " +
      "recommendations after 40+ community members deliberated with mana whenua, " +
      "experts and each other.",
    initiatives: [
      "Porirua Assembly Recommendations (2025)",
      "A Place of Firsts — public reflections",
      "Deliberative democracy model for climate action",
    ],
    labels: ["citizens' assembly", "climate", "deliberative democracy", "Aotearoa first"],
  },
  {
    name: "R.O.C.C. — Resilience to Organised Crime in Communities",
    orgType: "Community Group",
    theme: "Weaving Porirua Together",
    themes: ["Weaving Porirua Together", "Rangatahi"],
    venue: "Porirua",
    address: "Porirua",
    lat: -41.1392, lng: 174.8436,
    url: "https://reindeer-avocado-974t.squarespace.com/rocc",
    description:
      "Locally-led, socially-grounded response to the harms of methamphetamine and " +
      "organised crime in Porirua. Supports rangatahi and vulnerable whānau, informed " +
      "by Reimagining Hui kōrero.",
    initiatives: [
      "Harm minimisation education",
      "Wānanga with rangatahi at risk",
      "Data-informed Op-Eds (National Drug Intelligence Bureau)",
    ],
    labels: ["meth", "organised crime", "harm minimisation", "whānau safety"],
  },
  {
    name: "Wesley Community Action",
    orgType: "Community Group",
    theme: "Weaving Porirua Together",
    themes: ["Weaving Porirua Together"],
    venue: "Wesley Community Action",
    address: "Porirua",
    lat: -41.1395, lng: 174.8432,
    url: "https://wesleyca.org.nz/",
    description:
      "Long-standing Porirua-based community action agency partnering on R.O.C.C. and " +
      "wider whānau support. Runs financial mentoring, food support and community-led " +
      "responses to harm.",
    initiatives: [
      "R.O.C.C. delivery partner",
      "Financial mentoring",
      "Community food programmes",
    ],
    labels: ["community action", "financial mentoring", "food support"],
  },
  {
    name: "Pātaka Kai",
    orgType: "Community Group",
    theme: "Weaving Porirua Together",
    themes: ["Weaving Porirua Together"],
    venue: "Cannons Creek",
    address: "Cannons Creek, Porirua",
    lat: -41.1478, lng: 174.8515,
    url: "",
    description:
      "Community kai distribution — 1,428 kai packs delivered to Porirua whānau in " +
      "the last half of 2025. Operates at the short-term relief end of the Community " +
      "Food Security Continuum.",
    initiatives: [
      "Weekly kai packs for whānau in need",
      "Coordination with kai providers across Porirua",
    ],
    labels: ["kai", "food relief", "Cannons Creek"],
  },
  {
    name: "Ngahere Korowai",
    orgType: "Community Group",
    theme: "Te Taiao",
    themes: ["Te Taiao", "Know More Do More"],
    venue: "Te Awarua-o-Porirua catchment",
    address: "Porirua",
    lat: -41.1200, lng: 174.8650,
    url: "",
    description:
      "Native afforestation kaupapa restoring ngahere across the Te Awarua-o-Porirua " +
      "catchment. Works alongside schools, kura, Ngāti Toa and environmental " +
      "organisations on biodiversity and climate resilience.",
    initiatives: [
      "Community planting days",
      "Catchment-scale native restoration",
      "Schools + iwi collaboration",
    ],
    labels: ["ngahere", "native planting", "catchment restoration"],
  },
  {
    name: "Para Kore",
    orgType: "Community Group",
    theme: "How Stuff Works",
    themes: ["How Stuff Works", "Know More Do More"],
    venue: "Pātaka Art + Museum",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1363, lng: 174.8418,
    url: "https://parakore.maori.nz/",
    description:
      "Kaupapa Māori zero-waste organisation running the 5 Rs (Refuse, Reduce, Reuse, " +
      "Recycle, Responsibility) with marae, kura and communities across Aotearoa, " +
      "including Porirua.",
    initiatives: [
      "Marae and kura zero-waste audits",
      "Community repair cafés",
      "Mana whenua-led waste reduction education",
    ],
    labels: ["zero waste", "kaupapa Māori", "5 Rs"],
  },
  {
    name: "Autism NZ (Wellington region)",
    orgType: "Community Group",
    theme: "How Stuff Works",
    themes: ["How Stuff Works", "Rangatahi"],
    venue: "Porirua",
    address: "Porirua (community venues)",
    lat: -41.1380, lng: 174.8420,
    url: "https://www.autismnz.org.nz/",
    description:
      "Information, advocacy and support for autistic tamariki, rangatahi and whānau. " +
      "Partners with Te Wāhi Tiaki Tātou on Takiwatanga Tamariki presentations.",
    initiatives: [
      "Takiwatanga Tamariki Q&A",
      "Whānau support groups",
      "Educator and provider training",
    ],
    labels: ["takiwatanga", "neurodivergence", "whānau support"],
  },

  // ================= Kaupapa Groups (PCLF) =================
  {
    name: "Kai Kaupapa Group",
    orgType: "Kaupapa Group",
    theme: "Weaving Porirua Together",
    themes: ["Weaving Porirua Together", "Te Taiao"],
    venue: "Te Rauparaha Arena",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1369, lng: 174.8411,
    url: "https://reindeer-avocado-974t.squarespace.com/kai",
    description:
      "PCLF kaupapa group bringing providers, iwi and community leaders together to " +
      "shape Porirua's kai system. Aligned with Goal 2 of the Regional Food System Plan.",
    initiatives: [
      "Aligning Pātaka Kai, Te Umu ki Rangituhi and kai providers",
      "Contribution to the Regional Food System Plan",
      "Food Security Continuum work",
    ],
    labels: ["kai system", "PCLF", "Food System Plan"],
  },
  {
    name: "Housing Kaupapa Group",
    orgType: "Kaupapa Group",
    theme: "How We Roll",
    themes: ["How We Roll", "Weaving Porirua Together"],
    venue: "Te Āhuru Mōwai",
    address: "Porirua",
    lat: -41.1384, lng: 174.8414,
    url: "https://reindeer-avocado-974t.squarespace.com/housing",
    description:
      "PCLF kaupapa group working across the Housing Continuum with iwi, Te Āhuru " +
      "Mōwai, Kāinga Ora and community housing providers on access, coordination and " +
      "wrap-around supports.",
    initiatives: [
      "Coordination across housing providers",
      "Shared visibility of housing stock",
      "Responses to severe housing deprivation in Porirua",
    ],
    labels: ["housing continuum", "PCLF", "coordination"],
  },

  // ================= Social Enterprise =================
  {
    name: "Te Umu ki Rangituhi — Porirua's Social Supermarket",
    orgType: "Social Enterprise",
    theme: "Weaving Porirua Together",
    themes: ["Weaving Porirua Together"],
    venue: "Te Umu ki Rangituhi",
    address: "Porirua",
    lat: -41.1402, lng: 174.8448,
    url: "https://reindeer-avocado-974t.squarespace.com/kai",
    description:
      "Porirua's social supermarket. Restores choice and dignity for whānau needing " +
      "kai support — 1,017 tangata supported in the second half of 2025.",
    initiatives: [
      "Affordable, dignified kai access",
      "Reducing stigma in food support",
      "Supporting wider kai system coordination",
    ],
    labels: ["social supermarket", "kai", "dignity"],
  },
  {
    name: "Te Āhuru Mōwai",
    orgType: "Social Enterprise",
    theme: "How We Roll",
    themes: ["How We Roll", "Weaving Porirua Together"],
    venue: "Te Āhuru Mōwai",
    address: "Porirua",
    lat: -41.1382, lng: 174.8412,
    url: "https://teahurumowai.co.nz/",
    description:
      "Ngāti Toa-connected community housing provider delivering public housing with " +
      "wrap-around, locally grounded support across Porirua.",
    initiatives: [
      "Public and community housing tenancies",
      "Wrap-around whānau support",
      "Housing Kaupapa Group partner",
    ],
    labels: ["community housing", "iwi-connected", "whānau support"],
  },

  // ================= Council / Government =================
  {
    name: "Porirua City Council",
    orgType: "Council / Government",
    theme: "How We Roll",
    themes: ["How We Roll", "How Stuff Works", "Rangatahi"],
    venue: "Porirua City Council",
    address: "16 Cobham Court, Porirua",
    lat: -41.1371, lng: 174.8398,
    url: "https://poriruacity.govt.nz/",
    description:
      "Local authority for Porirua. Partner on place-based initiatives, infrastructure " +
      "investment, youth voice (Youth Council co-design) and the Te Awarua-o-Porirua " +
      "Harbour Accord.",
    initiatives: [
      "Youth Council co-design",
      "Climate action plan",
      "Water / stormwater resilience investment",
    ],
    labels: ["local government", "harbour accord", "youth council"],
  },
  {
    name: "Kāinga Ora — Porirua",
    orgType: "Council / Government",
    theme: "How We Roll",
    themes: ["How We Roll"],
    venue: "Kāinga Ora Porirua",
    address: "Porirua",
    lat: -41.1390, lng: 174.8410,
    url: "https://kaingaora.govt.nz/",
    description:
      "Central government public housing provider. Significant landlord in Porirua, " +
      "contributing to the housing continuum alongside Te Āhuru Mōwai and community " +
      "housing providers.",
    initiatives: [
      "Public housing tenancies",
      "Healthy Homes upgrades",
      "Regeneration projects",
    ],
    labels: ["public housing", "Healthy Homes"],
  },
  {
    name: "Metlink / Greater Wellington Regional Council",
    orgType: "Council / Government",
    theme: "How Stuff Works",
    themes: ["How Stuff Works", "Te Taiao"],
    venue: "Porirua Train Station",
    address: "Porirua",
    lat: -41.1380, lng: 174.8402,
    url: "https://www.metlink.org.nz/",
    description:
      "Regional government body responsible for public transport (Metlink), harbour " +
      "health and flood protection. Partners on last-mile connectivity and on-demand " +
      "bus trials across Porirua.",
    initiatives: [
      "On-demand bus trials",
      "Te Awarua-o-Porirua Harbour Accord",
      "Regional climate & flood response",
    ],
    labels: ["public transport", "harbour accord", "regional"],
  },

  // ================= School / Kura =================
  {
    name: "Porirua College",
    orgType: "School / Kura",
    theme: "Know More Do More",
    themes: ["Know More Do More", "Rangatahi"],
    venue: "Porirua College",
    address: "Porirua",
    lat: -41.1395, lng: 174.8440,
    url: "https://www.poriruacollege.school.nz/",
    description:
      "Secondary school with a strong te ao Māori foundation. Hosts kura reo and " +
      "climate mahi with rangatahi, part of the Porirua schools climate cluster.",
    initiatives: [
      "Kura reo: taiao & climate",
      "Rangatahi leadership programmes",
      "Schools climate cluster participation",
    ],
    labels: ["kura", "rangatahi", "taiao"],
  },
  {
    name: "Aotea College",
    orgType: "School / Kura",
    theme: "Rangatahi",
    themes: ["Rangatahi", "Know More Do More"],
    venue: "Aotea College",
    address: "Aotea, Porirua",
    lat: -41.1290, lng: 174.8538,
    url: "https://www.aotea.school.nz/",
    description:
      "Secondary school serving northern Porirua. Partner for Mātiti Tamariki " +
      "wānanga — sustainable practices reinstated and expanded across age ranges.",
    initiatives: [
      "Mātiti Tamariki wānanga",
      "Enviroschools participation",
      "Cross-generational sustainability kaupapa",
    ],
    labels: ["kura", "rangatahi", "enviroschools"],
  },
  {
    name: "Enviroschools Porirua cluster",
    orgType: "School / Kura",
    theme: "Know More Do More",
    themes: ["Know More Do More", "Te Taiao", "Rangatahi"],
    venue: "Porirua schools cluster",
    address: "Porirua",
    lat: -41.1410, lng: 174.8460,
    url: "https://www.enviroschools.org.nz/",
    description:
      "Local cluster of the national Enviroschools programme — tamariki-led climate " +
      "and sustainability learning embedded in the curriculum across Porirua schools.",
    initiatives: [
      "'Porirua Schools Step Up on Climate' campaign",
      "Native planting with Ngahere Korowai",
      "Curriculum-embedded sustainability",
    ],
    labels: ["schools network", "tamariki-led", "curriculum"],
  },

  // ================= Advocacy / Research =================
  {
    name: "Porirua Harbour Trust",
    orgType: "Advocacy / Research",
    theme: "Te Taiao",
    themes: ["Te Taiao", "How Stuff Works"],
    venue: "Te Awarua-o-Porirua Harbour",
    address: "Porirua",
    lat: -41.1280, lng: 174.8470,
    url: "https://www.poriruaharbourtrust.org.nz/",
    description:
      "Community-led advocacy and restoration for Te Awarua-o-Porirua. Working bees, " +
      "monitoring and education focused on stormwater, stream health and the wider " +
      "harbour ecosystem.",
    initiatives: [
      "Waterways restoration working bees",
      "Porirua Stream water-quality monitoring",
      "Schools education programmes",
    ],
    labels: ["harbour", "water quality", "restoration"],
  },
  {
    name: "Te Reo o Ngā Tāngata / The People Speak",
    orgType: "Advocacy / Research",
    theme: "How We Roll",
    themes: ["How We Roll", "Rangatahi"],
    venue: "Pātaka Art + Museum",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1363, lng: 174.8418,
    url: "https://thepeoplespeak.nz/",
    description:
      "Deliberative democracy specialists who partnered on the Porirua Assembly. " +
      "Designs Te Tiriti-based citizens' assemblies and community-informed governance " +
      "models.",
    initiatives: [
      "Porirua Assembly co-design",
      "Te Tiriti governance model workshops",
      "Deliberative democracy research",
    ],
    labels: ["deliberative", "Te Tiriti", "governance"],
  },
  {
    name: "Sustainability Trust",
    orgType: "Advocacy / Research",
    theme: "How Stuff Works",
    themes: ["How Stuff Works", "Know More Do More"],
    venue: "Cannons Creek Community Hall",
    address: "Cannons Creek, Porirua (programme venue)",
    lat: -41.1485, lng: 174.8500,
    url: "https://sustaintrust.org.nz/",
    description:
      "Wellington-region sustainability charity delivering Healthy Homes assessments, " +
      "energy advice, tenant education and community solar + battery programmes " +
      "across Porirua neighbourhoods.",
    initiatives: [
      "Healthy Homes assessments",
      "Community solar + battery info nights",
      "Tenant energy advocacy",
    ],
    labels: ["Healthy Homes", "energy", "solar"],
  },
];
