// Fallback sample events, used when no Google Sheet URL is configured.
// Shape mirrors the expected Google Sheet columns:
//   name, theme, subtheme, orgType, orgName, date, time, venue, address, lat, lng, url, description
//
// `theme` MUST match a theme id in config.js (e.g. "Te Taiao").
// `subtheme` is optional; used by themes that declare subthemes (e.g. How Stuff Works).
// `orgType` MUST match an id in PORIRUA_ORG_TYPES (e.g. "Iwi & Marae").
// `orgName` is the hosting organisation / kaupapa lead (free text).
window.PORIRUA_SAMPLE_EVENTS = [
  // ================= Rangatahi =================
  {
    name: "Takapūwāhia Marae rangatahi climate wānanga",
    theme: "Rangatahi",
    orgType: "Iwi & Marae",
    orgName: "Ngāti Toa Rangatira",
    date: "2026-05-10", time: "10:00",
    venue: "Takapūwāhia Marae",
    address: "Takapūwāhia, Porirua",
    lat: -41.1363, lng: 174.8405,
    url: "",
    description:
      "Rangatahi-led wānanga at Takapūwāhia exploring mātauranga Māori responses to " +
      "climate change and how 12–24 year olds can set their own kaupapa.",
  },
  {
    name: "Mātiti Tamariki wānanga",
    theme: "Rangatahi",
    orgType: "School / Kura",
    orgName: "Aotea College + Ngāti Toa",
    date: "2026-06-01", time: "09:00",
    venue: "Aotea College",
    address: "Aotea, Porirua",
    lat: -41.1290, lng: 174.8538,
    url: "",
    description:
      "Tamariki and rangatahi wānanga focused on sustainable practices — reinstated " +
      "and expanded across a range of ages, with a taiao and resilience focus.",
  },
  {
    name: "Youth Council co-design hui",
    theme: "Rangatahi",
    orgType: "Council / Government",
    orgName: "Porirua City Council",
    date: "2026-07-15", time: "16:30",
    venue: "Porirua City Council",
    address: "16 Cobham Court, Porirua",
    lat: -41.1371, lng: 174.8398,
    url: "",
    description:
      "Co-design workshop with rangatahi to shape a reinstated Youth Council and how " +
      "they are represented in local and regional decision-making.",
  },

  // ================= Weaving Porirua Together =================
  {
    name: "Porirua Community Leaders' Forum",
    theme: "Weaving Porirua Together",
    orgType: "Community Group",
    orgName: "Te Wāhi Tiaki Tātou",
    date: "2026-05-20", time: "17:30",
    venue: "Te Rauparaha Arena",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1367, lng: 174.8409,
    url: "https://reindeer-avocado-974t.squarespace.com/porirua-community-leaders-forum",
    description:
      "Monthly gathering of Porirua's iwi, Pacific, community, migrant, business and " +
      "education leaders — identifying shared priorities and coordinating collective impact.",
  },
  {
    name: "Kai Kaupapa Group hui",
    theme: "Weaving Porirua Together",
    orgType: "Kaupapa Group",
    orgName: "Kai Kaupapa Group (PCLF)",
    date: "2026-05-06", time: "10:00",
    venue: "Te Rauparaha Arena",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1367, lng: 174.8409,
    url: "https://reindeer-avocado-974t.squarespace.com/kai",
    description:
      "Kai Kaupapa Group — providers, iwi and community leaders collaborating on kai " +
      "access, aligning with Goal 2 of the Regional Food System Plan.",
  },
  {
    name: "Pātaka Kai weekly distribution",
    theme: "Weaving Porirua Together",
    orgType: "Community Group",
    orgName: "Pātaka Kai",
    date: "2026-04-30", time: "14:00",
    venue: "Cannons Creek",
    address: "Cannons Creek, Porirua",
    lat: -41.1478, lng: 174.8515,
    url: "",
    description:
      "Pātaka Kai distributed over 1,400 kai packs in the last six months of 2025. " +
      "Weekly drop-in for whānau needing kai support.",
  },
  {
    name: "Te Umu ki Rangituhi — Porirua's Social Supermarket",
    theme: "Weaving Porirua Together",
    orgType: "Social Enterprise",
    orgName: "Te Umu ki Rangituhi",
    date: "2026-04-28", time: "09:00",
    venue: "Te Umu ki Rangituhi",
    address: "Porirua",
    lat: -41.1402, lng: 174.8448,
    url: "https://reindeer-avocado-974t.squarespace.com/kai",
    description:
      "Porirua's social supermarket — restoring choice and dignity for whānau needing " +
      "kai support. 1,017 tangata served in the last half of 2025.",
  },
  {
    name: "R.O.C.C. community workshop",
    theme: "Weaving Porirua Together",
    orgType: "Community Group",
    orgName: "Wesley Community Action + R.O.C.C.",
    date: "2026-06-11", time: "18:30",
    venue: "Wesley Community Action",
    address: "Porirua",
    lat: -41.1392, lng: 174.8436,
    url: "https://reindeer-avocado-974t.squarespace.com/rocc",
    description:
      "Resilience to Organised Crime in Communities — a locally-led, socially-grounded " +
      "response to the harms of methamphetamine and organised crime in Porirua.",
  },

  // ================= Te Taiao =================
  {
    name: "Ngahere Korowai planting day",
    theme: "Te Taiao",
    orgType: "Community Group",
    orgName: "Ngahere Korowai",
    date: "2026-05-24", time: "09:30",
    venue: "Te Awarua-o-Porirua catchment",
    address: "Porirua",
    lat: -41.1200, lng: 174.8650,
    url: "",
    description:
      "Native afforestation working bee — community, schools, kura and Ngāti Toa " +
      "planting together to restore biodiversity and build climate resilience.",
  },
  {
    name: "Porirua Harbour restoration hui",
    theme: "Te Taiao",
    orgType: "Advocacy / Research",
    orgName: "Porirua Harbour Trust",
    date: "2026-07-05", time: "10:00",
    venue: "Porirua Stream",
    address: "Porirua",
    lat: -41.1420, lng: 174.8380,
    url: "",
    description:
      "Hands-on waterways restoration with an integrated, nature-based approach to " +
      "stormwater and harbour health.",
  },
  {
    name: "Collective Action: Move Communities Closer to the Tree",
    theme: "Te Taiao",
    orgType: "Community Group",
    orgName: "Te Wāhi Tiaki Tātou",
    date: "2026-04-10", time: "10:00",
    venue: "Porirua",
    address: "Porirua",
    lat: -41.1340, lng: 174.8420,
    url: "https://reindeer-avocado-974t.squarespace.com/news",
    description:
      "Community-led kaupapa to bring the ngahere closer to where whānau live — more " +
      "urban green space, shade, and manaakitanga for tamariki.",
  },

  // ================= How We Roll =================
  {
    name: "Porirua Assembly — A Place of Firsts panel",
    theme: "How We Roll",
    orgType: "Community Group",
    orgName: "Porirua Assembly",
    date: "2025-12-04", time: "17:30",
    venue: "Te Rauparaha Arena",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1367, lng: 174.8409,
    url: "https://reindeer-avocado-974t.squarespace.com/",
    description:
      "Panel reflecting on the Porirua Assembly — what enabled so many 'firsts' in " +
      "deliberative democracy for climate action, and how they played out in practice.",
  },
  {
    name: "Te Tiriti governance model workshop",
    theme: "How We Roll",
    orgType: "Advocacy / Research",
    orgName: "Te Reo o Ngā Tāngata / The People Speak",
    date: "2026-08-10", time: "14:00",
    venue: "Pātaka Art + Museum",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1363, lng: 174.8418,
    url: "",
    description:
      "Exploring a Te Tiriti o Waitangi model of governance for Porirua beyond the " +
      "Harbour Accord — community-informed planning and decision-making.",
  },
  {
    name: "Housing Kaupapa Group hui",
    theme: "How We Roll",
    orgType: "Kaupapa Group",
    orgName: "Housing Kaupapa Group (PCLF)",
    date: "2026-05-13", time: "10:00",
    venue: "Te Āhuru Mōwai",
    address: "Porirua",
    lat: -41.1382, lng: 174.8412,
    url: "https://reindeer-avocado-974t.squarespace.com/housing",
    description:
      "Providers, iwi and community leaders tackling barriers to housing access — " +
      "coordinating wrap-around support across Te Āhuru Mōwai, Kāinga Ora, community housing.",
  },

  // ================= Know More Do More =================
  {
    name: "Porirua Schools Step Up on Climate",
    theme: "Know More Do More",
    orgType: "School / Kura",
    orgName: "Porirua Schools (Enviroschools cluster)",
    date: "2026-03-28", time: "09:00",
    venue: "Porirua College",
    address: "Porirua",
    lat: -41.1395, lng: 174.8440,
    url: "https://reindeer-avocado-974t.squarespace.com/news",
    description:
      "Porirua schools cluster launched a tamariki-led climate programme — embedding " +
      "sustainability into the curriculum alongside Enviroschools.",
  },
  {
    name: "Kura reo: taiao & climate change",
    theme: "Know More Do More",
    orgType: "School / Kura",
    orgName: "Porirua College",
    date: "2026-07-20", time: "09:00",
    venue: "Porirua College",
    address: "Porirua",
    lat: -41.1395, lng: 174.8440,
    url: "",
    description:
      "Te reo Māori immersion focused on environmental themes and climate change for " +
      "tamariki and rangatahi.",
  },
  {
    name: "Climate kōrero with mana whenua",
    theme: "Know More Do More",
    orgType: "Iwi & Marae",
    orgName: "Ngāti Toa Rangatira",
    date: "2026-05-18", time: "18:00",
    venue: "Hongoeka Marae",
    address: "Plimmerton",
    lat: -41.0850, lng: 174.8600,
    url: "",
    description:
      "Wānanga at Hongoeka with whānau and wider community to raise awareness, " +
      "build capability and understand our part in responding to climate change.",
  },

  // ================= How Stuff Works =================
  {
    name: "Community solar + battery info night",
    theme: "How Stuff Works",
    subtheme: "Energy",
    orgType: "Advocacy / Research",
    orgName: "Sustainability Trust",
    date: "2026-06-08", time: "19:00",
    venue: "Cannons Creek Community Hall",
    address: "Cannons Creek, Porirua",
    lat: -41.1485, lng: 174.8500,
    url: "",
    description:
      "Shared solar and battery storage for neighbourhood-level resilience, with a " +
      "focus on equitable access for renters and social housing tenants.",
  },
  {
    name: "Water tank install demo",
    theme: "How Stuff Works",
    subtheme: "Water",
    orgType: "Council / Government",
    orgName: "Porirua City Council",
    date: "2026-06-22", time: "11:00",
    venue: "Titahi Bay",
    address: "Titahi Bay, Porirua",
    lat: -41.1100, lng: 174.8300,
    url: "",
    description:
      "Hyper-local water capture demo as part of investigating distributed water " +
      "supply and resilience across Porirua.",
  },
  {
    name: "Para Kore waste reduction & repair café",
    theme: "How Stuff Works",
    subtheme: "Waste",
    orgType: "Community Group",
    orgName: "Para Kore",
    date: "2026-07-12", time: "13:00",
    venue: "Pātaka Art + Museum",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1363, lng: 174.8418,
    url: "",
    description:
      "Follow the 5 Rs with a Para Kore-led kaupapa Māori waste reduction session " +
      "and community repair café.",
  },
  {
    name: "On-demand bus trial feedback hui",
    theme: "How Stuff Works",
    subtheme: "Transport",
    orgType: "Council / Government",
    orgName: "Metlink / Greater Wellington",
    date: "2026-08-02", time: "18:00",
    venue: "Porirua Train Station",
    address: "Porirua",
    lat: -41.1380, lng: 174.8402,
    url: "",
    description:
      "Share what you need from public transport — last-mile connectivity, on-demand " +
      "buses, carpooling, and accessibility across Porirua.",
  },
  {
    name: "Takiwatanga in Tamariki presentation",
    theme: "How Stuff Works",
    subtheme: "Health",
    orgType: "Community Group",
    orgName: "Autism NZ + Te Wāhi Tiaki Tātou",
    date: "2025-09-15", time: "18:30",
    venue: "Porirua",
    address: "Porirua",
    lat: -41.1380, lng: 174.8420,
    url: "https://reindeer-avocado-974t.squarespace.com/news",
    description:
      "Presentation and Q&A on Takiwatanga / Autism in tamariki — integrating health, " +
      "whānau and kura supports.",
  },
];
