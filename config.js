// Configuration for the Porirua Locality events + map preview.
// Themes are derived from the Porirua Assembly Recommendations:
// https://static1.squarespace.com/static/61a403b442b8840d9ed2143a/t/68355b24fb37801191c0ad0a/1748327214881/Porirua+Assembly+Recommendations-compressed.pdf

window.PORIRUA_MAP_CONFIG = {
  // Paste the "Publish to web -> CSV" URL from Google Sheets here.
  googleSheetCsvUrl: "",

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
      description:
        "Guarantee equitable access to environmental education and lifelong learning " +
        "that enables people to connect with te taiao and act.",
    },
    {
      id: "How Stuff Works",
      title: "How Stuff Works",
      subtitle: "Resilient Infrastructure",
      color: "#7E3FA0", // grape purple
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
