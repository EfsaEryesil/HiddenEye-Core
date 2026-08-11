# HIDDENEYE CORE v1.4

**Advanced Passive Recon, OSINT & Threat Detection Engine for Chrome**

HiddenEye Core is a lightweight, highly efficient Chrome Extension designed for Red Teamers, SOC Analysts, and Bug Bounty Hunters. It passively analyzes web targets in real-time to uncover hidden backend architectures, security misconfigurations, and known vulnerabilities (CVEs) without generating aggressive or noisy traffic.

---

## Key Features

*   **WAF Identification:** Accurately detects major Web Application Firewalls (Cloudflare, AWS WAF, Imperva, Akamai, Sucuri) by analyzing HTTP response headers.
*   **Backend Leak Engine (Custom Signature):** Bypasses CDN shields by parsing the DOM and error pages (e.g., 403 Forbidden) to extract hidden backend server signatures (Nginx/Apache) and versions.
*   **Cookie Security Risk Analysis:** Automatically scans session cookies for missing `HttpOnly` and `Secure` flags, highlighting potential Cross-Site Scripting (XSS) and Session Hijacking attack vectors.
*   **Real-Time CVE Mapping:** Cross-references detected technology versions (via DOM and scripts) with the CIRCL API to immediately flag outdated software and known CVE risks.
*   **Security Header Scoring (A+ to F):** Evaluates the target's fundamental defense mechanisms based on the strict presence of `Content-Security-Policy (CSP)` and `Strict-Transport-Security (HSTS)`.
*   **One-Click JSON Export:** Generates clean, parsed JSON reports of all detected fingerprints and vulnerabilities, perfectly formatted for SOC ticketing systems or Pentest reporting.

---

## Installation

HiddenEye Core is currently in its developer phase and can be installed as an unpacked extension.

1. Clone this repository or download the ZIP file:
   ```bash
   git clone [https://github.com/EfsaEryesil/HiddenEye-Core.git](https://github.com/EfsaEryesil/HiddenEye-Core.git)