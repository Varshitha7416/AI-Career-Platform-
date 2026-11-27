// Email templates: pure functions returning { subject, text, html }. No transport and no I/O here.
// Every dynamic value is HTML-escaped. Links are built by the caller and must be absolute http(s) URLs.

const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const safeUrl = (u) => {
  try {
    const p = new URL(String(u));
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.toString() : '#';
  } catch { return '#'; }
};

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// Shared green-branded layout (inline styles only: email clients ignore stylesheets).
const layout = ({ heading, bodyHtml, buttonLabel, buttonUrl, footerHtml }) => `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#DAF1DE;font-family:Arial,Helvetica,sans-serif;color:#051F20;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;">
<tr><td style="font-size:22px;font-weight:bold;color:#163832;">CareerNest</td></tr>
<tr><td style="padding-top:20px;font-size:20px;font-weight:bold;">${escapeHtml(heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
${buttonUrl ? `<tr><td style="padding-top:24px;"><a href="${escapeHtml(safeUrl(buttonUrl))}" style="display:inline-block;background:#163832;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;">${escapeHtml(buttonLabel)}</a></td></tr>` : ''}
<tr><td style="padding-top:24px;font-size:13px;line-height:1.5;color:#4b5563;">${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;

const TEMPLATES = {
  // data: { name, resetUrl, expiresMinutes }
  passwordReset: ({ name, resetUrl, expiresMinutes }) => {
    const who = firstName(name);
    const minutes = Number(expiresMinutes) || 30;
    return {
      subject: 'Reset your CareerNest password',
      text: [
        `Hi ${who},`,
        '',
        'We received a request to reset the password for your CareerNest account.',
        `Use the link below to choose a new password. It works once and expires in ${minutes} minutes.`,
        '',
        resetUrl,
        '',
        'If you did not ask for this, you can ignore this email: your password will not change.',
        'Never share this link with anyone.',
      ].join('\n'),
      html: layout({
        heading: 'Reset your password',
        bodyHtml: `Hi ${escapeHtml(who)},<br><br>We received a request to reset the password for your CareerNest account. Use the button below to choose a new password. The link works once and expires in ${minutes} minutes.`,
        buttonLabel: 'Choose a new password',
        buttonUrl: resetUrl,
        footerHtml: `If the button does not work, copy this link into your browser:<br><span style="word-break:break-all;">${escapeHtml(resetUrl)}</span><br><br>If you did not ask for this, ignore this email: your password will not change. Never share this link with anyone.`,
      }),
      actionUrl: resetUrl,
    };
  },

  // data: { name, subject, replyText, supportUrl }  (never include internal notes here)
  supportReply: ({ name, subject, replyText, supportUrl }) => {
    const who = firstName(name);
    const reply = String(replyText || '');
    return {
      subject: `CareerNest support replied: ${String(subject || 'your request').slice(0, 100)}`,
      text: [`Hi ${who},`, '', 'The CareerNest support team replied to your request:', '', reply, '', supportUrl ? `You can also read this reply in your CareerNest account: ${supportUrl}` : 'You can also read this reply in your CareerNest account under Contact Us > My requests.'].join('\n'),
      html: layout({
        heading: 'We replied to your request',
        bodyHtml: `Hi ${escapeHtml(who)},<br><br>The CareerNest support team replied to your request "${escapeHtml(subject)}":<br><br><div style="white-space:pre-wrap;border-left:3px solid #8EB69B;padding-left:12px;">${escapeHtml(reply)}</div>`,
        buttonLabel: supportUrl ? 'View in CareerNest' : '',
        buttonUrl: supportUrl || '',
        footerHtml: 'This reply is also saved in your CareerNest account.',
      }),
      actionUrl: supportUrl || undefined,
    };
  },

  // data: { name, verifyUrl, expiresHours }
  emailVerification: ({ name, verifyUrl, expiresHours }) => {
    const who = firstName(name);
    const hours = Number(expiresHours) || 24;
    return {
      subject: 'Verify your CareerNest email address',
      text: [
        `Hi ${who},`,
        '',
        'Welcome to CareerNest. Please confirm that this is your email address.',
        `Use the link below. It works once and expires in ${hours} hours.`,
        '',
        verifyUrl,
        '',
        'If you did not create a CareerNest account, you can ignore this email.',
        'Never share this link with anyone.',
      ].join('\n'),
      html: layout({
        heading: 'Verify your email address',
        bodyHtml: `Hi ${escapeHtml(who)},<br><br>Welcome to CareerNest. Please confirm that this is your email address. The link works once and expires in ${hours} hours.`,
        buttonLabel: 'Verify my email',
        buttonUrl: verifyUrl,
        footerHtml: `If the button does not work, copy this link into your browser:<br><span style="word-break:break-all;">${escapeHtml(verifyUrl)}</span><br><br>If you did not create a CareerNest account, ignore this email. Never share this link with anyone.`,
      }),
      actionUrl: verifyUrl,
    };
  },

  // data: { name } — sent after a successful reset so an unexpected change is noticed.
  passwordChanged: ({ name }) => {
    const who = firstName(name);
    return {
      subject: 'Your CareerNest password was changed',
      text: [
        `Hi ${who},`,
        '',
        'The password for your CareerNest account was just changed, and you were signed out on other devices.',
        'If this was you, no action is needed. If it was not, reset your password again right away and contact us.',
      ].join('\n'),
      html: layout({
        heading: 'Your password was changed',
        bodyHtml: `Hi ${escapeHtml(who)},<br><br>The password for your CareerNest account was just changed, and you were signed out on other devices.<br><br>If this was you, no action is needed. If it was not, reset your password again right away and contact us.`,
        footerHtml: 'This is an automated security message.',
      }),
    };
  },
};

const render = (template, data) => {
  const fn = TEMPLATES[template];
  if (!fn) throw Object.assign(new Error(`Unknown email template: ${template}`), { code: 'EMAIL_TEMPLATE_UNKNOWN' });
  return fn(data || {});
};

module.exports = { render, TEMPLATES, escapeHtml };
