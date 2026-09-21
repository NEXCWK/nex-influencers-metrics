'use strict';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const ROLE_LABEL = {
  admin: 'Administrador',
  influencer: 'Influenciador',
  operacao: 'Operação',
};

/**
 * @param {object} params
 * @param {string} params.displayName
 * @param {string} params.username - login (pode ser o próprio e-mail)
 * @param {string} params.password - senha temporária
 * @param {string} params.role
 * @param {string} params.appUrl - URL do sistema para o botão de acesso
 */
function renderUserInviteEmailHtml({ displayName, username, password, role, appUrl }) {
  const roleLabel = ROLE_LABEL[role] || role;
  const scopeNote = role === 'operacao'
    ? '<p style="margin:0 0 16px 0;color:#3A3A3A;font-size:13px;">Seu acesso é restrito à aba <strong>Registro de Cupons</strong>.</p>'
    : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" style="background:#FAFAF7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" style="max-width:480px;width:100%;background:#FFFFFF;border:1px solid #ECEAE2;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0A0A0A;padding:20px 24px;">
          <div style="display:inline-block;background:#FFD400;color:#0A0A0A;font-weight:800;font-size:13px;padding:4px 10px;border-radius:6px;">NEX</div>
          <div style="color:#fff;font-size:18px;font-weight:700;margin-top:10px;">Acesso ao sistema</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 16px 0;color:#0A0A0A;font-size:14px;">Olá, ${esc(displayName)}!</p>
          <p style="margin:0 0 16px 0;color:#3A3A3A;font-size:13px;line-height:1.5;">
            Você foi cadastrado(a) no sistema Nex Influencer Metrics com o perfil <strong>${esc(roleLabel)}</strong>.
          </p>
          ${scopeNote}
          <table role="presentation" style="width:100%;background:#F4F2EC;border-radius:10px;margin-bottom:16px;">
            <tr><td style="padding:14px 16px;">
              <div style="font-size:11px;color:#8A8A85;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Login</div>
              <div style="font-size:14px;font-weight:700;color:#0A0A0A;margin-bottom:10px;">${esc(username)}</div>
              <div style="font-size:11px;color:#8A8A85;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Senha temporária</div>
              <div style="font-size:14px;font-weight:700;color:#0A0A0A;font-family:monospace;">${esc(password)}</div>
            </td></tr>
          </table>
          <p style="margin:0 0 20px 0;color:#3A3A3A;font-size:13px;line-height:1.5;">
            No primeiro acesso, você será obrigado(a) a definir uma nova senha.
          </p>
          ${appUrl ? `<a href="${esc(appUrl)}" style="display:inline-block;background:#FFD400;color:#0A0A0A;font-weight:700;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;">Acessar o sistema</a>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

module.exports = { renderUserInviteEmailHtml };
