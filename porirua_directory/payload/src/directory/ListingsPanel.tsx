"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { directoryEditorFetch } from "../../../editor-core/client.mjs";
import { communityGroupOptions, helpTypeOptions } from "../../../editor-core/fields.mjs";
import {
  LISTINGS_COPY,
  archiveDialogModel,
  createListingBody,
  emptyListingForm,
  existingListingId,
  listingFormFromOrganization,
  listingFormFromServiceLine,
  listingFormHighlight,
  listingFormTitle,
  listingVerificationSource,
  nameMatchesPath,
  updateListingBody,
  visibleListings,
} from "../../../editor-core/listings-view.mjs";
import { actionSuccessMessage } from "../../../editor-core/queue-dto.mjs";
import { verificationBarModel } from "../../../editor-core/verification-bar.mjs";
import { SharedListingForm } from "./SharedListingForm";
import { VerificationBar } from "./VerificationBar";
import type { GeoResult, ListingFormValues, NameMatch } from "./types";

const CLIENT_BASE = "/api/directory-editor";

type ListingRow = {
  id: string;
  name: string;
  address?: string;
  status?: string;
  statusLabel?: string;
};

type ServiceLine = {
  id: string;
  title?: string;
  service_name?: string;
  name?: string;
  address?: string;
  status?: string;
  statusLabel?: string;
  youSetThis?: Array<{ field: string; label: string; mark: string }>;
  [key: string]: unknown;
};

type ListingDetail = {
  organization: {
    id: string;
    name: string;
    status?: string;
    statusLabel?: string;
    youSetThis?: Array<{ field: string; label: string; mark: string }>;
    [key: string]: unknown;
  };
  services: ServiceLine[];
};

type FormKind = "organization" | "serviceLine" | "edit";

function fetchMatches(error: unknown): NameMatch[] {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { matches?: NameMatch[] } }).data;
    return Array.isArray(data?.matches) ? data.matches : [];
  }
  return [];
}

function ArchiveDialog({
  open,
  onlyPublicLine,
  onCancel,
  onArchiveLine,
  onArchiveOrg,
}: {
  open: boolean;
  onlyPublicLine: boolean;
  onCancel: () => void;
  onArchiveLine: () => void;
  onArchiveOrg: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>("button, [href], input, textarea, [tabindex]:not([tabindex='-1'])"),
      ].filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
        <h2 id="archive-title" ref={titleRef} tabIndex={-1}>
          {LISTINGS_COPY.archiveTitle}
        </h2>
        <p>{LISTINGS_COPY.archiveBody}</p>
        {onlyPublicLine ? <p>{LISTINGS_COPY.archiveOnlyPublic}</p> : null}
        <div className="actions">
          <button type="button" onClick={onArchiveLine}>
            {LISTINGS_COPY.takeService}
          </button>
          {onlyPublicLine ? (
            <button type="button" onClick={onArchiveOrg}>
              {LISTINGS_COPY.takeOrg}
            </button>
          ) : null}
          <button type="button" onClick={onCancel}>
            {LISTINGS_COPY.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ListingsPanel({
  onCatalogChanged,
  openOrganizationId,
  onOpened,
}: {
  onCatalogChanged?: () => void;
  openOrganizationId?: string | null;
  onOpened?: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState("");
  const [showNotOnSite, setShowNotOnSite] = useState(false);
  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<FormKind>("organization");
  const [form, setForm] = useState<ListingFormValues>(emptyListingForm());
  const [highlight, setHighlight] = useState(listingFormHighlight());
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [confirmAnyway, setConfirmAnyway] = useState(false);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveServiceId, setArchiveServiceId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const helpTypes = useMemo(() => helpTypeOptions(), []);
  const communityGroups = useMemo(() => communityGroupOptions(), []);
  const shown = useMemo(
    () => visibleListings(listings, { query, showNotOnSite }),
    [listings, query, showNotOnSite]
  );
  const archiveModel = useMemo(() => archiveDialogModel(detail?.services || []), [detail]);
  const verify = useMemo(() => {
    const source = listingVerificationSource(detail);
    return verificationBarModel({
      listingUrl: source.listingUrl,
      phone: source.phone,
      address: source.address,
      pin: source.pin,
      showMap: Boolean(source.pin),
    });
  }, [detail]);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 20000);
  }

  async function refreshListings() {
    setListLoading(true);
    try {
      const data = await directoryEditorFetch("/listings", { base: CLIENT_BASE });
      setListings(Array.isArray(data?.listings) ? data.listings : []);
      setListError("");
    } catch (error) {
      setListError(error instanceof Error ? error.message : LISTINGS_COPY.loadError);
    } finally {
      setListLoading(false);
    }
  }

  async function openDetail(id: string, name = "") {
    if (!id) return;
    setFormOpen(false);
    setDetailError("");
    setDetailLoading(true);
    setPendingName(name);
    try {
      const data = await directoryEditorFetch(`/listings/${encodeURIComponent(id)}`, { base: CLIENT_BASE });
      setDetail(data);
      setDetailError("");
    } catch (error) {
      setDetail(null);
      setDetailError(error instanceof Error ? error.message : LISTINGS_COPY.openError);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    refreshListings();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!detail && !formOpen) searchRef.current?.focus();
  }, [detail, formOpen]);

  useEffect(() => {
    if (!openOrganizationId) return;
    void openDetail(openOrganizationId);
    onOpened?.();
  }, [openOrganizationId]);

  function startCreate(kind: "organization" | "serviceLine") {
    setFormKind(kind);
    setForm(emptyListingForm());
    setHighlight(listingFormHighlight());
    setMatches([]);
    setConfirmAnyway(false);
    setGeoResults([]);
    setEditingServiceId(null);
    setFormError("");
    setFormOpen(true);
  }

  function editOrganisation() {
    if (!detail) return;
    const org = detail.organization;
    setFormKind("edit");
    setEditingServiceId(null);
    setForm(listingFormFromOrganization(org));
    setHighlight(listingFormHighlight(org.youSetThis));
    setMatches([]);
    setConfirmAnyway(false);
    setGeoResults([]);
    setFormError("");
    setFormOpen(true);
  }

  function editLine(line: ServiceLine) {
    if (!detail) return;
    const org = detail.organization;
    setFormKind("edit");
    setEditingServiceId(line.id);
    setForm(listingFormFromServiceLine(line, org));
    setHighlight(listingFormHighlight([...(line.youSetThis || []), ...(org.youSetThis || [])]));
    setMatches([]);
    setConfirmAnyway(false);
    setGeoResults([]);
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormError("");
    setMatches([]);
    setGeoResults([]);
  }

  function closeDetail() {
    setDetail(null);
    setDetailError("");
    setFormOpen(false);
    setPendingName("");
  }

  async function checkName() {
    if (!form.name || formKind === "edit") return;
    try {
      const data = await directoryEditorFetch(
        nameMatchesPath(form.name, { formKind, organizationId: detail?.organization.id }),
        { base: CLIENT_BASE }
      );
      const next = Array.isArray(data?.matches) ? data.matches : [];
      setMatches(next);
      setConfirmAnyway(next.length === 0);
    } catch {
      setMatches([]);
    }
  }

  async function lookupAddress() {
    if (!form.address) return;
    try {
      const data = await directoryEditorFetch(`/geocode?q=${encodeURIComponent(form.address)}`, {
        base: CLIENT_BASE,
      });
      setGeoResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setGeoResults([]);
    }
  }

  function applyGeo(result: GeoResult) {
    setForm({ ...form, address: result.label, lat: result.lat, lng: result.lng });
    setGeoResults([]);
  }

  async function saveForm() {
    setSaving(true);
    setFormError("");
    try {
      let organizationId = detail?.organization.id;
      if (formKind === "organization") {
        const created = await directoryEditorFetch("/listings", {
          method: "POST",
          base: CLIENT_BASE,
          body: createListingBody(form, { confirmCreateAnyway: confirmAnyway || matches.length === 0 }),
        });
        organizationId = created?.organizationId;
      } else if (formKind === "serviceLine") {
        if (!detail) throw new Error("organisation is required");
        await directoryEditorFetch("/listings", {
          method: "POST",
          base: CLIENT_BASE,
          body: createListingBody(form, {
            kind: "serviceLine",
            organizationId: detail.organization.id,
            confirmCreateAnyway: confirmAnyway || matches.length === 0,
          }),
        });
      } else if (detail) {
        await directoryEditorFetch("/listings/update", {
          method: "POST",
          base: CLIENT_BASE,
          body: updateListingBody(form, {
            organizationId: detail.organization.id,
            serviceId: editingServiceId,
          }),
        });
      }
      setFormOpen(false);
      showToast(actionSuccessMessage({ action: "save", name: form.name }));
      await refreshListings();
      onCatalogChanged?.();
      if (organizationId) await openDetail(organizationId, form.name);
    } catch (error) {
      const conflict = error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 409;
      if (conflict) {
        setMatches(fetchMatches(error));
        setFormError(LISTINGS_COPY.nameConflict);
      } else {
        setFormError(error instanceof Error ? error.message : "Could not save");
      }
    } finally {
      setSaving(false);
    }
  }

  function askArchive(line?: ServiceLine) {
    const service = line || detail?.services.find((row) => row.id === editingServiceId);
    setArchiveServiceId(service?.id || editingServiceId);
    setArchiveOpen(true);
  }

  async function confirmArchive(alsoArchiveOrganization: boolean) {
    if (!archiveServiceId) return;
    setArchiveOpen(false);
    const archived = detail?.services.find((row) => row.id === archiveServiceId);
    try {
      await directoryEditorFetch("/listings/archive", {
        method: "POST",
        base: CLIENT_BASE,
        body: { serviceId: archiveServiceId, alsoArchiveOrganization },
      });
      setFormOpen(false);
      showToast(
        actionSuccessMessage({
          action: "archive",
          name: archived?.title || archived?.name || detail?.organization.name,
        })
      );
      await refreshListings();
      onCatalogChanged?.();
      if (detail) await openDetail(detail.organization.id, detail.organization.name);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not archive");
    }
  }

  async function restoreLine(line: ServiceLine) {
    try {
      await directoryEditorFetch("/listings/restore", {
        method: "POST",
        base: CLIENT_BASE,
        body: { serviceId: line.id },
      });
      showToast(actionSuccessMessage({ action: "restore", name: line.title || line.name }));
      await refreshListings();
      onCatalogChanged?.();
      if (detail) await openDetail(detail.organization.id, detail.organization.name);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Could not restore");
    }
  }

  const searchView = !detail && !formOpen && !detailLoading && !detailError;

  return (
    <div className="listings-panel">
      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}

      {searchView ? (
        <div>
          <label className="search">
            {LISTINGS_COPY.find}
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Porirua Whānau Centre"
              autoComplete="off"
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showNotOnSite}
              onChange={(event) => setShowNotOnSite(event.target.checked)}
            />
            {LISTINGS_COPY.showNotOnSite}
          </label>
          <div className="toolbar">
            <button type="button" onClick={() => startCreate("organization")}>
              {LISTINGS_COPY.addOrganisation}
            </button>
          </div>
          {listError ? (
            <p className="error">
              {LISTINGS_COPY.loadError}{" "}
              <button type="button" onClick={refreshListings}>
                {LISTINGS_COPY.tryAgain}
              </button>
            </p>
          ) : null}
          {listLoading ? <p className="directory-hint">{LISTINGS_COPY.loading}</p> : null}
          <ul className="results">
            {shown.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={row.status !== "published" ? "result not-on-site" : "result"}
                  onClick={() => openDetail(row.id, row.name)}
                >
                  <strong>{row.name}</strong>
                  <span>{row.address}</span>
                  <span className={row.status !== "published" ? "status status-off" : "status"}>
                    {row.statusLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!shown.length && !listLoading ? <p className="directory-hint">{LISTINGS_COPY.noMatches}</p> : null}
        </div>
      ) : null}

      {detailLoading && !formOpen ? (
        <div>
          <button type="button" className="back" onClick={closeDetail}>
            {LISTINGS_COPY.back}
          </button>
          <h2>{pendingName || "Organisation"}</h2>
          <p className="directory-hint">{LISTINGS_COPY.loading}</p>
          <div className="skeleton-lines" aria-hidden="true">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </div>
      ) : null}

      {detailError && !formOpen ? (
        <div>
          <p className="error">{LISTINGS_COPY.openError}</p>
          <button type="button" onClick={closeDetail}>
            {LISTINGS_COPY.back}
          </button>
        </div>
      ) : null}

      {detail && !formOpen && !detailLoading ? (
        <div>
          <button type="button" className="back" onClick={closeDetail}>
            {LISTINGS_COPY.back}
          </button>
          <h2>{detail.organization.name}</h2>
          <p className={detail.organization.status !== "published" ? "status status-off" : "status"}>
            {detail.organization.statusLabel}
          </p>
          <VerificationBar model={verify} />
          <ul className="lines">
            {detail.services.map((line) => (
              <li key={line.id} className={line.status !== "published" ? "not-on-site" : undefined}>
                <strong className="line-title">{line.title || line.service_name}</strong>
                <span>{line.address}</span>
                <span className={line.status !== "published" ? "status status-off" : "status"}>
                  {line.statusLabel}
                </span>
                <div className="actions">
                  <button type="button" onClick={() => editLine(line)}>
                    {LISTINGS_COPY.edit}
                  </button>
                  {line.status === "published" ? (
                    <button type="button" onClick={() => askArchive(line)}>
                      {LISTINGS_COPY.archive}
                    </button>
                  ) : (
                    <button type="button" onClick={() => restoreLine(line)}>
                      {LISTINGS_COPY.restore}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="toolbar">
            <button type="button" onClick={() => startCreate("serviceLine")}>
              {LISTINGS_COPY.addServiceLine}
            </button>
            <button type="button" onClick={editOrganisation}>
              {LISTINGS_COPY.editOrganisation}
            </button>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <SharedListingForm
          title={listingFormTitle(formKind)}
          value={form}
          onChange={setForm}
          highlight={highlight}
          helpTypes={helpTypes}
          communityGroups={communityGroups}
          matches={matches}
          geoResults={geoResults}
          saving={saving}
          error={formError}
          showArchive={formKind === "edit" && Boolean(editingServiceId)}
          onSave={saveForm}
          onCancel={closeForm}
          onCheckName={checkName}
          onLookupAddress={lookupAddress}
          onApplyGeo={applyGeo}
          onPinMove={(pin) => setForm({ ...form, lat: pin.lat, lng: pin.lng })}
          onOpenExisting={(id) => {
            const match = matches.find((row) => row.id === id);
            openDetail(existingListingId(match || { id }), match?.name);
          }}
          onCreateAnyway={() => setConfirmAnyway(true)}
          onArchive={() => askArchive()}
        />
      ) : null}

      <ArchiveDialog
        open={archiveOpen}
        onlyPublicLine={archiveModel.onlyPublicLine}
        onCancel={() => setArchiveOpen(false)}
        onArchiveLine={() => confirmArchive(false)}
        onArchiveOrg={() => confirmArchive(true)}
      />
    </div>
  );
}
