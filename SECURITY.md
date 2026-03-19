# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | :white_check_mark: |
| 0.x     | :x:                |

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

Report privately to: **security@trafficmind.com**

Include:
- Affected package, module, or function
- Steps to reproduce
- Impact assessment (data exposure, auth bypass, etc.)
- Proposed mitigation (if available)

We will acknowledge receipt within **2 business days** and provide
a status update within **7 business days**.

## Disclosure Policy

We follow **coordinated disclosure**:

1. Reporter submits vulnerability privately.
2. We confirm and assess severity within 7 business days.
3. We develop and test a fix.
4. We release a patched version and notify the reporter.
5. Public disclosure occurs **after the patch is released**, or after
   **90 days** from the report date — whichever comes first.

We ask reporters to respect this timeline and not disclose publicly
before a fix is available.

## Severity Assessment

We use [CVSS v3.1](https://www.first.org/cvss/calculator/3.1) to assess severity:

| Severity | CVSS Score | Response target |
|----------|------------|-----------------|
| Critical | 9.0 – 10.0 | Patch within 7 days |
| High     | 7.0 – 8.9  | Patch within 14 days |
| Medium   | 4.0 – 6.9  | Patch within 30 days |
| Low      | 0.1 – 3.9  | Next scheduled release |

## Credits

We publicly credit reporters in the release notes unless anonymity is requested.