import { useState, useEffect } from 'react';

// Debounced suggestion lookup. fetcher(query, signal) must resolve to an array.
// Only fetches while `enabled` (dropdown open). Failures give an empty list (the field still accepts free text).
export default function useSkillGapSuggestions(fetcher, query, enabled) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await fetcher(query.trim(), controller.signal);
        if (!controller.signal.aborted) setItems(Array.isArray(list) ? list : []);
      } catch {
        if (!controller.signal.aborted) setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetcher, query, enabled]);

  return { items, loading };
}
