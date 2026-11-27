const express = require('express');
const { protect, requireAdmin } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');
const dash = require('../controllers/adminDashboardController');
const jobs = require('../controllers/adminJobController');
const companies = require('../controllers/adminCompanyController');
const aiAdmin = require('../controllers/adminAiController');

const router = express.Router();
// Every /api/admin route needs a valid token AND a database-backed admin role (never a client-supplied one).
router.use(protect, requireAdmin);

router.get('/ai/health', aiAdmin.getHealth);
router.get('/overview', dash.getOverview);
router.get('/activity', dash.getActivity);

router.get('/jobs', jobs.listJobs);
router.post('/jobs', jobs.createJob);
router.get('/jobs/:id', validateIdParam(), jobs.getJob);
router.put('/jobs/:id', validateIdParam(), jobs.updateJob);
router.post('/jobs/:id/activate', validateIdParam(), jobs.activateJob);
router.post('/jobs/:id/deactivate', validateIdParam(), jobs.deactivateJob);
router.post('/jobs/:id/close', validateIdParam(), jobs.closeJob);
router.post('/jobs/:id/reopen', validateIdParam(), jobs.reopenJob);

router.get('/companies', companies.listCompanies);
router.get('/companies/options', companies.companyOptions);
router.post('/companies', companies.createCompany);
router.get('/companies/:id', validateIdParam(), companies.getCompany);
router.put('/companies/:id', validateIdParam(), companies.updateCompany);
router.post('/companies/:id/archive', validateIdParam(), companies.archiveCompany);
router.post('/companies/:id/restore', validateIdParam(), companies.restoreCompany);
router.delete('/companies/:id', validateIdParam(), companies.deleteCompany);

module.exports = router;
