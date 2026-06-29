import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { todayISO, formatDate } from "../lib/format";
import { PageHeader, Loading, ErrorBox, Modal, Input } from "../components/shared";
import ReportView from "../components/ReportView";

export default function Reports() {
  const [date, setDate] = useState(todayISO());
  const [viewReport, setViewReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");

  const { data: reports, loading, error, reload } = useAsync(() => api.reports.list(), []);
  const { data: todayReport } = useAsync(() => api.reports.get(todayISO()), []);

  const generate = async (targetDate) => {
    setGenerating(true);
    try {
      const result = await api.reports.generate(targetDate || date);
      setMsg(`Report generated for ${result.date}`);
      reload();
      api.sync.push().catch(() => {});
    } catch (err) {
      setMsg(err.message);
    } finally {
      setGenerating(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const openReport = async (reportDate) => {
    const report = await api.reports.get(reportDate);
    if (report?.summary) setViewReport(report.summary);
  };

  const handlePrint = () => window.print();

  if (loading && !reports) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Daily Reports"
        subtitle="End-of-day summary for sales, udhar, and balances"
        actions={
          <div className="toolbar">
            <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn-primary" disabled={generating} onClick={() => generate(date)}>
              {generating ? "Generating…" : "Generate Report"}
            </button>
            <button className="btn-secondary" onClick={() => generate(todayISO())}>
              Today
            </button>
          </div>
        }
      />
      {msg && <div className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">{msg}</div>}

      {todayReport?.summary && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Today&apos;s Summary</h2>
            <button type="button" className="text-sm text-emerald-600" onClick={() => setViewReport(todayReport.summary)}>
              Full report
            </button>
          </div>
          <ReportView summary={todayReport.summary} />
        </div>
      )}

      <div className="card">
        <div className="table-wrap border-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Generated</th>
                <th>Synced</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports?.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{formatDate(r.date)}</td>
                  <td>{new Date(r.generated_at).toLocaleString()}</td>
                  <td>{r.synced_at ? new Date(r.synced_at).toLocaleString() : "Pending"}</td>
                  <td>
                    <button type="button" className="text-sm text-emerald-600" onClick={() => openReport(r.date)}>View</button>
                  </td>
                </tr>
              ))}
              {!reports?.length && (
                <tr><td colSpan={4} className="text-center text-slate-500 py-8">No reports yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!viewReport} onClose={() => setViewReport(null)} title="Daily Report" wide>
        <ReportView summary={viewReport} onPrint={handlePrint} />
      </Modal>
    </div>
  );
}
