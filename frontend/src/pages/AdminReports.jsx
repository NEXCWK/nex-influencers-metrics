import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { PageHeader, EmptyState, Skeleton, Modal, Spinner } from '../components/ui.jsx';
import { IconMail, IconRefresh, IconCalendar, IconAlert, IconEye } from '../components/Icons.jsx';
import { MONTHS, formatDateTime } from '../utils/format.js';

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [viewing, setViewing] = useState(null); // { html, ... } | null
  const [openingId, setOpeningId] = useState(null);

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
    setOpeningId(report.id);
    try {
      const res = await api.get(`/admin/reports/${report.id}`);
      setViewing(res.data?.report);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao carregar o relatório.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Relatório mensal"
        subtitle="Resumo de performance por influenciador, gerado a partir dos posts do mês anterior completo."
        actions={(
          <>
            <button type="button" className="btn btn-secondary" onClick={fetchReports} disabled={loading}>
              <IconRefresh size={14} /> Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? <><Spinner /> Gerando...</> : 'Gerar relatório agora'}
            </button>
          </>
        )}
      />

      <div className="alert alert-info">
        <IconCalendar size={16} />
        <span>
          <strong>Envio automático todo dia 05.</strong>{' '}
          O sistema gera o relatório do mês anterior e tenta enviar para felipe@nex.work e luiza@nex.work
          (ou os destinatários configurados em MONTHLY_REPORT_RECIPIENTS). O e-mail só sai depois que um
          provedor SMTP for configurado no servidor — até lá, o relatório fica disponível aqui.
        </span>
      </div>

      {migrationPending && (
        <div className="alert alert-error">
          <IconAlert size={16} />
          <span>A tabela de relatórios ainda não existe no banco. Rode a migration 006_monthly_reports.sql no Supabase.</span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <Skeleton height={260} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th className="hide-sm">Destinatários</th>
                <th>Status</th>
                <th className="hide-sm">Gerado em</th>
                <th className="num"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={<IconMail size={20} />}
                      title="Nenhum relatório gerado ainda"
                      text="Use “Gerar relatório agora” ou aguarde o envio automático do dia 05."
                    />
                  </td>
                </tr>
              ) : reports.map((r) => (
                <tr key={r.id}>
                  <td className="cell-title">{MONTHS[r.report_month - 1]} de {r.report_year}</td>
                  <td className="hide-sm muted" style={{ fontSize: 13 }}>{(r.recipients || []).join(', ') || '—'}</td>
                  <td>
                    {r.sent ? (
                      <span className="badge badge-success"><span className="dot" />Enviado</span>
                    ) : (
                      <span className="badge badge-warning" title={r.send_error || ''}><span className="dot" />Não enviado</span>
                    )}
                  </td>
                  <td className="hide-sm muted nowrap" style={{ fontSize: 13 }}>{formatDateTime(r.generated_at)}</td>
                  <td className="num">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleView(r)} disabled={openingId === r.id}>
                      {openingId === r.id ? <Spinner size={13} /> : <IconEye size={14} />} Visualizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <Modal
          title={`${MONTHS[viewing.report_month - 1]} de ${viewing.report_year}`}
          subtitle="Pré-visualização do e-mail do relatório"
          onClose={() => setViewing(null)}
          maxWidth={760}
        >
          <iframe
            title="Relatório mensal"
            srcDoc={viewing.html}
            style={{ width: '100%', height: '65vh', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: '#fff' }}
          />
        </Modal>
      )}
    </>
  );
}
