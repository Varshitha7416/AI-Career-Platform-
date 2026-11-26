import { useState, useEffect, useCallback, useRef } from 'react';
import { getRoadmap, generateRoadmap, updateTask, updateSkillLevel } from '../api/skillGap';
import { aiErrorMessage } from '../components/skillgap/skillGapUtils';

// Roadmap for one analysis: load, generate/regenerate, update task, set skill level.
export default function useSkillGapRoadmap(analysisId) {
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingTask, setSavingTask] = useState(''); // task id being saved
  const lock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setRoadmap(null);
    try {
      const res = await getRoadmap(analysisId);
      setRoadmap(res.roadmap || null);
    } catch (err) {
      if (err?.response?.status === 404 && err.response.data?.code === 'NO_ROADMAP') setRoadmap(null);
      else setLoadError(aiErrorMessage(err, 'Could not load the roadmap.'));
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / analysis change
    load();
  }, [load]);

  const generate = useCallback(async ({ weeklyHours, regenerate }) => {
    if (lock.current) return false;
    lock.current = true;
    setGenerating(true);
    setGenError('');
    try {
      const body = {};
      if (weeklyHours) body.weeklyHours = weeklyHours;
      if (regenerate) body.regenerate = true;
      const res = await generateRoadmap(analysisId, body);
      setRoadmap(res.roadmap);
      return true;
    } catch (err) {
      setGenError(aiErrorMessage(err, 'The roadmap could not be generated. Nothing was saved.'));
      return false;
    } finally {
      lock.current = false;
      setGenerating(false);
    }
  }, [analysisId]);

  const saveTask = useCallback(async (taskId, patch) => {
    if (!roadmap) return false;
    setSavingTask(taskId);
    setActionError('');
    try {
      const res = await updateTask(roadmap._id, taskId, patch);
      setRoadmap(res.roadmap);
      return true;
    } catch (err) {
      setActionError(aiErrorMessage(err, 'Could not save that change.'));
      return false;
    } finally {
      setSavingTask('');
    }
  }, [roadmap]);

  const saveLevel = useCallback(async (skillKey, level) => {
    if (!roadmap) return;
    setActionError('');
    try {
      await updateSkillLevel(roadmap._id, skillKey, level || null);
      setRoadmap((r) => (r ? { ...r, skills: r.skills.map((s) => (s.skillKey === skillKey ? { ...s, level: level || null } : s)) } : r));
    } catch (err) {
      setActionError(aiErrorMessage(err, 'Could not save your level.'));
    }
  }, [roadmap]);

  return { roadmap, loading, loadError, reload: load, generating, genError, generate, actionError, savingTask, saveTask, saveLevel };
}
