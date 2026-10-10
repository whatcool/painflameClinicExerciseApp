import { query, run } from './database';

export type Report = {
  id: number;
  title: string;
  reportDate: string; // YYYY-MM-DD
  doctorId: number;
  doctorName: string;
  fileUri: string;
  mimeType: string;
  fileName: string | null;
};

export type ReportInput = Omit<Report, 'id' | 'doctorName'>;

export function listReports(userId: number): Report[] {
  return query<{
    id: number;
    title: string;
    report_date: string;
    doctor_id: number;
    doctor_name: string;
    file_uri: string;
    mime_type: string;
    file_name: string | null;
  }>(
    `SELECT r.*, d.full_name AS doctor_name
     FROM reports r JOIN doctors d ON d.id = r.doctor_id
     WHERE r.user_id = ?
     ORDER BY r.report_date DESC, d.full_name COLLATE NOCASE, r.created_at`,
    [userId],
  ).map(row => ({
    id: row.id,
    title: row.title,
    reportDate: row.report_date,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    fileUri: row.file_uri,
    mimeType: row.mime_type,
    fileName: row.file_name,
  }));
}

export function addReport(userId: number, input: ReportInput) {
  run(
    `INSERT INTO reports (user_id, title, report_date, doctor_id, file_uri, mime_type, file_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.title,
      input.reportDate,
      input.doctorId,
      input.fileUri,
      input.mimeType,
      input.fileName,
      new Date().toISOString(),
    ],
  );
}

export function deleteReport(userId: number, reportId: number) {
  run('DELETE FROM reports WHERE id = ? AND user_id = ?', [reportId, userId]);
}

export type DoctorGroup = { doctorId: number; doctorName: string; reports: Report[] };
export type DateGroup = { date: string; doctors: DoctorGroup[] };

/** Groups by date (newest first), then one group per issuing doctor within each date. */
export function groupReports(reports: Report[]): DateGroup[] {
  const byDate = new Map<string, Map<number, DoctorGroup>>();
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
