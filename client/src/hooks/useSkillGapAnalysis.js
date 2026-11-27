import { useState, useCallback, useRef } from 'react';
import { createResumeAnalysis, createManualAnalysis, getAnalysis } from '../api/skillGap';
import { aiErrorMessage } from '../components/skillgap/skillGapUtils';

// Holds the analysis currently on screen plus create/open state. A ref guards against double submits.
export default function useSkillGapAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false); // creating (AI call)
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);

  const create = useCallback(async (kind, body) => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await (kind === 'resume' ? createResumeAnalysis(body) : createManualAnalysis(body));
      setAnalysis(res.analysis);
      if (res.reused) setNotice('You ran this exact analysis a few minutes ago, so we are showing that saved result instead of running it again.');
      return res.analysis;
    } catch (err) {
      setError(aiErrorMessage(err, 'The analysis could not be completed. Nothing was saved. Please try again.'));
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);

  const open = useCallback(async (id) => {
    setOpening(true);
    setError('');
    setNotice('');
    try {
      const res = await getAnalysis(id);
      setAnalysis(res.analysis);
    } catch (err) {
      setAnalysis(null);
      setError(aiErrorMessage(err, 'Could not open that analysis.'));
    } finally {
      setOpening(false);
    }
  }, []);

  const clear = useCallback(() => {
    setAnalysis(null);
    setError('');
    setNotice('');
  }, []);

  return { analysis, busy, opening, error, notice, create, open, clear };
}
