import { query, run, transaction } from './database';

export type Report = {
  id: string;
  title: string;
  reportDate: string; // YYYY-MM-DD
  doctorId: string;
  doctorName: string;
  filePath: string; // path in the private 'patient-files' bucket
  mimeType: string;
  fileName: string | null;
};

export function listReports(patientId: string): Report[] {
  return query<{
    id: string;
    title: string;
    report_date: string;
    doctor_id: string;
    doctor_name: string;
    file_path: string;
    mime_type: string;
    file_name: string | null;
  }>(
    `SELECT * FROM reports WHERE patient_id = ?
     ORDER BY report_date DESC, doctor_name COLLATE NOCASE, id`,
    [patientId],
  ).map(row => ({
    id: row.id,
    title: row.title,
    reportDate: row.report_date,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileName: row.file_name,
  }));
}

export function cacheReports(patientId: string, reports: Report[]) {
  transaction(() => {
    run('DELETE FROM reports WHERE patient_id = ?', [patientId]);
    for (const r of reports) {
      run(
        `INSERT INTO reports (id, patient_id, title, report_date, doctor_id, doctor_name,
           file_path, mime_type, file_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          patientId,
          r.title,
          r.reportDate,
          r.doctorId,
          r.doctorName,
          r.filePath,
          r.mimeType,
          r.fileName,
        ],
      );
    }
  });
}

export function removeCachedReport(reportId: string) {
  run('DELETE FROM reports WHERE id = ?', [reportId]);
}

export type DoctorGroup = { doctorId: string; doctorName: string; reports: Report[] };
export type DateGroup = { date: string; doctors: DoctorGroup[] };

/** Groups by date (newest first), then one group per issuing doctor within each date. */
export function groupReports(reports: Report[]): DateGroup[] {
  const byDate = new Map<string, Map<string, DoctorGroup>>();
  for (const report of reports) {
    let doctors = byDate.get(report.reportDate);
    if (!doctors) {
      doctors = new Map();
      byDate.set(report.reportDate, doctors);
    }
    let group = doctors.get(report.doctorId);
    if (!group) {
      group = { doctorId: report.doctorId, doctorName: report.doctorName, reports: [] };
      doctors.set(report.doctorId, group);
    }
    group.reports.push(report);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, doctors]) => ({ date, doctors: [...doctors.values()] }));
}
