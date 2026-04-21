# AGENTS.md

## Repository purpose
SERVMORX TECH is a field-first HVAC diagnostic application designed to help technicians diagnose systems faster using structured logic, adaptive routing, and equipment-aware context.

The field app is the current priority. CRM functionality is secondary and will be integrated later.

---

## Core product thesis
This product must feel like a senior field tech guiding another tech.

It is NOT:
- a generic chatbot
- a static symptom checker
- a pressure-only tool
- a giant form-based app

It IS:
- a diagnostic router
- a field decision tool
- a structured reasoning system

---

## UX rules
- Mobile-first (iPhone priority)
- Dark theme
- Large touch targets
- Minimal typing
- Fast tap flow
- Support "Not sure" and "Not measured"
- Avoid dense screens
- Ask only relevant questions
- Progressive flow only

---

## Diagnostic flow model
symptom  
→ gate questions  
→ subsystem routing  
→ focused UI  
→ deeper narrowing  
→ ranked causes  
→ confirming tests  

Do NOT collect all inputs upfront.

---

## Routing philosophy
Routing only needs subsystem certainty, not final diagnosis.

Example:
No cooling + indoor running + outdoor not running → outdoor_unit_diag

Later:
fan running + compressor not running → compressor_diag

System must support SECONDARY ROUTE SWAPS.

---

## MVP issue lanes
- No Cooling
- Weak Cooling
- No Airflow
- Weak Airflow
- Icing / Frozen Coil
- System Not Doing Anything
- Short Cycling
- Other

---

## MVP routes
Phase 1:
- thermostat_control_diag
- indoor_unit_diag
- outdoor_unit_diag
- airflow_restriction_diag
- refrigeration_diag

Phase 2+:
- low_voltage_diag
- line_voltage_diag
- safety_open_diag
- blower_diag
- compressor_diag
- condenser_fan_diag
- board_control_diag
- heatpump_defrost_diag
- inverter_drive_diag
- communicating_system_diag
- fault_code_diag

---

## Equipment scanning + enrichment (NEW CORE FEATURE)

The app MUST support:

### Equipment intake methods
- Manual system selection
- Manual model entry
- Scan data tag (camera)

### Scan extraction
Extract:
- brand
- model number
- serial number
- unit type
- system type (if possible)

### API enrichment layer
Based on brand:
- call manufacturer/spec API (if available)
- call warranty API (if available)

Store:
- specData
- warrantyStatus
- warrantyDetails
- commonFaults (if available)

---

## Critical rule for enrichment
API data MUST NOT override field logic.

Use it to:
- enrich reasoning
- improve confidence
- provide context

NOT to:
- blindly determine diagnosis

---

## Session philosophy
Field app = temporary working memory  
CRM = permanent storage  

Default:
- 30-day rolling retention for unsaved sessions

Permanent:
- saved_to_crm sessions
- linked job/customer sessions

---

## Session states
- draft
- active
- completed
- saved_to_crm
- expired

---

## Architecture rules
- modular routing system
- config-driven flows preferred
- separate:
  - intake
  - routing
  - subsystem logic
  - results generation
- reusable UI components
- strong typing
- scalable route system

Avoid:
- nested if/else logic
- tightly coupled UI + logic
- hardcoded flows

---

## Engineering priorities
1. Field UX speed
2. Routing correctness
3. Expandability
4. Clean architecture

---

## Non-goals (MVP)
- full CRM
- invoicing
- payroll
- inventory
- analytics dashboards
- hardware sync
- full commercial coverage

---

## Build order
1. Home
2. System Type
3. Split System follow-up
4. Issue Selection
5. Session store
6. Route resolver
7. No Airflow flow
8. No Cooling flow
9. Results screen
10. Save/CRM attach

---

## Absolute rule
Always prioritize:
- speed
- clarity
- correct routing

Over:
- feature count
- extra inputs
- UI complexity