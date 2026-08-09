/** Crisis links, need categories, and community filters for the public directory. */

export const crisisLinks = [
  { label: "111 Emergency", href: "tel:111", description: "Life-threatening emergency" },
  { label: "105 Police non-emergency", href: "tel:105", description: "Report a crime or incident" },
  { label: "1737", href: "tel:1737", description: "Need to talk? Free call or text" },
  { label: "Women's Refuge", href: "tel:0800733843", description: "0800 REFUGE / 0800 733 843" },
];

export const needCategories = [
  { id: "food", label: "Food / kai" },
  { id: "housing", label: "Housing / a place to stay" },
  { id: "money", label: "Money help" },
  { id: "safety", label: "Feeling unsafe" },
  { id: "support", label: "Support and counselling" },
  { id: "health", label: "Health" },
  { id: "legal", label: "Legal advice" },
  { id: "work", label: "Work and learning" },
  { id: "everyday", label: "Everyday needs" },
];

export const communityFilters = [
  { id: "marae_iwi", label: "Marae and iwi" },
  { id: "community_groups", label: "Community groups" },
  { id: "councils", label: "Councils and public agencies" },
  { id: "kai_initiatives", label: "Food / Pātaka Kai" },
  { id: "schools", label: "Schools / kura" },
  { id: "other_community", label: "Other community orgs" },
];

/** Leaflet map centre — Porirua city. */
export const mapDefaults = {
  lat: -41.134,
  lng: 174.84,
  zoom: 12,
};
