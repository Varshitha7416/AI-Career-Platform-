// Plain-language summary of what happens to account data (source of truth: docs/26-account-management.md). No retention promises beyond that.
export default function PrivacyNotice() {
  return (
    <div className="text-sm text-ink/70 space-y-2 border-t border-sage/30 pt-4 mt-4" data-testid="privacy-notice">
      <h3 className="font-semibold text-ink">What happens to your data</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Export:</strong> you can download your own data as a JSON file at any time. It never includes your password or other people&apos;s contact details.</li>
        <li><strong>Deleting your account</strong> erases your profile details and deletes your applications, saved jobs, resumes (including extracted text), analyses, cover letters, roadmaps, interviews, program progress, notifications and contact messages. Your email address becomes free to sign up with again.</li>
        <li><strong>Referrals involve two people.</strong> Open requests are closed and your message and resume copy are removed; the other person keeps their own record, which shows &quot;Deleted user&quot;.</li>
        <li><strong>Job listings and audit records</strong> that are not yours alone are kept, but only point at an anonymous &quot;Deleted user&quot; entry.</li>
        <li>If clean-up cannot finish immediately, your account is already closed and the rest is completed automatically.</li>
      </ul>
    </div>
  );
}
