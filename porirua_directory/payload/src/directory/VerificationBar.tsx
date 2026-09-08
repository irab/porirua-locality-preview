"use client";

import { useState } from "react";
import { PinMap } from "./PinMap";
import type { VerificationBarProps } from "./types";

export function VerificationBar({ model }: VerificationBarProps) {
  const [tilesFailed, setTilesFailed] = useState(false);

  return (
    <div className="directory-verify">
      {model.websiteHidden ? null : (
        <a
          className="directory-verify-link"
          href={model.websiteHref}
          target={model.websiteTarget}
          rel={model.websiteRel}
          tabIndex={model.websiteTabIndex}
        >
          Website
        </a>
      )}
      {model.phone ? (
        <a className="directory-verify-link" href={model.telHref}>
          {model.phone}
        </a>
      ) : null}
      {model.address ? (
        <p className="directory-verify-address">
          {model.addressNote ? <span className="directory-verify-note">{model.addressNote}</span> : null}
          {model.address}
        </p>
      ) : null}
      {model.showMap && (model.pin || model.comparePin) && !tilesFailed ? (
        <PinMap pin={model.pin} comparePin={model.comparePin} onTilesFailed={() => setTilesFailed(true)} />
      ) : null}
    </div>
  );
}
