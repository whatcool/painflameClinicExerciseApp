import { MONTHS, type Doctor } from './types';

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * How a doctor is shown in dropdowns and tables. Doctors may share a name, so when
 * another doctor has the same name the contact number and start date are added.
 */
export function doctorLabel(doctor: Doctor, all: Doctor[]) {
  const duplicate = all.some(d => d.id !== doctor.id && sameName(d.full_name, doctor.full_name));
  if (!duplicate) {
    return doctor.full_name;
  }
  const since = `${MONTHS[doctor.start_month - 1].slice(0, 3)} ${doctor.start_year}`;
  return `${doctor.full_name} · ${doctor.contact} · since ${since}`;
}
