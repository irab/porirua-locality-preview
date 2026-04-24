// Fallback sample events, used when no Google Sheet URL is configured.
// Shape mirrors the expected Google Sheet columns:
//   name, theme, subtheme, date, time, venue, address, lat, lng, url, description
//
// `theme` MUST match a theme id in config.js (e.g. "Te Taiao").
// `subtheme` is optional; used by themes that declare subthemes (e.g. How Stuff Works).
window.PORIRUA_SAMPLE_EVENTS = [
  {
    name: "Youth Council design wānanga",
    theme: "Rangatahi",
    date: "2026-05-10",
    time: "10:00",
    venue: "Takapūwāhia Marae",
    address: "Porirua",
    lat: -41.1363, lng: 174.8405,
    url: "",
    description:
      "Rangatahi-led workshop to co-design a reinstated Youth Council and shape how " +
      "12–24 year olds are represented in regional decision-making.",
  },
  {
    name: "Mātiti Tamariki wānanga",
    theme: "Rangatahi",
    date: "2026-06-01",
    time: "09:00",
    venue: "Aotea College",
    address: "Porirua",
    lat: -41.1290, lng: 174.8538,
    url: "",
    description:
      "Tamariki and rangatahi wānanga focused on sustainable practices, reinstated " +
      "and expanded across a range of ages.",
  },

  {
    name: "Porirua Community Leaders Forum",
    theme: "Weaving Porirua Together",
    date: "2026-05-20",
    time: "17:30",
    venue: "Te Rauparaha Arena",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1367, lng: 174.8409,
    url: "https://reindeer-avocado-974t.squarespace.com/porirua-community-leaders-forum",
    description:
      "Monthly gathering of community-led rōpū connecting, strengthening, and " +
      "leveraging existing initiatives across Porirua.",
  },
  {
    name: "Marae Resilience Support — info hui",
    theme: "Weaving Porirua Together",
    date: "2026-06-15",
    time: "18:00",
    venue: "Hongoeka Marae",
    address: "Plimmerton",
    lat: -41.0850, lng: 174.8600,
    url: "",
    description:
      "Introduction to a proposed support programme for current and future marae, " +
      "including fit-for-purpose 'pop-up' marae for emergency response.",
  },

  {
    name: "Ngahere Korowai planting day",
    theme: "Te Taiao",
    date: "2026-05-24",
    time: "09:30",
    venue: "Te Awarua-o-Porirua catchment",
    address: "Porirua",
    lat: -41.1200, lng: 174.8650,
    url: "",
    description:
      "Community native planting alongside schools, kura, Ngāti Toa and environmental " +
      "organisations. Restoring biodiversity and building climate resilience.",
  },
  {
    name: "Waterways restoration working bee",
    theme: "Te Taiao",
    date: "2026-07-05",
    time: "10:00",
    venue: "Porirua Stream",
    address: "Porirua",
    lat: -41.1420, lng: 174.8380,
    url: "",
    description:
      "Hands-on restoration integrating nature-based solutions to improve stormwater " +
      "and harbour health.",
  },

  {
    name: "Porirua Assembly — A Place of Firsts panel",
    theme: "How We Roll",
    date: "2025-12-04",
    time: "17:30",
    venue: "Te Rauparaha Arena",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1367, lng: 174.8409,
    url: "https://reindeer-avocado-974t.squarespace.com/events",
    description:
      "Panellists reflect on the Porirua Assembly's innovations, what enabled so many " +
      "firsts, and how these played out in practice.",
  },
  {
    name: "Te Tiriti governance model workshop",
    theme: "How We Roll",
    date: "2026-08-10",
    time: "14:00",
    venue: "Pātaka Art + Museum",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1363, lng: 174.8418,
    url: "",
    description:
      "Exploring a Te Tiriti o Waitangi model of governance for Porirua beyond the " +
      "Harbour Accord, with community input on next steps.",
  },

  {
    name: "Climate kōrero with mana whenua",
    theme: "Know More Do More",
    date: "2026-05-18",
    time: "18:00",
    venue: "Takapūwāhia Marae",
    address: "Porirua",
    lat: -41.1363, lng: 174.8405,
    url: "",
    description:
      "Wānanga with whānau and wider community to raise awareness, build capability " +
      "and understand our part to play in responding to climate change.",
  },
  {
    name: "Kura reo: taiao & climate change",
    theme: "Know More Do More",
    date: "2026-07-20",
    time: "09:00",
    venue: "Porirua College",
    address: "Porirua",
    lat: -41.1395, lng: 174.8440,
    url: "",
    description:
      "Te reo Māori immersion focused on environmental themes and climate change.",
  },

  {
    name: "Community solar + battery info night",
    theme: "How Stuff Works",
    subtheme: "Energy",
    date: "2026-06-08",
    time: "19:00",
    venue: "Cannons Creek Community Hall",
    address: "Porirua",
    lat: -41.1485, lng: 174.8500,
    url: "",
    description:
      "Learn about shared solar and battery storage for neighbourhood-level resilience, " +
      "with a focus on equitable access for renters and social housing tenants.",
  },
  {
    name: "Water tank install demo",
    theme: "How Stuff Works",
    subtheme: "Water",
    date: "2026-06-22",
    time: "11:00",
    venue: "Titahi Bay",
    address: "Titahi Bay, Porirua",
    lat: -41.1100, lng: 174.8300,
    url: "",
    description:
      "Hyper-local water capture demo as part of investigating distributed water " +
      "supply across Porirua.",
  },
  {
    name: "Waste reduction & repair café",
    theme: "How Stuff Works",
    subtheme: "Waste",
    date: "2026-07-12",
    time: "13:00",
    venue: "Pātaka Art + Museum",
    address: "17 Parumoana Street, Porirua",
    lat: -41.1363, lng: 174.8418,
    url: "",
    description:
      "Follow the 5 Rs — Refuse, Reduce, Reuse, Recycle, Responsibility — with a " +
      "community repair café and drop-off for hard-to-dispose items.",
  },
  {
    name: "On-demand bus trial feedback hui",
    theme: "How Stuff Works",
    subtheme: "Transport",
    date: "2026-08-02",
    time: "18:00",
    venue: "Porirua Train Station",
    address: "Porirua",
    lat: -41.1380, lng: 174.8402,
    url: "",
    description:
      "Share what you need from public transport — last-mile connectivity, on-demand " +
      "buses, carpooling, and accessibility.",
  },
];
