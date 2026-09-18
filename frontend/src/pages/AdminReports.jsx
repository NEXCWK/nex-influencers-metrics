import React, { useState, useEffect } from 'react';
import api from '../api.js';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatDateFull(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [viewing, setViewing] = useState(null); // { html, ... } | null

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/reports');
      setReports(res.data?.reports || []);
      setMigrationPending(!!res.data?.migration_pending);
    } catch {
      setError('Erro ao carregar relatórios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerate = async () => {
    if (!window.confirm(
      'Gerar agora o relatório do mês passado completo?\n\n' +
      'Isso também tentará enviar por e-mail (só funciona se o envio já estiver configurado).'
    )) return;
    setGenerating(true);
    try {
      const res = await api.post('/admin/reports/generate', {});
      const emailInfo = res.data?.email;
      if (emailInfo?.sent) {
        alert('Relatório gerado e enviado por e-mail com sucesso!');
      } else {
        alert(
          'Relatório gerado com sucesso, mas o e-mail NÃO foi enviado.\n\n' +
          `Motivo: ${emailInfo?.reason || emailInfo?.error || 'desconhecido'}\n\n` +
          'Você pode visualizar o relatório na lista abaixo mesmo assim.'
        );
      }
      fetchReports();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao gerar o relatório.');
    } finally {
      setGenerating(false);
    }
  };

  const handleView = async (report) => {
    try {
      const res = await api.get(`/admin/reports/${report.id}`);
      setViewing(res.data?.report);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao carregar o relatório.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Relatório Mensal</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchReports}>Atualizar</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Gerando...' : 'Gerar relatório agora'}
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px 12px 16px', background: 'var(--accent-soft)',
        borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-sm)', marginBottom: 20,
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#7a5800', fontFamily: 'var(--font)', marginBottom: 2 }}>
            Envio automático
          </p>
          <p style={{ fontSize: 13, color: '#7a5800', fontFamily: 'var(--font)', fontWeight: 400 }}>
            Todo dia 05 do mês, o sistema gera automaticamente o relatório do mês anterior completo
            e tenta enviar para felipe@nex.work e luiza@nex.work (ou os destinatários configurados em
            MONTHLY_REPORT_RECIPIENTS). O envio por e-mail só funciona depois que um provedor SMTP for
            configurado no servidor — até lá, o relatório é gerado e fica disponível aqui para visualização.
          </p>
        </div>
      </div>

      {migrationPending && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          A tabela de relatórios ainda não existe no banco. Rode a migration 006_monthly_reports.sql no Supabase.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 240, borderRadius: 16 }} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Destinatários</th>
                <th>Status</th>
                <th>Gerado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: 32 }}>
                    Nenhum relatório gerado ainda.
                  </td>
                </tr>
              ) : reports.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{MONTHS[r.report_month - 1]} de {r.report_year}</td>
                  <td style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{(r.recipients || []).join(', ')}</td>
                  <td>
                    {r.sent ? (
                      <span className="badge badge-success">Enviado</span>
                    ) : (
                      <span className="badge badge-warning" title={r.send_error || ''}>Não enviado</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{formatDateFull(r.generated_at)}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleView(r)}>Visualizar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal-card" style={{ maxWidth: 720, width: '100%' }}>
            <div className="modal-header">
              <h2 className="modal-title">{MONTHS[viewing.report_month - 1]} de {viewing.report_year}</h2>
              <button className="modal-close" onClick={() => setViewing(null)}>×</button>
            </div>
            <iframe
              title="Relatório mensal"
              srcDoc={viewing.html}
              style={{ width: '100%', height: '65vh', border: '1px solid var(--border)', borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
