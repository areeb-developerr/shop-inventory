import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { todayISO, formatDate } from "../lib/format";
import { PageHeader, Loading, ErrorBox, Modal, Input } from "../components/shared";

export default function Reports() {
  const [date, setDate] = useState(todayISO());
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");

  const { data: reports, loading, error, reload } = useAsync(() => api.reports.list(), []);

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

  const viewReport = async (reportDate) => {
    const html = await api.reports.html(reportDate);
    setPreview(html);
  };

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
      {msg && <div className="mb-4 text-sm text-emerald-600">{msg}</div>}

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
                    <button className="text-sm text-emerald-600" onClick={() => viewReport(r.date)}>View</button>
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

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Report Preview" wide>
        {preview && (
          <iframe
            title="Report"
            srcDoc={preview}
            className="w-full h-[70vh] border border-slate-200 dark:border-slate-700 rounded-lg"
          />
        )}
      </Modal>
    </div>
  );
}
