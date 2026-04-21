# Routing Architecture

## Flow
issue → gate → route → deeper route → results

---

## Primary routes
- thermostat_control_diag
- indoor_unit_diag
- outdoor_unit_diag
- airflow_restriction_diag
- refrigeration_diag

---

## Secondary routes
- compressor_diag
- blower_diag
- board_control_diag
- safety_open_diag
- low_voltage_diag

---

## Equipment-aware routing (NEW)

If equipment scan detects:
- inverter system → bias inverter route
- known faulty model → increase confidence weight

BUT:
never override real inputs

---

## Example

No cooling  
+ indoor running  
+ outdoor off  
→ outdoor_unit_diag  

Then  
fan running + compressor not  
→ compressor_diag