"use client";

import type { VerificationBarProps } from "./types";

export function VerificationBar({ model }: VerificationBarProps) {
  return (
    <div className="verify">
      {model.websiteHidden ? null : (
        <a
          className="verify-link"
          href={model.websiteHref}
          target={model.websiteTarget}
          rel={model.websiteRel}
          tabIndex={model.websiteTabIndex}
        >
          Website
        </a>
      )}
      {model.phone ? (
        <a className="verify-link" href={model.telHref}>
          {model.phone}
        </a>
      ) : null}
      {model.address ? (
        <p className="verify-address">
          {model.addressNote ? <span className="verify-note">{model.addressNote}</span> : null}
          {model.address}
        </p>
      ) : null}
      {model.showMap && model.pin ? (
        <div className="verify-map" data-lat={model.pin.lat} data-lng={model.pin.lng}>
          Map pin
        </div>
      ) : null}
    </div>
  );
}
