const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/aiLimiter');
const c = require('../controllers/roadmapController');

// Mounted at /api/skill-gap BEFORE the analysis router. Fixed paths come first; unmatched paths fall through.
const router = express.Router();
router.use(protect);

router.get('/overview', c.getOverview);
router.get('/compare', c.compare);
router.get('/roadmaps', c.listRoadmaps);
router.get('/roadmaps/:roadmapId', c.getRoadmap);
router.put('/roadmaps/:roadmapId/tasks/:taskId', c.updateTask);
router.put('/roadmaps/:roadmapId/skills/:skillKey', c.updateSkillLevel);
router.delete('/roadmaps/:roadmapId', c.deleteRoadmap);

router.post('/:id/roadmap', aiLimiter, c.createRoadmap);
router.get('/:id/roadmap', c.getAnalysisRoadmap);
router.get('/:id/programs', c.getPrograms);

module.exports = router;
