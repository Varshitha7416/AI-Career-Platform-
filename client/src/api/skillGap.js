import axiosClient from './axiosClient';

// Thin wrappers over /api/skill-gap (see docs/21-skill-gap-contract.md). Each returns res.data.
const base = '/skill-gap';
const data = (p) => p.then((r) => r.data);

export const fetchRoles = (q, signal) => data(axiosClient.get(`${base}/roles`, { params: { q }, signal }));
export const fetchSkills = (q, signal) => data(axiosClient.get(`${base}/skills`, { params: { q, limit: 12 }, signal }));

export const createResumeAnalysis = (body) => data(axiosClient.post(`${base}/resume`, body));
export const createManualAnalysis = (body) => data(axiosClient.post(`${base}/manual`, body));

export const listAnalyses = (page = 1, limit = 8) => data(axiosClient.get(base, { params: { page, limit } }));
export const getAnalysis = (id) => data(axiosClient.get(`${base}/${id}`));
export const deleteAnalysis = (id) => data(axiosClient.delete(`${base}/${id}`));

export const getOverview = () => data(axiosClient.get(`${base}/overview`));
export const compareAnalyses = (a, b) => data(axiosClient.get(`${base}/compare`, { params: { a, b } }));

export const getRoadmap = (analysisId) => data(axiosClient.get(`${base}/${analysisId}/roadmap`));
export const generateRoadmap = (analysisId, body) => data(axiosClient.post(`${base}/${analysisId}/roadmap`, body));
export const getPrograms = (analysisId) => data(axiosClient.get(`${base}/${analysisId}/programs`));
export const updateTask = (roadmapId, taskId, body) => data(axiosClient.put(`${base}/roadmaps/${roadmapId}/tasks/${taskId}`, body));
export const updateSkillLevel = (roadmapId, skillKey, level) => data(axiosClient.put(`${base}/roadmaps/${roadmapId}/skills/${encodeURIComponent(skillKey)}`, { level }));
