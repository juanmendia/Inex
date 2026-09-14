/** Licencias habituales LCT / práctica de empresa. RRHH puede agregar más. */

export const LEAVE_CATALOG: {
  code: string;
  name: string;
  employee_can_request: boolean;
  requires_certificate: boolean;
  sort: number;
}[] = [
  { code: "vacation", name: "Licencia ordinaria (vacaciones)", employee_can_request: true, requires_certificate: false, sort: 10 },
  { code: "sick", name: "Enfermedad inculpable", employee_can_request: true, requires_certificate: true, sort: 20 },
  { code: "child_illness", name: "Enfermedad de hijo/a o familiar a cargo", employee_can_request: true, requires_certificate: true, sort: 25 },
  { code: "work_accident", name: "Accidente de trabajo / ART", employee_can_request: true, requires_certificate: true, sort: 30 },
  { code: "maternity", name: "Maternidad", employee_can_request: true, requires_certificate: true, sort: 40 },
  { code: "prenatal", name: "Controles prenatales", employee_can_request: true, requires_certificate: true, sort: 45 },
  { code: "paternity", name: "Nacimiento / paternidad", employee_can_request: true, requires_certificate: false, sort: 50 },
  { code: "adoption", name: "Adopción", employee_can_request: true, requires_certificate: true, sort: 55 },
  { code: "breastfeeding", name: "Lactancia", employee_can_request: true, requires_certificate: false, sort: 60 },
  { code: "marriage", name: "Matrimonio", employee_can_request: true, requires_certificate: true, sort: 70 },
  { code: "bereavement", name: "Fallecimiento de familiar", employee_can_request: true, requires_certificate: false, sort: 80 },
  { code: "exam", name: "Examen / estudio", employee_can_request: true, requires_certificate: true, sort: 90 },
  { code: "blood", name: "Donación de sangre", employee_can_request: true, requires_certificate: true, sort: 100 },
  { code: "menstrual", name: "Día femenino / menstrual", employee_can_request: true, requires_certificate: false, sort: 110 },
  { code: "gender_violence", name: "Violencia de género", employee_can_request: true, requires_certificate: false, sort: 120 },
  { code: "move", name: "Mudanza", employee_can_request: true, requires_certificate: false, sort: 130 },
  { code: "court", name: "Citación judicial o trámite", employee_can_request: true, requires_certificate: true, sort: 140 },
  { code: "union", name: "Licencia gremial", employee_can_request: true, requires_certificate: false, sort: 150 },
  { code: "personal", name: "Asuntos particulares", employee_can_request: true, requires_certificate: false, sort: 160 },
  { code: "unpaid", name: "Licencia sin goce de sueldo", employee_can_request: true, requires_certificate: false, sort: 170 },
  { code: "leave", name: "Otra licencia", employee_can_request: true, requires_certificate: false, sort: 180 },
  { code: "company_off", name: "Día no laboral (empresa)", employee_can_request: false, requires_certificate: false, sort: 900 },
  { code: "unjustified", name: "Falta injustificada", employee_can_request: false, requires_certificate: false, sort: 910 },
];
