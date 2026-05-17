# PodSoft — Legal, Compliance & Security Framework

**Version:** 2.0  
**Status:** Production Ready  
**Last Updated:** May 2026  
**Audience:** Legal, Security, Compliance Officers  
**Document Owner:** Chief Legal Officer / Security Lead

---

## 1. Terms of Service & Legal Agreements

### 1.1 Terms of Service (Master Agreement)

**PodSoft Terms of Service**  
*Effective Date: May 3, 2026*

#### 1. Service Description
PodSoft is a cloud-based content recording and production platform ("Service") that enables users to record, sync, process, and publish multi-device video and audio content.

#### 2. User Responsibilities
Users agree to:
- Use the Service only for lawful purposes
- Not record others without consent (follow local recording laws)
- Not upload copyrighted material without permission
- Maintain confidentiality of account credentials
- Report security vulnerabilities responsibly

#### 3. Intellectual Property
- **Your Content**: You retain all rights to your recordings and content
- **Our IP**: PodSoft's technology, templates, and software remain our property
- **License**: We license you limited, non-exclusive rights to use the Service

#### 4. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, PODSOFT SHALL NOT BE LIABLE FOR:
- Indirect, incidental, special, or consequential damages
- Lost data, lost revenue, or lost profits
- Total liability capped at fees paid in prior 12 months

#### 5. Warranty Disclaimer
SERVICE PROVIDED "AS-IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.

#### 6. Dispute Resolution
- **Governing Law**: Delaware
- **Jurisdiction**: US courts (or arbitration for disputes <$250K)
- **Arbitration Fee**: Each party bears own costs unless arbitrator decides otherwise

#### 7. Termination
- **By User**: Anytime, without penalty (30-day data retention)
- **By PodSoft**: For ToS violations, with 30-day notice
- **Effect**: Loss of access; data deleted per retention policy

#### 8. Data Retention After Deletion
- **Session data**: 90 days (allows recovery)
- **Videos**: Deleted immediately (irreversible)
- **Backups**: Retained per compliance requirements (6-month RTO)

#### 9. Changes to Terms
PodSoft may modify Terms with 30-day notice. Continued use = acceptance.

---

### 1.2 Privacy Policy & Data Protection

**PodSoft Privacy Policy**  
*Effective Date: May 3, 2026*

#### 1. Data We Collect

**Personal Data**
- Email, name, phone number (on signup)
- Payment information (via Stripe, PCI-DSS compliant)
- Device information (OS, app version, device ID)
- Location data (optional, for geotags)

**Content Data**
- Videos, audio, transcripts (stored in S3)
- Metadata (duration, resolution, creation time)
- Session information (device list, sync data)

**Usage Data** (via analytics)
- Feature interactions, session duration
- Error logs, performance metrics
- Aggregate analytics (no personal ID tracking)

#### 2. How We Use Your Data

**Required**
- Service delivery (store/process your content)
- Account management and support
- Payment processing and billing
- Security and fraud prevention

**Optional**
- Product improvements and AI model training (opt-in)
- Marketing communications (opt-out anytime)
- Legal and compliance obligations

#### 3. Data Retention

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Videos | Until deleted | User ownership |
| Account data | 2 years after deletion | Legal/tax |
| Backups | 30 days after deletion | Disaster recovery |
| Analytics | 12 months | Product insights |
| Logs | 90 days | Security/debugging |
| Payment records | 7 years | Tax compliance |

#### 4. Data Sharing & Third Parties

**We share data with:**
- **Stripe**: Payment processing (PCI-DSS Level 1)
- **AWS**: Cloud infrastructure (data center in US/EU)
- **Whisper API**: Transcription (OpenAI, US-based)
- **CloudFlare**: CDN and DDoS protection

**We do NOT sell data** to third parties for marketing.

#### 5. Your Rights

**GDPR Rights** (EU users):
- Right to access (data export)
- Right to correction (update info)
- Right to deletion (right to be forgotten)
- Right to portability (export data)
- Right to withdraw consent

**CCPA Rights** (California users):
- Right to know what data is collected
- Right to delete personal information
- Right to opt-out of sale (we don't sell)
- Right to non-discrimination for exercising rights

**How to exercise**: privacy@podsoft.io

#### 6. Data Security
- **Encryption in transit**: TLS 1.3
- **Encryption at rest**: AES-256 (S3 + RDS)
- **Access control**: IAM roles, principle of least privilege
- **Auditing**: CloudTrail logs, monthly reviews
- **Incident response**: Within 72 hours to regulators

---

### 1.3 Data Processing Agreement (DPA)

**For Enterprise/HIPAA customers**, PodSoft offers a Data Processing Addendum:

#### 1. Processor Responsibilities
- Process data only per customer instructions
- Ensure subprocessors are compliant
- Implement technical and organizational measures
- Assist with data subject requests
- Delete data on termination

#### 2. Sub-processors
Current sub-processors (with 30-day notice for changes):
- AWS (USA, EU, APAC regions)
- Stripe (USA-based payment processor)
- OpenAI (USA-based transcription)
- SendGrid (Email, USA-based)

#### 3. Standard Contractual Clauses (SCCs)
EU Standard Contractual Clauses incorporated by reference for international data transfers.

#### 4. HIPAA Business Associate Agreement
**Available for healthcare customers** with:
- Covered entity verification
- Business associate insurance ($2M minimum)
- Incident response SLA (24 hours)
- HIPAA compliance audit (annual)

---

## 2. Compliance Frameworks

### 2.1 GDPR Compliance (EU)

**Key Requirements & Implementation**

| Requirement | Implementation | Status |
|-------------|-----------------|--------|
| **Legal Basis** | Legitimate interest + consent | ✅ Documented |
| **Consent Management** | Cookie banner, opt-in for marketing | ✅ Implemented |
| **Data Protection Officer (DPO)** | Appointed (external consultant) | ✅ Active |
| **Data Protection Impact Assessment (DPIA)** | Required for high-risk processing | 🔄 In progress (month 3) |
| **Data Breach Notification** | 72-hour notification to authorities | ✅ Procedure documented |
| **Right to Access** | Data export within 30 days | ✅ Automated |
| **Right to Deletion** | Delete within 45 days (with exceptions) | ✅ Automated |
| **International Transfers** | Standard Contractual Clauses (SCCs) | ✅ Signed |
| **Vendor Management** | Sub-processor audits, DPAs | ✅ In place |

**GDPR Compliance Checklist:**
- [ ] Privacy policy translated to local languages
- [ ] Consent management cookie banner deployed
- [ ] Data Processing Agreement (DPA) templates prepared
- [ ] Data subject request (DSR) process automated
- [ ] Incident response procedure documented
- [ ] Staff GDPR training completed (annually)
- [ ] Breach notification procedure tested (quarterly drills)
- [ ] Sub-processor list published and updated

---

### 2.2 HIPAA Compliance (Healthcare)

**For telehealth, healthcare training, or medical recording use cases**

**HIPAA Requirements & Implementation**

| Requirement | Implementation | Timeline |
|-------------|-----------------|----------|
| **Business Associate Agreement (BAA)** | Template created, available on request | Immediate |
| **Minimum Encryption** | AES-256 at rest, TLS 1.3 in transit | ✅ Current |
| **Access Controls** | Role-based access control (RBAC) | ✅ Current |
| **Audit Controls** | CloudTrail logging, 1-year retention | ✅ Current |
| **Transmission Security** | TLS for all data transmission | ✅ Current |
| **Breach Notification** | Within 60 days; notify individuals + HHS | ✅ Procedure ready |
| **Security Risk Assessment** | Annual assessment + remediation | 🔄 Month 6 |
| **Workforce Security** | Background checks, NDA agreements | 🔄 Month 6 |
| **Third-party Audits** | Annual SOC 2 Type II audit | 🔄 Month 6 |

**HIPAA Deployment Checklist:**
- [ ] Dedicated HIPAA environment (isolated AWS account)
- [ ] Encryption keys managed separately (AWS KMS)
- [ ] Access logs reviewed daily
- [ ] Monthly risk assessments
- [ ] Incident response plan (with HIPAA specific procedures)
- [ ] Workforce training (HIPAA 101, annually)
- [ ] Business Associate Agreements signed with all staff
- [ ] Breach simulation/drills (quarterly)

---

### 2.3 CCPA Compliance (California)

**Consumer Privacy Act Requirements**

| Requirement | Implementation | Status |
|-------------|-----------------|--------|
| **Privacy Notice** | Disclose data practices in privacy policy | ✅ Implemented |
| **Right to Know** | Allow data export (GDPR-like) | ✅ Automated |
| **Right to Delete** | Allow account deletion | ✅ Automated |
| **Right to Opt-Out** | "Do Not Sell" link and opt-out mechanism | ✅ Implemented |
| **Non-Discrimination** | Don't charge more for opting out | ✅ Policy in place |
| **Child Protection** | Parental consent for users <13 | ✅ Age verification |

**CCPA Compliance**: 
- Privacy policy explicitly states "We do not sell personal information"
- Opt-out mechanism available in account settings
- Annual CCPA disclosure/certifications prepared

---

### 2.4 SOC 2 Type II (Target: Month 6)

**Controls Framework & Audit Plan**

| Control | Scope | Timeline |
|---------|-------|----------|
| **Security** | Access controls, encryption, monitoring | Month 6 audit |
| **Availability** | 99.95% uptime SLA, disaster recovery | Month 6 audit |
| **Processing Integrity** | Accurate data processing, error detection | Month 6 audit |
| **Confidentiality** | Data privacy, encryption, access logs | Month 6 audit |
| **Privacy** | GDPR/CCPA compliance | Month 6 audit |

**SOC 2 Audit Preparation:**
- [ ] Select Big 4 auditor (Deloitte, EY, PwC, KPMG) by Month 4
- [ ] Implement all control procedures by Month 5
- [ ] Evidence gathering (logs, policies, training records) by Month 5
- [ ] Auditor testing and reporting by Month 6
- [ ] Report available for enterprise sales by Month 6–7

---

### 2.5 Other Compliance Frameworks

**FERPA** (Family Educational Rights & Privacy Act)
- For educational institutions using PodSoft
- Require FERPA Business Associate Agreement
- Implement student data protection measures
- Status: Template available Month 4

**PCI DSS** (Payment Card Industry Data Security Standard)
- We use Stripe (PCI-DSS Level 1) for payments
- We do NOT store credit card data
- PCI compliance: Delegated to Stripe
- Status: ✅ Compliant (via Stripe)

**SOX** (Sarbanes-Oxley, if IPO)
- Will require financial controls, audit trail
- Status: Defer until IPO planning (Year 3+)

---

## 3. Security Program & Framework

### 3.1 Security Posture (NIST Framework)

**Aligned with NIST Cybersecurity Framework (CSF)**

| Function | Maturity | Timeline |
|----------|----------|----------|
| **Identify** | Level 3 (repeatable) | Current ✅ |
| **Protect** | Level 2 (defined) | Month 3 |
| **Detect** | Level 2 (defined) | Month 3 |
| **Respond** | Level 2 (defined) | Month 6 |
| **Recover** | Level 2 (defined) | Month 6 |

### 3.2 Vulnerability Management

**Process:**
1. **Identification** (automated scanning)
   - Snyk (dependency scanning): daily
   - SAST (code analysis): every commit
   - DAST (dynamic testing): weekly
   - Infrastructure scanning: monthly

2. **Severity Ratings** (CVSS)
   - Critical (CVSS 9.0–10): Fix within 24 hours
   - High (CVSS 7.0–8.9): Fix within 7 days
   - Medium (CVSS 4.0–6.9): Fix within 30 days
   - Low (CVSS 0.1–3.9): Fix within 90 days

3. **Patching**
   - Dependencies: Automated via Dependabot
   - OS patches: Monthly (Patch Tuesday)
   - Database: Rolling updates (no downtime)
   - Approved by security team + on-call engineer

### 3.3 Incident Response Plan

**Incident Response Procedure**

```
Incident Detection
    ↓
    • CloudWatch alarm triggers
    • Security scanner flags vulnerability
    • User reports suspicious activity
    ↓
Triage (within 1 hour)
    ↓
    • Assess severity (Critical/High/Medium/Low)
    • Engage on-call security engineer
    • Assemble incident response team
    ↓
Containment (within 2 hours for Critical)
    ↓
    • Isolate affected system
    • Preserve evidence (logs, snapshots)
    • Communicate with affected users
    • Notify management/board
    ↓
Investigation (within 24 hours)
    ↓
    • Root cause analysis
    • Determine scope of impact
    • Estimate data compromised
    ↓
Remediation (varies by severity)
    ↓
    • Fix root cause
    • Implement temporary controls
    • Test fixes in staging
    • Deploy to production
    ↓
Notification (varies by law)
    ↓
    • GDPR: 72-hour notification
    • HIPAA: 60-day notification
    • Users: Within 24 hours (if data breach)
    ↓
Post-Incident Review (within 5 days)
    ↓
    • Document lessons learned
    • Update procedures
    • Brief team + board
    • Implement preventive measures
```

**Incident Severity Levels**

| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| **Critical** | Data breach, system down, customer impact | <1 hour | AWS account compromise |
| **High** | Security vulnerability, potential breach | <4 hours | Unpatched RCE vulnerability |
| **Medium** | Limited impact, no immediate threat | <24 hours | Weak password policy |
| **Low** | Informational, no immediate action | <1 week | Outdated TLS cipher |

---

### 3.4 Responsible Disclosure Policy

**Security Vulnerability Reporting**

We welcome responsible disclosure. If you discover a vulnerability:

1. **Do NOT** publicly disclose the vulnerability
2. **Email** security@podsoft.io with:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Your contact information

3. **Response Timeline:**
   - Acknowledgment: Within 24 hours
   - Initial assessment: Within 5 days
   - Fix + patch: Within 30 days (critical), 90 days (others)
   - Public disclosure: Coordinated with you

4. **Safe Harbor:**
   - We will not take legal action against authorized security research
   - You will receive credit (if desired) in security advisory

**Contact**: security@podsoft.io

---

## 4. Insurance & Risk Management

### 4.1 Insurance Coverage

**Recommended Insurance Portfolio**

| Policy | Coverage | Amount | Cost | Renewable |
|--------|----------|--------|------|-----------|
| **General Liability** | Bodily injury, property damage | $2M | $2K/year | Annual |
| **Cyber Liability** | Data breach, network security | $5M | $15K/year | Annual |
| **Professional Liability** | Errors & omissions, professional negligence | $5M | $12K/year | Annual |
| **Directors & Officers (D&O)** | Board member liability | $5M | $8K/year | Annual |
| **Employment Practices (EPLI)** | Wrongful termination, discrimination | $2M | $5K/year | Annual |

**Total Annual Cost**: ~$42K (typical for SaaS startup)

### 4.2 Risk Assessment & Mitigation

**Key Risks & Mitigation**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Data Breach** | Medium | Critical | Encryption, access controls, security audits |
| **Service Outage** | Low | High | Multi-region failover, SLA compensation |
| **Regulatory Fines (GDPR/HIPAA)** | Low | Critical | Compliance program, legal review, insurance |
| **IP Infringement (copyright claims)** | Medium | High | Terms of service, DMCA procedure, copyright monitoring |
| **Key Person Risk (founder departure)** | Low | High | Cross-training, documentation, equity incentives |

---

## 5. Content Moderation & Safety

### 5.1 Content Policies

**Prohibited Content** (zero tolerance)
- Child sexual abuse material (CSAM)
- Graphic violence or gore
- Harassment, hate speech, threats
- Non-consensual intimate imagery
- Illegal activity (drugs, weapons trafficking)

**Restricted Content** (warnings/age gates)
- Violent content (not graphic)
- Sexual content (not CSAM)
- Dangerous challenges or stunts
- Conspiracy theories (with fact-check labels)

**User-Generated Content (UGC) Guidelines**
- Users responsible for own content
- We enforce ToS via abuse reporting
- Repeat violators banned from platform
- Emergency content removal within 24 hours

### 5.2 Abuse Reporting & Moderation

**Process:**
1. User reports via "Report" button in session details
2. Content flagged for review (automated + manual)
3. Moderation team reviews within 48 hours
4. Action taken (warning, suspension, deletion)
5. User notified of decision + appeal process

**Moderation Team:**
- Month 0–6: Outsourced (Crisp Thinking or similar)
- Month 6+: Hire internal moderation specialist
- Escalation to legal for criminal content

---

## 6. Legal Templates & Documentation

### 6.1 Drafting Checklist

**Required Documents (launch)**
- [ ] Terms of Service (TOS)
- [ ] Privacy Policy
- [ ] Acceptable Use Policy (AUP)
- [ ] Cookie Policy
- [ ] DMCA Takedown Procedure
- [ ] Responsible Disclosure Policy

**Recommended (Month 1–3)**
- [ ] Data Processing Agreement (DPA)
- [ ] HIPAA Business Associate Agreement (BAA)
- [ ] Service Level Agreement (SLA)
- [ ] Enterprise Master Service Agreement (MSA)
- [ ] Non-Disclosure Agreement (NDA) template

**Regulatory (Month 3–6)**
- [ ] GDPR Privacy Notice (localized)
- [ ] CCPA Disclosures
- [ ] Cookie Consent Management
- [ ] Incident Response Procedure
- [ ] Data Retention & Deletion Policy

### 6.2 Document Review Schedule

| Document | Review Frequency | Next Review |
|----------|------------------|-------------|
| Terms of Service | Annually or after major changes | May 2027 |
| Privacy Policy | Annually or after data practice changes | May 2027 |
| DPA | Annually or after sub-processor changes | May 2027 |
| Incident Response Plan | Quarterly (with drills) | August 2026 |
| Vendor Agreements | Annually | May 2027 |

---

## 7. Implementation Roadmap

### 7.1 Compliance Implementation Timeline

**Month 1**
- ✅ Finalize and publish ToS + Privacy Policy
- ✅ Implement GDPR consent banner
- ✅ Create DPA template
- ✅ Establish data retention policy

**Month 2–3**
- [ ] Conduct GDPR Data Protection Impact Assessment (DPIA)
- [ ] Complete employee/contractor NDAs
- [ ] Implement SOC 2 control procedures
- [ ] Prepare HIPAA Business Associate Agreement (BAA)
- [ ] Create incident response procedures

**Month 4–6**
- [ ] Obtain SOC 2 Type II audit engagement
- [ ] Implement HIPAA-specific controls
- [ ] Conduct security training for all staff
- [ ] Test incident response procedures (tabletop drill)
- [ ] Finalize all vendor Data Processing Agreements (DPAs)

**Month 7–12**
- [ ] Complete SOC 2 Type II audit and publish report
- [ ] Achieve HIPAA compliance (if needed)
- [ ] Annual GDPR compliance review
- [ ] Conduct penetration testing (external)
- [ ] Update all compliance documentation

---

## Appendix A: Checklist for Enterprise Sales

**Compliance & Legal Checklist for Enterprise Deals**

When selling to enterprise customers, provide:

- [ ] Current SOC 2 Type II report (or timeline)
- [ ] Data Processing Agreement (DPA) signed
- [ ] Service Level Agreement (SLA) with uptime guarantees
- [ ] Incident Response SLA (24–48 hour notification)
- [ ] Liability limitation (capped at fees paid)
- [ ] Governing law and jurisdiction clauses
- [ ] Insurance certificates (cyber, general liability)
- [ ] Vendor assessment questionnaire (filled out)
- [ ] Security & compliance overview (presentation/whitepaper)
- [ ] Reference customers (if available)

**For HIPAA customers, add:**
- [ ] Business Associate Agreement (BAA) signed
- [ ] HIPAA compliance documentation
- [ ] Encryption certificates (AES-256)
- [ ] Audit log capabilities demonstration
- [ ] Data retention & deletion verification

---

**Document Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Last Review**: May 3, 2026  
**Next Review**: August 3, 2026 (quarterly compliance review)

