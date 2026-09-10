import { communityFilters, needCategories } from "../config-directory.js";

export const FIELD_LABELS = {
  name: "Name",
  title: "Service name",
  service_name: "Service name",
  serviceName: "Service name",
  description: "Description",
  address: "Address",
  phone: "Phone",
  url: "Website",
  email: "Email",
  lat: "Map pin",
  lng: "Map pin",
  categories: "Help types",
  community_filters: "Community groups",
  communityFilters: "Community groups",
};

export function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

export function helpTypeOptions() {
  return needCategories.map((item) => ({ id: item.id, label: item.label }));
}

export function communityGroupOptions() {
  return communityFilters.map((item) => ({ id: item.id, label: item.label }));
}
