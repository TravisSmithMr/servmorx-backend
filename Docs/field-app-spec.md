# Field App Spec

## Design
- dark theme
- teal accent
- large cards
- fast UI
- minimal text

---

## Core screens

1. Home  
2. System Type  
3. Split System follow-up  
4. Issue Selection  
5. Adaptive routing  
6. Subsystem UI  
7. Results  

---

## Equipment Intake (UPDATED)

### Options:
- Select system manually
- Enter model manually
- Scan data tag

---

## Scan flow

User scans unit tag →

Extract:
- brand
- model
- serial
- unit type

Then:
- confirm/edit
- run API enrichment

---

## Enrichment results

Store:
- specData
- warrantyStatus
- warrantyDetails
- commonFaults

---

## UX rules
- scanning never blocks flow
- user can always override
- show confidence if uncertain