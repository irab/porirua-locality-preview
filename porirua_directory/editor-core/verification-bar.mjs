export function verificationBarModel({
  website,
  governmentUrl,
  listingUrl,
  phone,
  address,
  addressNote,
  pin,
  comparePin,
  showMap = false,
} = {}) {
  const websiteHref = String(governmentUrl || listingUrl || website || "").trim();
  const number = String(phone || "").trim();
  const place = String(address || "").trim();
  const note = String(addressNote || "").trim();
  return {
    websiteHref,
    websiteHidden: !websiteHref,
    websiteTarget: "_blank",
    websiteRel: "noopener noreferrer",
    websiteTabIndex: websiteHref ? 0 : -1,
    phone: number,
    telHref: number ? `tel:${number}` : "",
    address: place,
    addressNote: note,
    pin: pin || null,
    comparePin: comparePin || null,
    showMap: Boolean(showMap && (pin || comparePin)),
  };
}
