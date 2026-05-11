const LUCENT_SCRAPE_LOG_PREFIX = "[Lucent]";
const LUCENT_SIDEBAR_ID = "lucent-sidebar";
const LUCENT_LAUNCHER_ID = "lucent-launcher";

function safeInnerText(element) {
  return element?.innerText?.trim() || "";
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortenText(value, maxChars = 160) {
  const text = compactText(value);
  if (!text) {
    return "";
  }

  const firstSentenceMatch = text.match(/^(.+?[.!?])(\s|$)/);
  const candidate = firstSentenceMatch ? firstSentenceMatch[1] : text;
  if (candidate.length <= maxChars) {
    return candidate;
  }

  return `${candidate.slice(0, maxChars - 1).trim()}…`;
}

function getLocationCheckTone(check) {
  if (check?.accurate === true) {
    return "green";
  }

  if (check?.accurate === false) {
    if (check?.severity === "high") {
      return "red";
    }

    if (check?.severity === "medium") {
      return "orange";
    }

    return "amber";
  }

  return "amber";
}

function getPointNoteTone(flag) {
  const phrase = compactText(flag?.phrase || "").toLowerCase();
  const severity = flag?.severity || "low";

  const negativeMarkers = [
    "risk",
    "at own risk",
    "unsafe",
    "shared with other guests",
    "shared bathroom",
    "no parking",
    "street noise",
    "construction",
    "rough area",
    "limited",
    "steep stairs"
  ];

  const positiveMarkers = [
    "bright",
    "modern",
    "sunlight",
    "natural light",
    "beautiful",
    "renovated",
    "brand-new",
    "comfortable",
    "free street parking",
    "parking nearby",
    "walk to",
    "walking distance",
    "parks",
    "cafes",
    "restaurants",
    "peaceful retreat",
    "private room",
    "river views",
    "spacious"
  ];

  if (negativeMarkers.some((marker) => phrase.includes(marker))) {
    return severity === "high" ? "negative-strong" : "negative";
  }

  if (positiveMarkers.some((marker) => phrase.includes(marker))) {
    return "positive";
  }

  if (severity === "high") {
    return "negative-strong";
  }

  if (severity === "medium") {
    return "negative";
  }

  return "neutral";
}

function normalizePrice(text) {
  if (!text) {
    return null;
  }

  const match = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function extractNightlyPriceFromText(text) {
  if (!text) {
    return null;
  }

  const normalized = text.replace(/,/g, "").replace(/\s+/g, " ").trim();
  const patterns = [
    /\$\s*(\d+(?:\.\d+)?)\s*(?:\/\s*night|per\s+night|\bnight\b)/i,
    /(?:\/\s*night|per\s+night|\bnight\b)[^\d$]{0,20}\$\s*(\d+(?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function normalizeRating(text) {
  if (!text) {
    return null;
  }

  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function normalizeReviewCount(text) {
  if (!text) {
    return null;
  }

  const match = text.replace(/,/g, "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function extractTextFromCandidates(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = compactText(safeInnerText(element));
    if (value) {
      return value;
    }
  }

  return "";
}

function uniqueStrings(values) {
  return values.filter((value, index, list) => value && list.indexOf(value) === index);
}

function flattenStructuredData(node) {
  if (!node) {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((item) => flattenStructuredData(item));
  }

  if (typeof node !== "object") {
    return [];
  }

  const flattened = [node];

  if (node["@graph"]) {
    flattened.push(...flattenStructuredData(node["@graph"]));
  }

  if (node.mainEntity) {
    flattened.push(...flattenStructuredData(node.mainEntity));
  }

  if (node.itemListElement) {
    flattened.push(...flattenStructuredData(node.itemListElement));
  }

  return flattened;
}

function getStructuredListingData() {
  const objects = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .flatMap((script) => {
      try {
        return flattenStructuredData(JSON.parse(script.textContent || ""));
      } catch (error) {
        return [];
      }
    })
    .filter((item) => item && typeof item === "object");

  let bestCandidate = null;
  let bestScore = -1;

  for (const candidate of objects) {
    let score = 0;

    if (candidate.description) {
      score += 3;
    }

    if (candidate.address) {
      score += 3;
    }

    if (candidate.aggregateRating) {
      score += 2;
    }

    if (candidate.amenityFeature || candidate.amenities) {
      score += 2;
    }

    if (candidate.offers) {
      score += 1;
    }

    if (candidate.name) {
      score += 1;
    }

    if (score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
  }

  return bestCandidate;
}

function formatAddress(address) {
  if (!address) {
    return "";
  }

  if (typeof address === "string") {
    return compactText(address);
  }

  const parts = [
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode,
    address.addressCountry
  ];

  return uniqueStrings(parts.map((part) => compactText(part)).filter(Boolean)).join(", ");
}

function findSectionByHeading(headingPhrases) {
  const headings = Array.from(document.querySelectorAll("h2, h3, [role='heading']"));

  for (const heading of headings) {
    const headingText = safeInnerText(heading).toLowerCase();
    if (!headingText) {
      continue;
    }

    const matched = headingPhrases.some((phrase) => headingText.includes(phrase));
    if (!matched) {
      continue;
    }

    const section = heading.closest("section, article, [data-section-id], [data-plugin-in-point-id]");
    if (section) {
      return section;
    }

    if (heading.parentElement) {
      return heading.parentElement;
    }
  }

  return null;
}

function extractSectionText(section, omittedPhrases = []) {
  if (!section) {
    return "";
  }

  const clone = section.cloneNode(true);
  Array.from(clone.querySelectorAll("button, svg, style, script")).forEach((element) => {
    element.remove();
  });

  let text = compactText(safeInnerText(clone));
  for (const phrase of omittedPhrases) {
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escapedPhrase, "ig"), " ");
    text = compactText(text);
  }

  return text;
}

function cleanLocationText(text) {
  let cleaned = compactText(text);
  if (!cleaned) {
    return "";
  }

  const boilerplatePatterns = [
    /where you['’]ll be/ig,
    /this listing['’]s location is verified and the exact location will be provided after booking\.?/ig,
    /learn about verification\.?/ig
  ];

  for (const pattern of boilerplatePatterns) {
    cleaned = cleaned.replace(pattern, " ");
    cleaned = compactText(cleaned);
  }

  return cleaned;
}

function isAmenityNoise(text) {
  const normalized = text.toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    [
      "what this place offers",
      "what this place has to offer",
      "amenities",
      "show all amenities",
      "show all",
      "show more",
      "show less"
    ].includes(normalized) ||
    /^show all \d+ amenities$/.test(normalized)
  );
}

function isReviewSnippetUseful(text) {
  if (!text || text.length < 40) {
    return false;
  }

  const normalized = text.toLowerCase();
  const blockedPhrases = [
    "this home is a guest favorite based on ratings, reviews, and reliability",
    "guest favorite",
    "show all reviews",
    "show more",
    "show less",
    "reviews"
  ];

  return !blockedPhrases.some((phrase) => normalized.includes(phrase));
}

function extractStructuredAmenities(structuredData) {
  const amenitySource = structuredData?.amenityFeature || structuredData?.amenities;

  if (!amenitySource) {
    return [];
  }

  if (typeof amenitySource === "string") {
    return uniqueStrings(
      amenitySource
        .split(/,|\n/)
        .map((item) => compactText(item))
        .filter(Boolean)
    );
  }

  if (!Array.isArray(amenitySource)) {
    return [];
  }

  return uniqueStrings(
    amenitySource
      .map((item) => {
        if (typeof item === "string") {
          return compactText(item);
        }

        return compactText(item?.name || item?.value || item?.description || "");
      })
      .filter(Boolean)
  );
}

function extractAmenitiesFromDescription(description) {
  const normalized = compactText(description);
  if (!normalized) {
    return [];
  }

  const match = normalized.match(
    /(?:amenities|live in comfort with the following amenities)\s*:\s*(.+?)(?:note:|$)/i
  );

  if (!match) {
    const extracted = [];

    if (/\bfree street parking\b/i.test(normalized)) {
      extracted.push("Free street parking");
    } else if (/\bstreet parking\b/i.test(normalized)) {
      extracted.push("Street parking");
    } else if (/\bfree parking\b/i.test(normalized)) {
      extracted.push("Free parking");
    }

    if (/\bwasher\b/i.test(normalized)) {
      extracted.push("Washer");
    }

    if (/\bdryer\b/i.test(normalized)) {
      extracted.push("Dryer");
    }

    if (/\bair conditioning\b|\bac\b/i.test(normalized)) {
      extracted.push("Air conditioning");
    }

    if (/\bkitchen\b/i.test(normalized)) {
      extracted.push("Kitchen");
    }

    if (/\bwi[- ]?fi\b/i.test(normalized)) {
      extracted.push("Wi-Fi");
    }

    return extracted
      .filter((text, index, list) => list.indexOf(text) === index)
      .slice(0, 20);
  }

  return uniqueStrings(
    match[1]
      .split(/\s*[-•]\s*/)
      .map((item) => compactText(item))
      .filter((item) => item && item.length > 2)
      .slice(0, 20)
  );
}

function extractPrice() {
  const candidates = [
    '[data-testid="book-it-default"]',
    '[data-section-id="BOOK_IT_SIDEBAR"]',
    '[data-testid*="price"]',
    '[aria-label*="per night"]',
    '[aria-label*="/ night"]',
    '[aria-label*=" night"]',
    '[aria-label*="$"]'
  ];

  for (const selector of candidates) {
    const root = document.querySelector(selector);
    if (!root) {
      continue;
    }

    const ariaPrice = extractNightlyPriceFromText(root.getAttribute("aria-label") || "");
    if (ariaPrice !== null) {
      return ariaPrice;
    }

    const nestedAriaPrice = Array.from(root.querySelectorAll("[aria-label]"))
      .map((element) => extractNightlyPriceFromText(element.getAttribute("aria-label") || ""))
      .find((value) => value !== null);

    if (nestedAriaPrice !== undefined) {
      return nestedAriaPrice;
    }

    const text = safeInnerText(root);
    const price = extractNightlyPriceFromText(text);
    if (price !== null) {
      return price;
    }
  }

  const bodyNightlyPrice = extractNightlyPriceFromText(document.body.innerText);
  return bodyNightlyPrice;
}

function extractLocation(structuredData) {
  const structuredLocation = formatAddress(structuredData?.address);
  if (structuredLocation) {
    return cleanLocationText(structuredLocation);
  }

  const candidates = [
    '[data-testid="subtitle"]',
    '[data-section-id="LOCATION_DEFAULT"]',
    '[data-section-id*="LOCATION"]',
    '[data-plugin-in-point-id*="LOCATION"]',
    'main section div[role="button"] span',
    'main section h2 + div'
  ];

  const directLocation = extractTextFromCandidates(candidates);
  if (directLocation) {
    return cleanLocationText(directLocation);
  }

  const locationSection = findSectionByHeading(["where you'll be", "where you’ll be", "location"]);
  const sectionText = extractSectionText(locationSection, ["Where you'll be", "Where you’ll be", "Location"]);
  if (sectionText) {
    return cleanLocationText(sectionText);
  }

  return cleanLocationText(structuredLocation);
}

function extractDescription(structuredData) {
  const candidates = [
    '[data-section-id="DESCRIPTION_DEFAULT"]',
    '[data-section-id*="DESCRIPTION"]',
    '[data-testid="listing-description"]',
    '[data-plugin-in-point-id="DESCRIPTION_DEFAULT"]'
  ];

  const description = extractTextFromCandidates(candidates);
  if (description) {
    return description;
  }

  const descriptionSection = findSectionByHeading(["about this space", "about this place", "description"]);
  const sectionDescription = extractSectionText(descriptionSection, [
    "About this space",
    "About this place",
    "Description",
    "Show more",
    "Show less"
  ]);

  if (sectionDescription) {
    return sectionDescription;
  }

  const showMoreButton = Array.from(document.querySelectorAll("button")).find(
    (button) => safeInnerText(button).toLowerCase().includes("show more")
  );

  const expandedDescription = extractSectionText(showMoreButton?.closest("section"), ["Show more", "Show less"]);
  if (expandedDescription) {
    return expandedDescription;
  }

  return compactText(structuredData?.description || "");
}

function extractAmenities(structuredData, description = "") {
  const amenitySection =
    document.querySelector('[data-section-id="AMENITIES_DEFAULT"]') ||
    document.querySelector('[data-section-id*="AMENITIES"]') ||
    document.querySelector('[data-plugin-in-point-id*="AMENITIES"]') ||
    findSectionByHeading(["what this place offers", "what this place has to offer", "amenities"]);

  if (!amenitySection) {
    const structuredAmenities = extractStructuredAmenities(structuredData).slice(0, 30);
    if (structuredAmenities.length > 0) {
      return structuredAmenities;
    }

    return extractAmenitiesFromDescription(description).slice(0, 30);
  }

  const amenities = Array.from(amenitySection.querySelectorAll("li, h3, h4, span"))
    .map((node) => compactText(safeInnerText(node)))
    .filter((text) => !isAmenityNoise(text))
    .filter((text, index, list) => list.indexOf(text) === index)
    .slice(0, 30);

  if (amenities.length > 0) {
    return amenities;
  }

  const structuredAmenities = extractStructuredAmenities(structuredData).slice(0, 30);
  if (structuredAmenities.length > 0) {
    return structuredAmenities;
  }

  return extractAmenitiesFromDescription(description).slice(0, 30);
}

function extractRatingAndReviews(structuredData) {
  const aggregateRating = structuredData?.aggregateRating || {};
  const structuredRating = normalizeRating(String(aggregateRating.ratingValue || ""));
  const structuredReviewCount = normalizeReviewCount(String(aggregateRating.reviewCount || ""));

  if (structuredRating !== null || structuredReviewCount !== null) {
    return {
      rating: structuredRating,
      reviewCount: structuredReviewCount
    };
  }

  const ratingCandidate = Array.from(document.querySelectorAll('[aria-label*="rating"], [aria-label*="Review"], [aria-label*="review"]'))
    .map((element) => element.getAttribute("aria-label") || "")
    .find((label) => /\d/.test(label));

  const titleAreaText = safeInnerText(document.querySelector("main"));
  const fallbackRatingText = ratingCandidate || titleAreaText;

  return {
    rating: normalizeRating(fallbackRatingText),
    reviewCount: normalizeReviewCount(fallbackRatingText)
  };
}

function extractPhotos() {
  return Array.from(document.querySelectorAll("img"))
    .map((img) => img.getAttribute("src") || "")
    .filter((src) => {
      const normalized = src.toLowerCase();
      return (
        (normalized.includes("airbnb") || normalized.includes("muscache.com")) &&
        !normalized.includes("verifi.pdscrb.com") &&
        !normalized.includes("profile") &&
        !normalized.includes("avatar") &&
        !normalized.includes("icon") &&
        normalized.length > 50
      );
    })
    .filter((src, index, list) => src && list.indexOf(src) === index)
    .slice(0, 20);
}

function extractStructuredReviewSnippets() {
  const snippets = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .flatMap((script) => {
      try {
        return flattenStructuredData(JSON.parse(script.textContent || ""));
      } catch (error) {
        return [];
      }
    })
    .flatMap((item) => {
      const reviews = item?.review;
      if (!reviews) {
        return [];
      }
      const reviewList = Array.isArray(reviews) ? reviews : [reviews];
      return reviewList.map((review) => compactText(review?.reviewBody || review?.description || ""));
    })
    .filter((text) => text && text.length > 20);

  return uniqueStrings(snippets).slice(0, 6);
}

function extractReviewSnippets() {
  const structuredReviews = extractStructuredReviewSnippets();
  if (structuredReviews.length > 0) {
    return structuredReviews;
  }

  const reviewsSection = findSectionByHeading(["reviews", "review"]);
  if (!reviewsSection) {
    return [];
  }

  const snippets = Array.from(
    reviewsSection.querySelectorAll("[data-review-id], article, li, p, span")
  )
    .map((node) => compactText(safeInnerText(node)))
    .filter((text) => isReviewSnippetUseful(text));

  return uniqueStrings(snippets).slice(0, 6);
}

function scrapeListing() {
  const structuredData = getStructuredListingData();
  const title = safeInnerText(document.querySelector("h1"));
  const description = extractDescription(structuredData);
  const { rating, reviewCount } = extractRatingAndReviews(structuredData);
  const reviews = extractReviewSnippets();

  return {
    title,
    description,
    price: extractPrice(),
    location: extractLocation(structuredData),
    photos: extractPhotos(),
    amenities: extractAmenities(structuredData, description),
    rating,
    reviewCount,
    reviews
  };
}

function setSidebarOpen(isOpen) {
  const sidebar = document.getElementById(LUCENT_SIDEBAR_ID);
  const launcher = document.getElementById(LUCENT_LAUNCHER_ID);

  if (!sidebar || !launcher) {
    return;
  }

  sidebar.classList.toggle("lucent-open", isOpen);
  launcher.classList.toggle("lucent-hidden", isOpen);
  sidebar.setAttribute("aria-hidden", isOpen ? "false" : "true");
  launcher.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function ensureLauncher() {
  let launcher = document.getElementById(LUCENT_LAUNCHER_ID);
  if (launcher) {
    return launcher;
  }

  launcher = document.createElement("button");
  launcher.id = LUCENT_LAUNCHER_ID;
  launcher.type = "button";
  launcher.setAttribute("aria-controls", LUCENT_SIDEBAR_ID);
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML = `
    <span class="lucent-launcher-label">Lucent</span>
    <span class="lucent-launcher-subtitle">Open report</span>
  `;
  launcher.addEventListener("click", () => setSidebarOpen(true));
  document.body.appendChild(launcher);

  return launcher;
}

function ensureSidebar() {
  let sidebar = document.getElementById(LUCENT_SIDEBAR_ID);
  if (sidebar) {
    return sidebar;
  }

  ensureLauncher();

  sidebar = document.createElement("aside");
  sidebar.id = LUCENT_SIDEBAR_ID;
  sidebar.setAttribute("aria-hidden", "true");
  sidebar.innerHTML = `
    <div id="lucent-header">
      <div id="lucent-header-copy">
        <p id="lucent-eyebrow">Lucent</p>
        <h2 id="lucent-title">Listing Truth Report</h2>
      </div>
      <div id="lucent-header-actions">
        <button id="lucent-close-button" type="button" aria-label="Close Lucent sidebar">Close</button>
        <button id="lucent-scan-button" type="button">Scan Listing</button>
      </div>
    </div>
    <div id="lucent-content">
      <p class="lucent-status">Ready to scan this listing.</p>
    </div>
  `;

  document.body.appendChild(sidebar);

  const scanButton = document.getElementById("lucent-scan-button");
  scanButton?.addEventListener("click", handleScanClick);

  const closeButton = document.getElementById("lucent-close-button");
  closeButton?.addEventListener("click", () => setSidebarOpen(false));

  return sidebar;
}

function renderLoadingState() {
  const content = document.getElementById("lucent-content");
  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="lucent-card">
      <p class="lucent-status">Scanning listing with language, location, and photo analysis...</p>
    </div>
  `;
}

function renderErrorState(message) {
  const content = document.getElementById("lucent-content");
  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="lucent-card lucent-card-error">
      <h3>Scan Failed</h3>
      <p>${escapeHtml(message)}</p>
      <p class="lucent-muted">Check the backend terminal, confirm your Anthropic key is configured, then click Scan again.</p>
    </div>
  `;
}

function renderReport(report) {
  const content = document.getElementById("lucent-content");
  if (!content) {
    return;
  }

  const redFlags = (report.redFlags || [])
    .map((flag) => {
      const tone = getPointNoteTone(flag);
      return `
        <li class="lucent-note-item lucent-note-item-${escapeHtml(tone)}">
          <strong>${escapeHtml(flag.phrase)}</strong>
        </li>
      `;
    })
    .join("");

  const missingFields = (report.missingFields || [])
    .map((field) => `<li class="lucent-list-item">${escapeHtml(field)}</li>`)
    .join("");

  const locationChecks = (report.locationChecks || [])
    .map((check) => {
      const tone = getLocationCheckTone(check);
      const statusLabel =
        check.accurate === true
          ? "Plausible"
          : check.accurate === false
            ? "Possibly inaccurate"
            : "Unverified";

      const meta = [
        `Claimed: ${escapeHtml(check.claimedMinutes)} min`,
        check.actualDurationText ? `Google: ${escapeHtml(check.actualDurationText)}` : null,
        `Mode: ${escapeHtml(check.modeUsed)}`
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <details class="lucent-location-check lucent-location-check-${escapeHtml(tone)}">
          <summary class="lucent-location-summary">
            <span class="lucent-location-title">${escapeHtml(check.phrase)}</span>
            <span class="lucent-location-badge lucent-location-badge-${escapeHtml(tone)}">${escapeHtml(statusLabel)}</span>
          </summary>
          <div class="lucent-location-body">
            ${
              check.destination
                ? `<p class="lucent-location-destination">${escapeHtml(check.destination)}</p>`
                : ""
            }
            <p class="lucent-muted">${meta}</p>
            <p>${escapeHtml(check.verdict)}</p>
          </div>
        </details>
      `;
    })
    .join("");

  const photoMismatches = (report.photoMismatches || [])
    .slice(0, 2)
    .map((mismatch) => {
      return `
        <li class="lucent-list-item">
          <strong>${escapeHtml(mismatch.claim)}</strong>
        </li>
      `;
    })
    .join("");

  const photoUnverifiedClaims = (report.photoUnverifiedClaims || [])
    .slice(0, 2)
    .map((claim) => `<li class="lucent-list-item">${escapeHtml(claim)}</li>`)
    .join("");

  const photoSupportedClaims = (report.photoSupportedClaims || [])
    .slice(0, 4)
    .map((claim) => `<li class="lucent-list-item">${escapeHtml(claim)}</li>`)
    .join("");

  const reviewHighlights = (report.reviewHighlights || [])
    .slice(0, 3)
    .map((review) => `<li class="lucent-list-item">${escapeHtml(review)}</li>`)
    .join("");

  const locationDetails =
    locationChecks
      ? `<div class="lucent-location-checks">${locationChecks}</div>`
      : report.locationStatus === "no_claims"
        ? '<p class="lucent-muted">No verifiable location claims found.</p>'
        : "";

  const originMetaParts = [];
  if (report.locationOrigin) {
    originMetaParts.push(`Origin used: ${escapeHtml(report.locationOrigin)}`);
  }
  if (report.locationOriginSource === "listing_text_inferred") {
    originMetaParts.push("Source: listing-text inferred");
  }
  if (report.locationOriginSource === "review_inferred") {
    originMetaParts.push("Source: review-inferred");
  }
  if (report.locationOriginConfidence) {
    originMetaParts.push(`Confidence: ${escapeHtml(report.locationOriginConfidence)}`);
  }
  const originMeta = originMetaParts.join(" • ");

  const scoreBlock =
    typeof report.score === "number"
      ? `
        <div class="lucent-score-block lucent-score-${escapeHtml(report.color || "amber")}">
          <p class="lucent-score-label">Trust Score</p>
          <p class="lucent-score-value">${escapeHtml(report.score)}</p>
          <p class="lucent-score-verdict">${escapeHtml(report.verdict || "Analysis complete")}</p>
        </div>
      `
      : `
        <div class="lucent-card">
          <h3>Stage</h3>
          <p>Milestone 6 ran the full analysis, but Lucent could not produce a trust score for this scan.</p>
        </div>
      `;

  content.innerHTML = `
    ${scoreBlock}
    <div class="lucent-card">
      <h3>Summary</h3>
      <p>${escapeHtml(report.summary || "No summary returned.")}</p>
    </div>
    <div class="lucent-card">
      <h3>Guest Reviews</h3>
      <p>${escapeHtml(report.reviewSummary || "No review summary available.")}</p>
      ${
        reviewHighlights
          ? `
            <details class="lucent-review-toggle">
              <summary class="lucent-review-toggle-summary">Show review snippets</summary>
              <ul class="lucent-list">${reviewHighlights}</ul>
            </details>
          `
          : '<p class="lucent-muted">Review snippets were not exposed on this page.</p>'
      }
    </div>
    <div class="lucent-card">
      <h3>Points to Note</h3>
      ${redFlags ? `<ul class="lucent-note-list">${redFlags}</ul>` : '<p class="lucent-muted">No notable listing-language points surfaced in this scan.</p>'}
    </div>
    <div class="lucent-card">
      <h3>Missing Information</h3>
      ${missingFields ? `<ul class="lucent-list">${missingFields}</ul>` : '<p class="lucent-muted">No missing checklist items detected.</p>'}
    </div>
    <div class="lucent-card">
      <h3>Location Check</h3>
      <p>${escapeHtml(report.locationSummary || "No location verification data returned.")}</p>
      ${originMeta ? `<p class="lucent-muted">${originMeta}</p>` : ""}
      ${locationDetails}
    </div>
    <div class="lucent-card">
      <h3>Photo Analysis</h3>
      <p>${escapeHtml(shortenText(report.photoSummary || "No photo analysis returned.", 110))}</p>
      ${
        typeof report.photoAnalyzedCount === "number"
          ? `<p class="lucent-muted">Photos analyzed: ${escapeHtml(report.photoAnalyzedCount)}</p>`
          : ""
      }
      ${
        photoSupportedClaims
          ? `<div><p class="lucent-muted">Supported in photos:</p><ul class="lucent-list">${photoSupportedClaims}</ul></div>`
          : ""
      }
      ${photoMismatches ? `<ul class="lucent-list">${photoMismatches}</ul>` : ""}
      ${
        photoUnverifiedClaims
          ? `<div><p class="lucent-muted">Not visible in photos:</p><ul class="lucent-list">${photoUnverifiedClaims}</ul></div>`
          : ""
      }
    </div>
  `;
}

function sendListingForAnalysis(listing) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "ANALYZE_LISTING",
        payload: listing
      },
      (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Unknown backend error"));
          return;
        }

        resolve(response.data);
      }
    );
  });
}

async function handleScanClick() {
  try {
    setSidebarOpen(true);
    renderLoadingState();
    const listing = scrapeListing();
    console.log(`${LUCENT_SCRAPE_LOG_PREFIX} Sending listing to backend`, listing);
    const report = await sendListingForAnalysis(listing);
    console.log(`${LUCENT_SCRAPE_LOG_PREFIX} Received backend response`, report);
    renderReport(report);
  } catch (error) {
    console.error(`${LUCENT_SCRAPE_LOG_PREFIX} Scan failed`, error);
    renderErrorState(error.message);
  }
}

function waitForElement(selector, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    });

    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for selector: ${selector}`));
    }, timeoutMs);

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

async function initializeLucentScraper() {
  try {
    await waitForElement("h1");
    ensureSidebar();
    const listing = scrapeListing();
    console.log(`${LUCENT_SCRAPE_LOG_PREFIX} Scraped listing data`, listing);
  } catch (error) {
    console.error(`${LUCENT_SCRAPE_LOG_PREFIX} Failed to scrape listing`, error);
  }
}

initializeLucentScraper();
