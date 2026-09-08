"use client";

import { useEffect, useRef } from "react";
import type { SharedListingFormProps } from "./types";

function emptyHighlight() {
  return { changed: [], youSetThis: [], focusField: null, focusOption: null };
}

export function SharedListingForm({
  title,
  value,
  onChange,
  highlight,
  helpTypes = [],
  communityGroups = [],
  matches = [],
  geoResults = [],
  saving = false,
  error = "",
  showArchive = false,
  onSave,
  onCancel,
  onCheckName,
  onLookupAddress,
  onApplyGeo,
  onOpenExisting,
  onCreateAnyway,
  onArchive,
}: SharedListingFormProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const marks = highlight || emptyHighlight();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const field = marks.focusField;
    const option = marks.focusOption;
    const optionTarget =
      field && option ? root.querySelector<HTMLElement>(`[data-field="${field}"] [data-option="${option}"] input`) : null;
    const fieldTarget = field
      ? root.querySelector<HTMLElement>(`[data-field="${field}"] input, [data-field="${field}"] textarea`)
      : null;
    const target = optionTarget || fieldTarget;
    target?.focus?.();
    target?.scrollIntoView?.({ block: "center" });
  }, [marks.focusField, marks.focusOption]);

  function changedRow(field: string) {
    return marks.changed.find((row) => row.field === field) || null;
  }

  function fieldMark(field: string) {
    const row = changedRow(field);
    if (!row) return "";
    if (row.added?.length || row.removed?.length) return "";
    return row.mark;
  }

  function optionMark(field: string, id: string) {
    const row = changedRow(field);
    const key = String(id);
    if ((row?.added || []).some((item) => String(item) === key)) return "Added in this update";
    if ((row?.removed || []).some((item) => String(item) === key)) return "Removed in this update";
    return "";
  }

  function youSet(field: string) {
    return marks.youSetThis.some(
      (row) => row.field === field || (row.label === "Map pin" && field === "address")
    );
  }

  function toggleList(field: "categories" | "communityFilters", id: string, checked: boolean) {
    const current = value[field] || [];
    const next = checked ? [...current, id] : current.filter((item) => item !== id);
    onChange({ ...value, [field]: next });
  }

  return (
    <div className="listing-form" ref={rootRef}>
      <h2>{title}</h2>
      <label className={fieldMark("name") || youSet("name") ? "marked" : undefined} data-field="name">
        Name
        {fieldMark("name") ? <span className="mark">{fieldMark("name")}</span> : null}
        {youSet("name") ? <span className="mark">You set this earlier</span> : null}
        <input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          onBlur={onCheckName}
        />
      </label>
      {matches.length ? (
        <div className="matches">
          <p>An organisation with a similar name is already in the directory.</p>
          <ul>
            {matches.map((match) => (
              <li key={match.id} className={match.status && match.status !== "published" ? "not-on-site" : undefined}>
                <strong>{match.name}</strong>
                <span>
                  {match.address} {match.phone}
                </span>
                {match.statusLabel ? <span>{match.statusLabel}</span> : null}
                <button type="button" onClick={() => onOpenExisting?.(match.id)}>
                  Open the existing one
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onCreateAnyway}>
            Create anyway
          </button>
        </div>
      ) : null}
      <label
        className={fieldMark("description") || youSet("description") ? "marked" : undefined}
        data-field="description"
      >
        Description
        {fieldMark("description") ? <span className="mark">{fieldMark("description")}</span> : null}
        {youSet("description") ? <span className="mark">You set this earlier</span> : null}
        <textarea
          rows={4}
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </label>
      <label className={fieldMark("address") || youSet("address") ? "marked" : undefined} data-field="address">
        Address
        {fieldMark("address") ? <span className="mark">{fieldMark("address")}</span> : null}
        {youSet("address") || youSet("lat") ? <span className="mark">You set this earlier</span> : null}
        <input
          value={value.address}
          onChange={(event) => onChange({ ...value, address: event.target.value })}
          onBlur={onLookupAddress}
        />
      </label>
      {geoResults.length ? (
        <ul className="matches">
          {geoResults.map((result) => (
            <li key={result.label}>
              <button type="button" onClick={() => onApplyGeo?.(result)}>
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value.lat != null && value.lng != null ? (
        <div className="form-map" aria-label="Map pin is set">
          Pin is set. Search an address to move it.
        </div>
      ) : null}
      <p className="directory-hint">
        Search an address to set the pin, or type one and save without a pin. There is no map to drag.
      </p>
      <label className={fieldMark("phone") || youSet("phone") ? "marked" : undefined} data-field="phone">
        Phone
        {fieldMark("phone") ? <span className="mark">{fieldMark("phone")}</span> : null}
        {youSet("phone") ? <span className="mark">You set this earlier</span> : null}
        <input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} />
      </label>
      <label className={fieldMark("url") || youSet("url") ? "marked" : undefined} data-field="url">
        Website
        {fieldMark("url") ? <span className="mark">{fieldMark("url")}</span> : null}
        {youSet("url") ? <span className="mark">You set this earlier</span> : null}
        <input value={value.url} onChange={(event) => onChange({ ...value, url: event.target.value })} />
      </label>
      <fieldset data-field="categories">
        <legend>
          Help types
          {youSet("categories") ? <span className="mark">You set this earlier</span> : null}
        </legend>
        {helpTypes.map((option) => (
          <label
            key={option.id}
            className={optionMark("categories", option.id) ? "check marked" : "check"}
            data-option={option.id}
          >
            <input
              type="checkbox"
              checked={(value.categories || []).includes(option.id)}
              onChange={(event) => toggleList("categories", option.id, event.target.checked)}
            />
            {option.label}
            {optionMark("categories", option.id) ? (
              <span className="mark">{optionMark("categories", option.id)}</span>
            ) : null}
          </label>
        ))}
      </fieldset>
      <fieldset data-field="communityFilters">
        <legend>
          Community groups
          {youSet("communityFilters") ? <span className="mark">You set this earlier</span> : null}
        </legend>
        {communityGroups.map((option) => (
          <label
            key={option.id}
            className={optionMark("communityFilters", option.id) ? "check marked" : "check"}
            data-option={option.id}
          >
            <input
              type="checkbox"
              checked={(value.communityFilters || []).includes(option.id)}
              onChange={(event) => toggleList("communityFilters", option.id, event.target.checked)}
            />
            {option.label}
            {optionMark("communityFilters", option.id) ? (
              <span className="mark">{optionMark("communityFilters", option.id)}</span>
            ) : null}
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <button type="button" disabled={saving} onClick={onSave}>
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {showArchive ? (
          <button type="button" onClick={onArchive}>
            Archive this service line
          </button>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
