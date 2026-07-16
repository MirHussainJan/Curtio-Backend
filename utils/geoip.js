const dns = require("dns");

// Simple utility to check if an IP is local/private
function isPrivateIp(ip) {
  if (!ip) return true;
  // Localhost / IPv6 Loopback
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") return true;
  
  // Clean IP
  const cleanIp = ip.split(",")[0].trim();
  
  // IPv4 Private Ranges
  if (
    cleanIp.startsWith("10.") ||
    cleanIp.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)
  ) {
    return true;
  }
  
  return false;
}

// ASN organization name substrings that indicate a cloud/hosting/datacenter
// origin rather than a residential or mobile ISP — used to catch automated
// scanners (e.g. Microsoft Defender Safe Links prefetching links shared via
// Teams/Outlook) that render the page with a normal-looking browser UA
// specifically to evade user-agent-based bot detection.
const DATACENTER_ASN_KEYWORDS = [
  "microsoft", "azure", "amazon", "aws", "google cloud", "google llc",
  "digitalocean", "digital ocean", "ovh", "hetzner", "linode", "akamai",
  "cloudflare", "fastly", "oracle cloud", "alibaba", "tencent",
  "vultr", "choopa", "contabo", "scaleway", "leaseweb", "psychz", "m247",
  "hosting", "datacenter", "data center", "cloud computing", "colocation", "vps",
];

function isDatacenterOrg(org) {
  if (!org) return false;
  const lower = org.toLowerCase();
  return DATACENTER_ASN_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Resolves the 2-letter country code and country name from an IP address.
 * Falls back to headers or fetches via freeipapi.com.
 * @param {string} ip The IP address.
 * @param {object} headers The request headers.
 * @returns {Promise<{ countryCode: string, country: string, asnOrganization: string|null, isDatacenter: boolean }>}
 */
async function getGeoData(ip, headers = {}) {
  // 1. Try Vercel country headers first
  if (headers["x-vercel-ip-country"]) {
    const code = headers["x-vercel-ip-country"].toUpperCase();
    return {
      countryCode: code,
      country: getCountryName(code),
      asnOrganization: null,
      isDatacenter: false,
    };
  }

  // 2. Try Cloudflare country headers
  if (headers["cf-ipcountry"]) {
    const code = headers["cf-ipcountry"].toUpperCase();
    return {
      countryCode: code,
      country: getCountryName(code),
      asnOrganization: null,
      isDatacenter: false,
    };
  }

  // 3. Clean the client IP
  let clientIp = ip ? ip.split(",")[0].trim() : "";

  // If the IP is localhost/private, we make an API call without an IP address to resolve to the server's public IP
  const url = isPrivateIp(clientIp)
    ? "https://freeipapi.com/api/json/"
    : `https://freeipapi.com/api/json/${clientIp}`;

  try {
    // Add a strict timeout of 1.5 seconds so we don't delay the redirection if the API is slow
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.countryCode && data.countryCode !== "-") {
        return {
          countryCode: data.countryCode.toUpperCase(),
          country: data.countryName || getCountryName(data.countryCode),
          asnOrganization: data.asnOrganization || null,
          isDatacenter: isDatacenterOrg(data.asnOrganization),
        };
      }
    }
  } catch (error) {
    console.error("GeoIP lookup failed:", error.message);
  }

  return {
    countryCode: "US",
    country: "United States",
    asnOrganization: null,
    isDatacenter: false,
  };
}

// A helper dictionary to map codes to names if needed
function getCountryName(code) {
  const countries = {
    "US": "United States",
    "GB": "United Kingdom",
    "CA": "Canada",
    "IN": "India",
    "PK": "Pakistan",
    "AU": "Australia",
    "DE": "Germany",
    "FR": "France",
    "IT": "Italy",
    "ES": "Spain",
    "JP": "Japan",
    "CN": "China",
    "BR": "Brazil",
    "ZA": "South Africa",
    "RU": "Russia",
    "NL": "Netherlands",
    "SE": "Sweden",
    "NO": "Norway",
    "DK": "Denmark",
    "FI": "Finland",
    "PL": "Poland",
    "TR": "Turkey",
    "MX": "Mexico",
    "AR": "Argentina",
    "CL": "Chile",
    "CO": "Colombia",
    "NZ": "New Zealand",
    "SG": "Singapore",
    "MY": "Malaysia",
    "TH": "Thailand",
    "ID": "Indonesia",
    "PH": "Philippines",
    "VN": "Vietnam",
    "SA": "Saudi Arabia",
    "AE": "United Arab Emirates",
    "IL": "Israel",
    "EG": "Egypt",
    "NG": "Nigeria",
    "KE": "Kenya",
    "UA": "Ukraine",
    "CH": "Switzerland",
    "AT": "Austria",
    "BE": "Belgium",
    "IE": "Ireland",
    "PT": "Portugal",
    "GR": "Greece",
    "CZ": "Czech Republic",
    "HU": "Hungary",
    "RO": "Romania"
  };
  return countries[code.toUpperCase()] || code;
}

module.exports = {
  getGeoData
};
