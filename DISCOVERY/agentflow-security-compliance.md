# AgentFlow Security & Compliance Guide

## Executive Summary

As a SaaS platform handling customer code, AI agent interactions, and potentially deploying to customer infrastructure, AgentFlow has significant security and compliance obligations. This guide covers what you need now vs. later, costs, and implementation priorities.

---

## 1. Compliance Framework Priority

### When You Need What

| Stage | Revenue/Customers | Required | Nice to Have |
|-------|-------------------|----------|--------------|
| **MVP/Beta** | <$10K ARR | Basic security, Privacy Policy, Terms of Service | - |
| **Early Growth** | $10K-$100K ARR | GDPR compliance, DPA template | SOC 2 Type I |
| **Scale** | $100K-$500K ARR | SOC 2 Type II, formal security program | ISO 27001 |
| **Enterprise** | $500K+ ARR | SOC 2 Type II (required), HIPAA (if healthcare) | ISO 27001, SOC 3 |

**Reality check**: Most enterprise sales will ask "Do you have SOC 2?" - without it, deals often stall.

---

## 2. Immediate Requirements (Do Now)

### 2.1 Privacy Policy & Terms of Service

**Cost**: £500-2,000 (lawyer) or £0-100 (template + review)

Must include:
- What data you collect (user accounts, code, AI conversations)
- How you use it (service delivery, AI training - be explicit!)
- Third parties (Anthropic API, cloud providers)
- Data retention periods
- User rights (access, deletion, export)
- Cookie policy

**Critical for AgentFlow**: Be explicit about:
- Code/project data sent to AI models
- Whether conversations are used for training (Anthropic's policy)
- Where data is stored (EU/US)

### 2.2 Data Processing Agreement (DPA)

**Cost**: £500-1,500 (lawyer to create template)

Required when processing customer data. Your DPA should cover:
- You as processor, customer as controller
- Data processing purposes (running AI agents on their code)
- Security measures you implement
- Sub-processors (Anthropic, Hetzner, etc.)
- Breach notification procedures
- Data deletion on termination

### 2.3 Basic Security Controls

**Cost**: £0-500/month (tooling)

| Control | Implementation | Priority |
|---------|----------------|----------|
| **HTTPS everywhere** | Let's Encrypt / Cloudflare | Critical |
| **Authentication** | Password hashing (bcrypt), session management | Critical |
| **MFA** | TOTP (Google Auth) for all accounts | High |
| **Encryption at rest** | Database encryption, disk encryption | High |
| **Encryption in transit** | TLS 1.2+ for all connections | Critical |
| **Access logging** | Log all authentication events | High |
| **Secrets management** | Never in code, use env vars or vault | Critical |

---

## 3. GDPR Compliance (UK/EU)

### 3.1 Key Requirements

Since you're UK-based and likely serving EU customers:

| Requirement | What It Means | Implementation |
|-------------|---------------|----------------|
| **Lawful basis** | Legal reason to process data | Contract performance (service delivery) |
| **Consent** | Explicit opt-in for marketing | Checkbox, not pre-ticked |
| **Right to access** | Users can request their data | Export feature in settings |
| **Right to deletion** | Users can delete account/data | Delete account feature |
| **Right to portability** | Users can export data | JSON/ZIP export |
| **Data minimization** | Only collect what's needed | Audit your data collection |
| **Breach notification** | 72 hours to report breaches | Incident response plan |

### 3.2 AgentFlow-Specific GDPR Concerns

**Code as Personal Data**: If user code contains PII (names, emails in comments, config files), that code becomes personal data under GDPR.

**AI Processing**: When code is sent to Claude API:
- Anthropic is a sub-processor
- Need DPA with Anthropic (they provide one)
- Must disclose in privacy policy
- Consider: Does Anthropic use data for training? (Currently no for API)

**Data Location**:
- Hetzner EU = Good for GDPR (data stays in EU)
- Anthropic API = US-based (need Standard Contractual Clauses)
- Clarify in privacy policy

### 3.3 GDPR Costs

| Item | Cost | Notes |
|------|------|-------|
| Legal review of policies | £1,000-3,000 | One-time |
| DPA template | £500-1,500 | One-time |
| Compliance software (optional) | £50-500/mo | Vanta, Drata, ComplyDog |
| Cookie consent banner | £0-50/mo | CookieScript, free options |
| **Total Year 1** | **~£2,000-5,000** | |

---

## 4. SOC 2 Compliance

### 4.1 What Is SOC 2?

An audit by a CPA firm that verifies your security controls work. Based on 5 Trust Service Criteria:

| Criteria | Required? | What It Covers |
|----------|-----------|----------------|
| **Security** | ✅ Mandatory | Access control, firewalls, encryption, monitoring |
| **Availability** | Optional | Uptime, disaster recovery, backups |
| **Processing Integrity** | Optional | Data accuracy, error handling |
| **Confidentiality** | Optional | Data protection, classification |
| **Privacy** | Optional | PII handling, consent, retention |

**Recommendation**: Start with Security + Availability (most customers ask for these).

### 4.2 SOC 2 Types

| Type | What It Proves | Timeline | Cost |
|------|----------------|----------|------|
| **Type I** | Controls are designed correctly | 1-3 months | £15,000-25,000 |
| **Type II** | Controls work over 3-12 months | 6-12 months | £25,000-50,000 |

**Path**: Get Type I first to unblock sales, then Type II for enterprise.

### 4.3 SOC 2 Controls You'll Need

```
ACCESS CONTROL
├── Unique user IDs
├── MFA for all systems
├── Role-based access (RBAC)
├── Access reviews (quarterly)
├── Offboarding procedures
└── Privileged access management

CHANGE MANAGEMENT
├── Version control (Git)
├── Code review requirements
├── Testing before deploy
├── Rollback procedures
└── Change approval process

INCIDENT RESPONSE
├── Incident classification
├── Response procedures
├── Communication plan
├── Post-incident review
└── Breach notification

RISK MANAGEMENT
├── Annual risk assessment
├── Vendor risk assessment
├── Vulnerability scanning
├── Penetration testing
└── Risk register

MONITORING
├── Security event logging
├── Log retention (1 year)
├── Alerting on anomalies
├── Regular log review
└── Audit trail integrity
```

### 4.4 SOC 2 Timeline & Costs

| Phase | Duration | Cost |
|-------|----------|------|
| Gap assessment | 2-4 weeks | £2,000-5,000 |
| Remediation | 2-4 months | Internal time + tools |
| Type I audit | 1-2 months | £15,000-25,000 |
| Observation period | 3-6 months | - |
| Type II audit | 1-2 months | £25,000-50,000 |
| **Total (Type II)** | **9-15 months** | **£40,000-80,000** |

### 4.5 SOC 2 Automation Tools

| Tool | Cost | Notes |
|------|------|-------|
| **Vanta** | $10,000-25,000/yr | Most popular, good integrations |
| **Drata** | $10,000-20,000/yr | Strong automation |
| **Secureframe** | $8,000-15,000/yr | Good for startups |
| **Sprinto** | $5,000-15,000/yr | Budget option |

These tools automate evidence collection, reducing audit prep from months to weeks.

---

## 5. AgentFlow-Specific Security Concerns

### 5.1 Code Security

Your platform handles customer source code - this is highly sensitive:

| Risk | Mitigation |
|------|------------|
| Code leakage between customers | Strict tenant isolation, separate environments |
| Code exposed to AI | Clear disclosure, Anthropic DPA, no training use |
| Code in backups | Encrypted backups, retention limits |
| Code in logs | Sanitize logs, no code in error messages |
| Malicious code execution | Sandboxed environments, resource limits |

### 5.2 AI Agent Security

| Risk | Mitigation |
|------|------------|
| Agent accesses wrong project | Auth tokens per project, RBAC |
| Agent leaks data in responses | Output filtering, audit logging |
| Prompt injection | Input sanitization, system prompt protection |
| Agent runs dangerous commands | Command allowlisting, sandboxing |
| Agent costs spiral | Rate limits, spending caps |

### 5.3 Multi-Tenant Security

Since customers share infrastructure (environments):

| Control | Implementation |
|---------|----------------|
| Network isolation | Separate VPCs/containers per customer |
| Data isolation | Database per customer or strict row-level security |
| Resource limits | CPU/memory/storage quotas |
| Credential isolation | Separate secrets per project |
| Audit separation | Logs tagged by customer |

### 5.4 Self-Hosted Security

When customers bring their own servers:

| Concern | Your Responsibility | Customer Responsibility |
|---------|---------------------|------------------------|
| AgentFlow runtime security | Keep it updated, secure defaults | Install updates |
| Server hardening | Documentation, best practices | Implementation |
| Network security | Secure protocols (TLS) | Firewall, access |
| Data on their server | Encryption at rest option | Backups, physical security |
| Credential management | Secure storage in runtime | Don't share credentials |

---

## 6. Security Implementation Checklist

### Phase 1: Foundation (Month 1-2)

```
[ ] HTTPS on all endpoints
[ ] Password hashing (bcrypt, argon2)
[ ] Session management (secure cookies, expiry)
[ ] MFA option for users
[ ] Basic input validation
[ ] SQL injection prevention (parameterized queries)
[ ] XSS prevention (output encoding)
[ ] CSRF protection
[ ] Security headers (CSP, HSTS, etc.)
[ ] Secrets in environment variables
[ ] Dependency vulnerability scanning
[ ] Privacy policy published
[ ] Terms of service published
[ ] Cookie consent banner
```

### Phase 2: Hardening (Month 3-4)

```
[ ] MFA required for all accounts
[ ] Role-based access control
[ ] Audit logging (auth events, data access)
[ ] Encryption at rest (database, backups)
[ ] Encryption in transit (TLS 1.2+)
[ ] Backup system with tested restores
[ ] Incident response plan documented
[ ] DPA template ready
[ ] Vendor security assessment (Anthropic, Hetzner)
[ ] Penetration test (basic)
```

### Phase 3: Compliance Ready (Month 5-8)

```
[ ] SOC 2 gap assessment
[ ] Security policies documented
[ ] Change management process
[ ] Access review process (quarterly)
[ ] Vulnerability scanning (weekly)
[ ] Log retention (1 year)
[ ] Risk assessment completed
[ ] Business continuity plan
[ ] Security awareness training
[ ] SOC 2 Type I audit
```

---

## 7. Vendor Security (Sub-Processors)

You need to assess and document security of your vendors:

### Required Vendor Assessments

| Vendor | What They Handle | Their Compliance |
|--------|------------------|------------------|
| **Anthropic** | AI processing, code analysis | SOC 2 Type II, GDPR DPA available |
| **Hetzner** | Server hosting | ISO 27001, GDPR compliant |
| **DigitalOcean** | Server hosting (if used) | SOC 2, ISO 27001 |
| **Stripe** | Payments | PCI DSS Level 1, SOC 2 |
| **GitHub** | OAuth, code hosting | SOC 2, GDPR |
| **Cloudflare** | CDN, DDoS protection | SOC 2, ISO 27001 |

**Action**: Get DPAs signed with all vendors processing customer data.

---

## 8. Incident Response Plan

### Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| **Critical** | Data breach, service down | 1 hour |
| **High** | Security vulnerability exploited | 4 hours |
| **Medium** | Potential security issue | 24 hours |
| **Low** | Minor security concern | 72 hours |

### Response Steps

```
1. DETECT
   - Monitoring alerts
   - Customer reports
   - Security scanning

2. CONTAIN
   - Isolate affected systems
   - Revoke compromised credentials
   - Preserve evidence

3. ASSESS
   - Scope of impact
   - Data affected
   - Root cause

4. NOTIFY (if breach)
   - ICO within 72 hours (GDPR)
   - Affected customers "without undue delay"
   - Document everything

5. REMEDIATE
   - Fix vulnerability
   - Restore service
   - Implement preventions

6. REVIEW
   - Post-incident report
   - Update procedures
   - Lessons learned
```

---

## 9. Cost Summary

### Year 1 (Foundation + GDPR)

| Item | Cost |
|------|------|
| Legal (policies, DPA) | £2,000-4,000 |
| Security tools | £1,000-3,000 |
| Penetration test | £2,000-5,000 |
| **Total** | **£5,000-12,000** |

### Year 2 (SOC 2 Type I)

| Item | Cost |
|------|------|
| Compliance platform (Vanta/Drata) | £8,000-15,000 |
| Gap assessment | £3,000-5,000 |
| SOC 2 Type I audit | £15,000-25,000 |
| Penetration test | £3,000-5,000 |
| **Total** | **£29,000-50,000** |

### Year 3+ (SOC 2 Type II)

| Item | Cost |
|------|------|
| Compliance platform | £10,000-20,000 |
| SOC 2 Type II audit | £25,000-40,000 |
| Penetration test | £3,000-5,000 |
| Ongoing security tools | £5,000-10,000 |
| **Total** | **£43,000-75,000/year** |

---

## 10. Recommendations for AgentFlow

### Immediate (This Month)

1. ✅ **Privacy Policy** - Be explicit about AI processing of code
2. ✅ **Terms of Service** - Limit liability, define acceptable use
3. ✅ **Basic security controls** - HTTPS, auth, encryption
4. ✅ **Cookie consent** - Simple banner

### Short-term (3-6 Months)

1. 🔲 **DPA template** - Ready for B2B customers
2. 🔲 **MFA everywhere** - Required for all users
3. 🔲 **Audit logging** - Track all sensitive actions
4. 🔲 **Incident response plan** - Document and test

### Medium-term (6-12 Months)

1. 🔲 **SOC 2 Type I** - When enterprise deals require it
2. 🔲 **Penetration testing** - Annual, by third party
3. 🔲 **Security policies** - Formalize everything

### Enterprise-Ready (12-18 Months)

1. 🔲 **SOC 2 Type II** - Required for large enterprises
2. 🔲 **ISO 27001** - Nice to have, adds credibility
3. 🔲 **Bug bounty program** - Crowdsourced security testing

---

## 11. Quick Wins

### Free/Low-Cost Security Improvements

| Action | Cost | Impact |
|--------|------|--------|
| Enable MFA on all admin accounts | Free | High |
| Add security headers (Helmet.js) | Free | Medium |
| Set up Dependabot for vulnerabilities | Free | High |
| Implement rate limiting | Free | Medium |
| Add CORS properly | Free | Medium |
| Use Cloudflare (free tier) | Free | High |
| Document your security practices | Free | High |
| Create a security@ email | Free | Low |

### Security Headers to Add

```python
# FastAPI example
from fastapi import FastAPI
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

app = FastAPI()

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```

---

## Summary

| Priority | What | When | Cost |
|----------|------|------|------|
| 🔴 **Critical** | Privacy Policy, ToS, HTTPS, Auth | Now | £500-2,000 |
| 🟠 **High** | GDPR compliance, DPA, MFA | Month 1-3 | £2,000-5,000 |
| 🟡 **Medium** | SOC 2 Type I, Pen testing | Month 6-12 | £20,000-35,000 |
| 🟢 **Future** | SOC 2 Type II, ISO 27001 | Year 2+ | £40,000+/year |

**Key takeaway**: Start with the basics (policies, encryption, auth), get GDPR-ready quickly, and plan for SOC 2 when enterprise deals demand it. Don't over-engineer security before you have paying customers, but don't ignore it either.
