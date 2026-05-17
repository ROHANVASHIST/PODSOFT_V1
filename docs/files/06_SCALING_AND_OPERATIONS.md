# PodSoft — Scaling & SaaS Business Operations Guide

**Version:** 2.0  
**Status:** Production Ready  
**Last Updated:** May 2026  
**Audience:** Founders, Finance, Operations, Product Leaders  
**Document Owner:** CEO / Business Lead

---

## 1. SaaS Metrics & KPIs Framework

### 1.1 Core SaaS Metrics

**Monthly Recurring Revenue (MRR)**
```
MRR = Σ (paying users in month × plan price)
Example: 1,000 Pro users × $50 + 200 Studio users × $200 = $90K MRR
```

**Annual Recurring Revenue (ARR)**
```
ARR = MRR × 12
Example: $90K MRR × 12 = $1.08M ARR
```

**Customer Acquisition Cost (CAC)**
```
CAC = Sales & Marketing Spend / New Customers Acquired
Target: <$50 (break-even on Pro tier = 13 months)
```

**Lifetime Value (LTV)**
```
LTV = ARPU × Gross Margin % × (1 / Monthly Churn Rate)
Example: $90 ARPU × 85% GM × (1 / 5% churn) = $1,530
```

**LTV:CAC Ratio**
```
LTV:CAC = $1,530 / $50 = 30.6:1 ✅ (Target >3:1)
```

**Monthly Churn Rate**
```
Churn% = (Churned Customers in Month / Start of Month Customers) × 100
Target: <5% (implies 20-month average customer lifetime)
```

**Payback Period**
```
Payback = CAC / (ARPU × Gross Margin%)
Example: $50 / ($90 × 85%) = 0.65 months ✅ (Very fast)
```

### 1.2 Cohort-Based Metrics

Track per-cohort to identify trends:

```
Cohort Analysis (monthly cohorts):
┌─────────────┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬────┐
│ Month       │ M0│ M1│ M2│ M3│ M4│ M5│ M6│ M7│ M8│ M9│ M12│
├─────────────┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼────┤
│ Jan Cohort  │100│ 95│ 90│ 88│ 85│ 82│ 80│ 78│ 77│ 75│ 70 │
│ Feb Cohort  │125│115│105│100│ 96│ 93│ 91│ 90│ 89│ 88│    │
│ Mar Cohort  │150│140│132│128│124│120│ 18│    │    │    │    │
└─────────────┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴────┘

Key insights:
- Jan cohort shows 30% 12-month retention (benchmark)
- Feb cohort shows improvement (24% retention so far)
- Mar cohort still early to assess
```

### 1.3 Unit Economics Dashboard

```
Daily Unit Economics (as of May 3, 2026):
┌────────────────────────────────────────┬──────────────┐
│ Metric                                 │ Value        │
├────────────────────────────────────────┼──────────────┤
│ Total Customers                        │ 1,250        │
│   • Free                              │ 1,000 (80%)  │
│   • Pro                               │ 200 (16%)    │
│   • Studio                            │ 40 (3%)      │
│   • Enterprise                        │ 10 (1%)      │
├────────────────────────────────────────┼──────────────┤
│ MRR                                    │ $16,500      │
│ ARR                                    │ $198,000     │
│ ARPU (Average Revenue Per User)        │ $13.20       │
│ ARPC (Average Revenue Per Customer)    │ $16.50       │
├────────────────────────────────────────┼──────────────┤
│ Gross Margin                           │ 85%          │
│ Gross Profit Monthly                   │ $14,025      │
├────────────────────────────────────────┼──────────────┤
│ Monthly Burn (Opex)                    │ $80,000      │
│ Runway (months)                        │ 6 months     │
├────────────────────────────────────────┼──────────────┤
│ Customer Acquisition Cost (CAC)        │ $45          │
│ Payback Period                         │ 0.5 months   │
│ Lifetime Value (LTV)                   │ $1,450       │
│ LTV:CAC Ratio                          │ 32:1 ✅      │
├────────────────────────────────────────┼──────────────┤
│ Monthly Churn Rate                     │ 3.2%         │
│ Estimated LTV (months)                 │ 31 months    │
│ Free-to-Paid Conversion                │ 12%          │
│ Pro-to-Studio Upgrade Rate             │ 8%           │
└────────────────────────────────────────┴──────────────┘
```

---

## 2. Pricing Strategy & Monetization

### 2.1 Tier Analysis

**Free Tier Analysis**
- **Purpose**: Acquire users, identify Product-Market Fit, viral coefficient
- **Limits**: 5 sessions/month, 10 GB storage, 10 hours processing
- **Conversion Goal**: 12% → Pro (aggressive, typical SaaS = 2-5%)
- **Willingness**: Test if restrictions drive upgrades or churn

**Pro Tier Analysis**
- **Price**: $50/month (competitive vs. Riverside $600, Descript $12)
- **Target**: Independent creators, small podcasts
- **LTV**: $50 × 85% × (1/0.05) = $850
- **Expansion**: 8% upgrade to Studio (good signal)

**Studio Tier Analysis**
- **Price**: $200/month (4x Pro, similar to Riverside)
- **Target**: 3-5 person teams, professional creators
- **Features**: Team workspaces, unlimited processing, API access
- **LTV**: $200 × 85% × (1/0.05) = $3,400

**Enterprise Tier Analysis**
- **Price**: $500–5,000/month (custom)
- **Target**: Corporate training, media companies, agencies
- **Expansion Potential**: 40–60% of long-term revenue
- **CAC**: $5K–50K (sales effort)
- **LTV**: $5K × 85% × 24 months = $102K (2-year contract)

### 2.2 Expansion & Upgrade Strategy

```
Expansion Revenue Opportunities:

1. Usage-Based Pricing (add-on to tiers)
   - Storage overage: $5/TB/month
   - Processing overage: $50/100 hours
   - Premium templates: $10–50 each
   
2. Annual Payment Discount
   - 15% discount for annual prepay
   - Improve cash flow, reduce churn
   
3. Feature Unlocks
   - White-label: +$200/month
   - Custom branding: +$100/month
   - Priority support: +$50/month
   - Dedicated account manager: +$500/month (Enterprise only)
   
4. Integrations & Marketplace
   - Zapier integration: -5% revenue share
   - Template marketplace: -30% revenue share
   - Plugin marketplace: -40% revenue share

Expansion Revenue Target:
- Month 6: 0% of revenue (foundation)
- Month 12: 15% of revenue ($30K MRR)
- Month 18: 25% of revenue ($500K MRR)
```

### 2.3 Discount Policy

```
Discount Guidelines (avoid race to bottom):

✅ ALLOWED:
- Annual payment discount: 15% max
- Volume discount (50+ seats): 10% max
- Non-profit discount: 25%
- Educational discount: 40%

❌ PROHIBITED:
- Percentage-off promotions (ad chasing)
- Competitor matching (erodes margin)
- Introductory rates (hard to raise later)
- Free trial beyond 14 days

Default Policy:
- Special offers require CEO approval
- Non-profit/edu approved by ops
- Volume deals >$10K/month need close review
- Track all discounts for cohort analysis
```

---

## 3. Unit Economics & Cohort Analysis

### 3.1 30-Day Cohort Analysis (May 2026)

```
Week 1 Users: 50 new signups
├─ Onboarded: 45 (90%)
├─ Created session: 38 (76%)
├─ Completed recording: 32 (64%)
├─ Converted to Pro: 4 (8%)
└─ Converted to Studio: 0 (0%)

Week 2 Users: 55 new signups
├─ Onboarded: 50 (91%)
├─ Created session: 44 (80%)
├─ Completed recording: 38 (69%)
├─ Converted to Pro: 5 (9%)
└─ Converted to Studio: 0 (0%)

Week 3 Users: 62 new signups
├─ Onboarded: 58 (94%)
├─ Created session: 52 (84%)
├─ Completed recording: 45 (73%)
├─ Converted to Pro: 6 (10%)
└─ Converted to Studio: 1 (2%)

Week 4 Users: 48 new signups (lower, weekend effect)
├─ Onboarded: 44 (92%)
├─ Created session: 38 (79%)
├─ Completed recording: 33 (69%)
├─ Converted to Pro: 3 (6%)
└─ Converted to Studio: 0 (0%)

30-Day Cohort Totals:
├─ New Signups: 215
├─ Converted to Paid: 18 (8.4% conversion)
├─ Revenue: 15 Pro × $50 + 3 Studio × $200 = $1,350
├─ MRR Contribution: $1,350 × (1 - 3.2% churn × 12 mo) = $1,180/month
└─ CAC Payback: <1 month ✅
```

---

## 4. Growth Roadmap & Scaling Plan

### 4.1 Growth Phases (18-Month Roadmap)

**Phase 1: Validation (Months 1–3)**
- Goal: Product-Market Fit, 5K users, 5% free-to-paid conversion
- Focus: Beta launch, community engagement, core product stability
- Marketing: Organic (Product Hunt, Reddit, Slack communities)
- Revenue: $10–50K MRR (50–200 paid users)
- Headcount: 5–8 (core team)

**Phase 2: Growth (Months 4–9)**
- Goal: 50K users, 10% free-to-paid conversion, 100K MRR
- Focus: Feature completeness (mobile, live streaming, templates)
- Marketing: Paid ads + organic + influencer partnerships
- Revenue: $100–500K MRR (5K–10K paid users)
- Headcount: 15–25 (add sales, ops, support)

**Phase 3: Scale (Months 10–18)**
- Goal: 100K+ users, 12% free-to-paid conversion, 1M+ ARR
- Focus: Enterprise sales, international, partnerships
- Marketing: Brand, partnerships, ABM (account-based marketing)
- Revenue: $500K–2M MRR (20K–50K paid users)
- Headcount: 40–60 (full sales, customer success, product)

### 4.2 Acquisition Channels & CAC by Channel

```
Channel CAC Analysis (Month 6 Target):

Channel              │ CAC    │ LTV   │ LTV:CAC │ % of Signups
─────────────────────┼────────┼───────┼─────────┼──────────────
Organic (SEO, Viral)│ $10    │ $850  │ 85:1    │ 40% (target)
Product Hunt        │ $20    │ $850  │ 42:1    │ 20% (burst)
Influencer/Creator  │ $25    │ $1000 │ 40:1    │ 15% (partnership)
Paid Ads (Google)   │ $40    │ $850  │ 21:1    │ 15% (efficient)
Affiliates          │ $15    │ $900  │ 60:1    │ 5% (revenue share)
──────────────────────────────────────────────────────────────
Blended CAC         │ $21.50 │ $870  │ 40:1    │ 100%

Action Items:
✅ Double down on organic (best CAC)
✅ Maintain Product Hunt relationships (burst growth)
✅ Test influencer partnerships (high LTV)
⚠️ Optimize paid ads (currently above-break-even)
⚠️ Build affiliate program (scale at low cost)
```

---

## 5. Operational Metrics & Health Dashboard

### 5.1 Weekly Operations Review Template

```
Week of May 3, 2026 — Operations Review

GROWTH METRICS
├─ New Signups: 215 (target: 200) ✅
├─ Free-to-Paid Conversion: 8.4% (target: 8%) ✅
├─ Active Users: 2,150 (30-day active users)
├─ Paid Users: 250 (target: 250) ✅
├─ MRR: $16,500 (target: $15,000) ✅
└─ Churn Rate: 3.2% (target: <5%) ✅

ENGAGEMENT METRICS
├─ Avg Sessions per User: 2.3 (target: 3.0)
├─ Avg Recording Duration: 34 min (target: 45 min)
├─ Chunk Upload Success Rate: 99.2% (target: >99%) ✅
├─ Processing Completion Rate: 98.5% (target: >99%) ⚠️
└─ Feature Adoption:
    ├─ Live Streaming: 12% of paid users
    ├─ Clip Maker: 5% of paid users
    └─ Team Workspaces: 3% of Studio users

PRODUCT QUALITY
├─ API Uptime: 99.97% (target: 99.95%) ✅
├─ P95 Latency: 380ms (target: <500ms) ✅
├─ Error Rate: 0.08% (target: <0.1%) ✅
├─ Sync Accuracy: 99.7% (target: >99.5%) ✅
└─ Support Tickets: 18 open (target: <10) ⚠️

FINANCIAL HEALTH
├─ Monthly Burn: $80K
├─ Runway: 6 months (target: >6 months) ✅
├─ Gross Margin: 85% (target: 80%) ✅
├─ CAC: $45 (target: <$50) ✅
└─ LTV:CAC: 32:1 (target: >3:1) ✅

TEAM HEALTH
├─ Headcount: 8
├─ Open Positions: 2 (frontend eng, customer support)
├─ Attrition YTD: 0% (target: <15% annually) ✅
└─ Engineer Productivity: 1.2 features/person/week (on track)

RISKS & ACTIONS
├─ ⚠️ Processing queue backlog growing (add workers +5)
├─ ⚠️ Support response time at 6 hours (hire support agent)
├─ ✅ No major technical incidents
└─ ✅ No major churn events

Next Week Goals:
1. Launch live streaming beta (on schedule)
2. Onboard first Studio tier customer (pipeline: 3)
3. Publish 3 creator case studies (content strategy)
4. Optimize processing pipeline (ops priority)
```

### 5.2 Monthly Board Metrics

```
Monthly Metrics Template (for investors/board):

HIGHLIGHTS
✅ Month-over-month signups: +15% WoW
✅ Conversion rate: 8.4% (above industry 2-5%)
✅ Customer acquisition cost: $45 (highly efficient)
✅ Launched live streaming feature (beta)

LOWLIGHTS
⚠️ Processing queue backlog at 45 minutes (target: <5 min)
⚠️ Support response time: 6 hours (target: 2 hours)
⚠️ One major customer (5K MRR equivalent) considering churn

KEY METRICS
┌────────────────────────────────────┬─────────────┬──────────┐
│ Metric                             │ This Month  │ Target   │
├────────────────────────────────────┼─────────────┼──────────┤
│ Monthly Recurring Revenue (MRR)    │ $16,500     │ $15,000  │
│ Annual Recurring Revenue (ARR)     │ $198,000    │ $180,000 │
│ New Customers (MRR basis)          │ $2,500      │ $2,000   │
│ Churned Customers (MRR basis)      │ $550        │ <$800    │
│ Net New MRR                        │ $1,950      │ $1,200   │
│ Gross Margin                       │ 85%         │ 80%      │
│ Customers (total)                  │ 250 paid    │ 250      │
│ Free Users (30-day active)         │ 1,900       │ 1,800    │
│ Free-to-Paid Conversion            │ 8.4%        │ 8%       │
│ Monthly Churn Rate                 │ 3.2%        │ 5%       │
│ LTV:CAC Ratio                      │ 32:1        │ >3:1     │
│ Runway (months)                    │ 6.0         │ >6.0     │
└────────────────────────────────────┴─────────────┴──────────┘

SEGMENT BREAKDOWN
┌──────────────────────────────────────────────┐
│ Revenue by Segment                           │
├──────────────────────────────────────────────┤
│ Pro Tier ($50/mo)        │ $10,000 (61%)     │
│ Studio Tier ($200/mo)    │ $4,000 (24%)      │
│ Enterprise (custom)      │ $2,500 (15%)      │
├──────────────────────────────────────────────┤
│ Total MRR                │ $16,500 (100%)    │
└──────────────────────────────────────────────┘

SEGMENT BREAKDOWN (Users)
┌──────────────────────────────────────────────┐
│ Customers by Segment                         │
├──────────────────────────────────────────────┤
│ Pro Tier                 │ 200 users (80%)   │
│ Studio Tier              │ 40 users (16%)    │
│ Enterprise               │ 10 users (4%)     │
├──────────────────────────────────────────────┤
│ Total Paid Customers     │ 250 users         │
│ Free Users (30-day)      │ 1,900 users       │
│ Total Active Users       │ 2,150 users       │
└──────────────────────────────────────────────┘

PRODUCT METRICS
- Daily Active Users: 680 (39% of free users)
- Sessions per Active User: 2.3 (trending up)
- Avg Session Length: 34 minutes
- Feature Adoption:
  ├─ Live Streaming: 12% of paid users
  ├─ Clip Maker: 5% of paid users
  └─ Team Workspaces: 3% of Studio users

PIPELINE & FORECAST
- Monthly Runway at Current Burn: 6 months
- Expected Series A Close: Month 6 ($2M–5M)
- Forecast for Month 12:
  ├─ MRR: $200,000 (12x growth from seed)
  ├─ ARR: $2,400,000
  ├─ Paid Customers: 2,000
  ├─ Free Users: 50,000
  └─ Burn Rate: $50K/month (net positive with Series A)
```

---

## 6. Hiring & Team Scaling

### 6.1 Hiring Plan & Compensation

**Founding Team (Month 0)**
| Role | Title | Salary | Equity | Notes |
|------|-------|--------|--------|-------|
| CTO | Co-founder | $0 (equity only) | 10% | |
| CEO/PM | Co-founder | $0 (equity only) | 10% | |
| Engineer 1 | Full-Stack | $150K | 0.5% | |
| Engineer 2 | Backend | $140K | 0.5% | |

**Month 1–3 Hires**
| Role | Title | Salary | Equity | Timeline |
|------|-------|--------|--------|----------|
| Engineer 3 | Frontend | $140K | 0.3% | Month 1 |
| Engineer 4 | Mobile | $150K | 0.3% | Month 2 |
| Designer | Product Design | $120K | 0.2% | Month 3 |

**Month 4–6 Hires**
| Role | Title | Salary | Equity | Timeline |
|------|-------|--------|--------|----------|
| Sales | Account Executive | $80K + $40K commission | 0.1% | Month 4 |
| Marketing | Growth | $100K | 0.1% | Month 4 |
| Support | Customer Success | $70K | 0.05% | Month 5 |
| Ops | Operations | $90K | 0.1% | Month 6 |

**Total Compensation by Month:**
```
Month 0–3:  $580K salary (5 people)
Month 4–6:  $820K salary (9 people)
Month 7–12: $1,200K salary (15 people)
```

### 6.2 Roles & Responsibilities

**Engineering Team Growth**
- Month 0: 2 engineers (backend + full-stack)
- Month 3: 4 engineers (+ frontend + mobile)
- Month 6: 6 engineers (+ infrastructure, QA)
- Month 12: 12 engineers (parallel feature streams)

**Sales & Growth Team Growth**
- Month 0: Founders do sales
- Month 4: 1 AE (enterprise focus)
- Month 6: 1 growth marketer
- Month 9: 2 more AEs (SMB focus)
- Month 12: VP Sales, 4 AEs, 1 SDR

**Support & Operations**
- Month 0: Founder does support (email)
- Month 3: Part-time support contractor
- Month 6: Full-time support + ops
- Month 12: 2 support, 1 ops, 1 CS manager

---

## 7. Path to Profitability & Sustainability

### 7.1 Break-Even Analysis

```
Monthly Operating Expenses (Month 12 Projection):

Fixed Costs:
├─ Salaries & Benefits (15 people @ $80K avg): $100,000
├─ Infrastructure (AWS, data): $15,000
├─ Tools & Software: $5,000
├─ Office/Facilities: $8,000
├─ Legal & Compliance: $3,000
└─ Subtotal Fixed: $131,000

Variable Costs (COGS):
├─ S3 Storage: 0.023 × 2,000 GB: $46
├─ Bandwidth: 0.085 × 100 GB: $8.5
├─ Processing (Whisper API): 0.10 × 1,000 hours: $100
└─ Subtotal Variable (per month): $154.50

Total Monthly OpEx: $131,000
Gross Margin on Revenue: 85%

Break-Even MRR = OpEx / Gross Margin
                = $131,000 / 0.85
                = $154,118

Current MRR (Month 6):    $16,500
Target MRR (Month 12):    $200,000 ✅
Break-Even MRR Target:    $154,118

Profitability Timeline:
- Month 9: Approaching break-even
- Month 12: Likely profitable with Series A funding
- Month 18: Strongly profitable, can self-fund growth
```

### 7.2 Funding Requirements & Use of Funds

**Seed Round** ($500K–$1M)
```
Use of Funds:
├─ Team (salary, hiring): 50% = $500K
│  └─ Hire 3 engineers, designer, ops
├─ Product Development: 20% = $200K
│  └─ Mobile app, live streaming, templates
├─ Infrastructure & Ops: 15% = $150K
│  └─ AWS, security, monitoring, deployments
├─ Marketing & Growth: 10% = $100K
│  └─ Community, content, early campaigns
└─ Contingency: 5% = $50K

Runway at $80K/month burn: 12–15 months
```

**Series A** ($2M–$5M, Month 6)
```
Use of Funds:
├─ Sales & Marketing: 40% = $2M
│  └─ Sales team (2 AEs + SDR), paid ads
├─ Product & Engineering: 35% = $1.75M
│  └─ Team growth, enterprise features, API platform
├─ Operations & Infrastructure: 15% = $750K
│  └─ Scale infrastructure, compliance, analytics
└─ Contingency: 10% = $500K

Runway at $150K/month burn: 20+ months
```

**Series B** ($5M–$15M, Month 12)
```
Use of Funds:
├─ Sales & Marketing: 50% = $7.5M (of $15M)
│  └─ Enterprise sales team, brand campaigns
├─ Product & Engineering: 30% = $4.5M
│  └─ Marketplace, integrations, AI features
├─ Ops & International: 15% = $2.25M
│  └─ Multiple regions, compliance, support
└─ Contingency: 5% = $750K

Profitability Timeline: Month 18–24
```

---

## 8. Risk & Mitigation Playbook

### 8.1 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Competitor Price Wars** | High | High | Differentiate on ease/features, not price; focus on SMB segment |
| **Churn Spike** | Medium | High | NPS tracking, feature adoption monitoring, dedicated CS |
| **Low ARPU** | Medium | Medium | Upgrade to Studio tier, expansion revenue (add-ons), partnerships |
| **Sales Motion Slower than Expected** | Medium | High | Hire experienced sales leader early, focus on self-serve first |
| **Regulation (GDPR, etc.)** | Medium | Medium | Proactive compliance, insurance, dedicated compliance officer |

### 8.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Processing Pipeline Bottleneck** | Medium | Medium | Auto-scaling workers, priority queues, SLA guarantees |
| **Database Performance Degradation** | Low | High | Multi-AZ setup, read replicas, performance testing |
| **Key Engineer Departure** | Low | High | Competitive equity, good culture, documented processes |
| **Customer Data Breach** | Low | Critical | Security audits, encryption, cyber insurance, incident response plan |

---

## 9. Financial Projections (18 Months)

### 9.1 Revenue Projection

```
Month   Signups  Paid Users  Free Users  MRR       ARR
────────────────────────────────────────────────────────
1       200      8          192         $850      $10,200
2       240      18         430         $2,100    $25,200
3       280      32         678         $4,200    $50,400
4       320      52         950         $7,200    $86,400
5       380      78         1,308       $11,000   $132,000
6       420      110        1,628       $15,000   $180,000  ← Seed milestone
7       500      160        1,968       $22,000   $264,000
8       580      220        2,328       $31,000   $372,000
9       650      290        2,688       $42,000   $504,000
10      720      375        3,033       $55,000   $660,000
11      800      475        3,358       $70,000   $840,000
12      900      600        3,658       $90,000   $1,080,000  ← Series A milestone
13      1000     750        4,908       $115,000  $1,380,000
14      1100     930        5,978       $145,000  $1,740,000
15      1200     1,140      6,838       $180,000  $2,160,000
16      1300     1,380      7,558       $220,000  $2,640,000
17      1400     1,650      8,150       $265,000  $3,180,000
18      1500     2,000      8,650       $320,000  $3,840,000  ← Series B milestone

Key Assumptions:
- Free-to-paid conversion: 8–12% (ramping)
- Monthly churn: 3–5% (improving with NPS)
- Average customer tenure: 20–33 months
- LTV:CAC ratio: 30:1 (highly profitable)
```

### 9.2 P&L Projection

```
                Month 6  Month 12  Month 18
────────────────────────────────────────────
REVENUE
MRR             $15,000  $90,000   $320,000
ARR             $180K    $1.08M    $3.84M

COGS
Infrastructure  $4,000   $12,000   $25,000
Processing      $2,000   $8,000    $15,000
─────────────────────────────────────────
Total COGS      $6,000   $20,000   $40,000
Gross Profit    $9,000   $70,000   $280,000
Gross Margin %  60%      78%       88%

OPERATING EXPENSES
Salaries        $50,000  $100,000  $150,000
Marketing       $15,000  $40,000   $80,000
Infrastructure  $5,000   $10,000   $15,000
G&A            $8,000   $15,000   $20,000
─────────────────────────────────────────
Total OpEx      $78,000  $165,000  $265,000

EBITDA          -$69,000 -$95,000  $15,000
EBITDA Margin   -460%    -105%     5%

CASH POSITION
Monthly Burn    $69,000  $95,000   (Positive)
Runway (months) 7.2      6.3       (Self-sustaining)
```

---

## 10. Success Metrics Tracking

### 10.1 Weekly Dashboard (automated)

```
Automated Slack Alerts (every Monday, 9 AM):

📊 PodSoft Weekly Metrics
├─ New Signups: 215 (+5% WoW)
├─ Paid Customers: 250 (+8 net new)
├─ MRR: $16,500 (+$1,350 WoW)
├─ API Uptime: 99.97% ✅
├─ Support Queue: 18 tickets (-2 from last week) ⚠️
├─ Churn: 3.2% (1 customer lost)
└─ Runway: 6.0 months ✅

Key Metrics Deep Dive:
├─ CAC: $45 (target: <$50) ✅
├─ LTV:CAC: 32:1 (target: >3:1) ✅
├─ Free-to-Paid Conversion: 8.4% (target: 8%) ✅
└─ Payback Period: 14 days (target: <30 days) ✅

⚠️ Alerts:
├─ Processing queue at 45 minutes (add 5 workers)
├─ Support response time at 6 hours (hire support)
└─ One customer at churn risk (call with CS team)
```

---

**Document Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Last Review**: May 3, 2026  
**Next Review**: August 3, 2026 (quarterly)

