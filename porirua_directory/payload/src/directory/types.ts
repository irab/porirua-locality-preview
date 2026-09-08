import type { ReactNode } from "react";

export type DirectoryTabId = "needs" | "review" | "listings";

export type ListingFormValues = {
  name: string;
  description: string;
  address: string;
  phone: string;
  url: string;
  categories: string[];
  communityFilters: string[];
  lat?: number | null;
  lng?: number | null;
};

export type NameMatch = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  status?: string;
  statusLabel?: string;
  organizationId?: string;
};

export type GeoResult = {
  label: string;
  lat: number;
  lng: number;
};

export type FormHighlight = {
  changed: Array<{
    field: string;
    label: string;
    mark: string;
    added?: string[];
    removed?: string[];
  }>;
  youSetThis: Array<{ field: string; label: string; mark: string }>;
  focusField: string | null;
  focusOption: string | null;
};

export type DirectoryTab = { id: DirectoryTabId; label: string };

export type StatusBandModel = {
  role: "status";
  review: { count: number; label: string; disabled: boolean };
  waiting: { count: number; label: string; disabled: boolean };
  undo: { visible: boolean; label: string };
};

export type VerificationBarModel = {
  websiteHref: string;
  websiteHidden: boolean;
  websiteTarget: "_blank";
  websiteRel: string;
  websiteTabIndex: number;
  phone: string;
  telHref: string;
  address: string;
  addressNote: string;
  pin: { lat: number; lng: number } | null;
  comparePin: { lat: number; lng: number } | null;
  showMap: boolean;
};

export type SharedListingFormProps = {
  title: string;
  value: ListingFormValues;
  onChange: (value: ListingFormValues) => void;
  highlight?: FormHighlight;
  helpTypes?: { id: string; label: string }[];
  communityGroups?: { id: string; label: string }[];
  matches?: NameMatch[];
  geoResults?: GeoResult[];
  saving?: boolean;
  error?: string;
  showArchive?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onCheckName?: () => void;
  onLookupAddress?: () => void;
  onApplyGeo?: (result: GeoResult) => void;
  onPinMove?: (pin: { lat: number; lng: number }) => void;
  onOpenExisting?: (id: string) => void;
  onCreateAnyway?: () => void;
  onArchive?: () => void;
};

export type StatusBandProps = {
  model: StatusBandModel;
  onReview?: () => void;
  onPublish?: () => void;
  onUndoPublish?: () => void;
  publishing?: boolean;
  undoing?: boolean;
};

export type VerificationBarProps = {
  model: VerificationBarModel;
};

export type DirectoryTabsProps = {
  tabs: DirectoryTab[];
  active: DirectoryTabId;
  onChange: (id: DirectoryTabId) => void;
  children?: ReactNode;
};
