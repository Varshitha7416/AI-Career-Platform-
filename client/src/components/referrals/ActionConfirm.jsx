import { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import ConfirmDialog from '../coverletter/ConfirmDialog';
import { ACTIONS } from './referralUtils';

const COPY = {
  accept: {
    title: 'Accept this referral request?',
    body: ['The candidate will be told you agreed to help. You can still decline later or mark it as referred.'],
    confirm: 'Accept',
  },
  decline: {
    title: 'Decline this referral request?',
    body: ['The candidate will be notified. This cannot be undone, and you will no longer be able to view their resume.'],
    confirm: 'Decline',
  },
  withdraw: {
    title: 'Withdraw this request?',
    body: ['The recipient will be notified and will no longer be able to view your resume. This cannot be undone; you can send a new request later.'],
    confirm: 'Withdraw',
  },
  'mark-referred': {
    title: 'Mark as referred?',
    body: [
      "Only mark this as referred after you've submitted the referral through your company's referral process.",
      'The candidate will be told that you referred them.',
    ],
    confirm: 'Yes, I referred them',
  },
};

// Confirmation + the status update. Calls onDone(referral, message) or onFail(message).
function ActionConfirm({ referralId, action, onCancel, onDone, onFail }) {
  const [busy, setBusy] = useState(false);
  const copy = COPY[action];
  const meta = ACTIONS[action];

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await axiosClient.put(`/referrals/${referralId}/status`, { status: meta.status });
      onDone(res.data.referral, meta.done);
    } catch (err) {
      onFail(getErrorMessage(err, 'Could not update this request.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog title={copy.title} confirmLabel={copy.confirm} danger={!!meta.danger} busy={busy} onConfirm={confirm} onCancel={onCancel}>
      {copy.body.map((t) => <p key={t}>{t}</p>)}
    </ConfirmDialog>
  );
}

export default ActionConfirm;
