require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Company = require('./models/Company');
const Job = require('./models/Job');

const companies = [
  { name: 'Infosys', industry: 'IT Services', location: 'Bangalore', description: 'Global leader in next-generation digital services and consulting.', website: 'https://infosys.com' },
  { name: 'TCS', industry: 'IT Services', location: 'Mumbai', description: 'India\'s largest IT services company, part of the Tata Group.', website: 'https://tcs.com' },
  { name: 'Wipro', industry: 'IT Services', location: 'Bangalore', description: 'Leading technology services and consulting company.', website: 'https://wipro.com' },
  { name: 'HCLTech', industry: 'IT Services', location: 'Noida', description: 'Global technology company helping enterprises reimagine their businesses.', website: 'https://hcltech.com' },
  { name: 'Zoho', industry: 'Product', location: 'Chennai', description: 'Bootstrapped SaaS company building a full suite of business software.', website: 'https://zoho.com' },
  { name: 'Freshworks', industry: 'Product', location: 'Chennai', description: 'Customer engagement software built for businesses of all sizes.', website: 'https://freshworks.com' },
  { name: 'Razorpay', industry: 'Fintech', location: 'Bangalore', description: 'Full-stack payments and banking platform for businesses in India.', website: 'https://razorpay.com' },
  { name: 'Swiggy', industry: 'Consumer Tech', location: 'Bangalore', description: 'India\'s leading on-demand food and grocery delivery platform.', website: 'https://swiggy.com' },
  { name: 'Zomato', industry: 'Consumer Tech', location: 'Gurgaon', description: 'Food delivery and restaurant discovery platform.', website: 'https://zomato.com' },
  { name: 'PhonePe', industry: 'Fintech', location: 'Bangalore', description: 'Digital payments and financial services platform.', website: 'https://phonepe.com' },
  { name: 'Salesforce', industry: 'Product', location: 'Hyderabad', description: 'World\'s #1 customer relationship management platform.', website: 'https://salesforce.com' },
  { name: 'Microsoft', industry: 'Product', location: 'Hyderabad', description: 'Global technology company empowering every person and organization.', website: 'https://microsoft.com' },
];

const jobTemplates = [
  { title: 'Software Engineer', level: 'fresher', years: 0, desc: 'Design, develop and maintain scalable web applications. Work with React, Node.js, and REST APIs. Collaborate with cross-functional teams to ship features. Strong fundamentals in data structures, algorithms, and object-oriented programming required.' },
  { title: 'Frontend Developer', level: 'fresher', years: 0, desc: 'Build responsive, accessible user interfaces using React and modern CSS. Work closely with designers to translate mockups into production code. Familiarity with HTML5, CSS3, JavaScript ES6+, and state management libraries expected.' },
  { title: 'Backend Developer', level: 'experienced', years: 2, desc: 'Develop and maintain server-side applications using Node.js and Express. Design database schemas in MongoDB or PostgreSQL. Build secure REST APIs, handle authentication, and optimize query performance.' },
  { title: 'Full Stack Developer', level: 'experienced', years: 3, desc: 'Own features end-to-end across frontend and backend. Work with React, Node.js, MongoDB, and cloud deployment. Experience with CI/CD pipelines and containerization preferred.' },
  { title: 'Data Analyst', level: 'fresher', years: 0, desc: 'Analyze large datasets to surface business insights. Build dashboards and reports using SQL, Excel, and visualization tools. Strong analytical thinking and communication skills required.' },
  { title: 'QA Engineer', level: 'fresher', years: 0, desc: 'Design and execute test plans for web applications. Write automated tests using Selenium or Cypress. Log, track, and verify defects. Attention to detail and understanding of SDLC required.' },
  { title: 'DevOps Engineer', level: 'experienced', years: 3, desc: 'Manage CI/CD pipelines, container orchestration, and cloud infrastructure. Work with Docker, Kubernetes, and AWS. Automate deployments and monitor system reliability.' },
  { title: 'Systems Engineer', level: 'fresher', years: 0, desc: 'Support and maintain enterprise systems and applications. Troubleshoot technical issues, handle incident resolution, and work with clients on technical requirements. Good communication and problem-solving skills essential.' },
  { title: 'Mobile App Developer', level: 'experienced', years: 2, desc: 'Build cross-platform mobile applications using React Native or Flutter. Integrate with REST APIs, handle offline storage, and optimize app performance across devices.' },
  { title: 'Machine Learning Engineer', level: 'experienced', years: 2, desc: 'Design and deploy ML models into production. Work with Python, TensorFlow or PyTorch, and data pipelines. Experience with model evaluation, feature engineering, and MLOps practices preferred.' },
  { title: 'Cloud Engineer', level: 'experienced', years: 2, desc: 'Design and implement cloud infrastructure on AWS or Azure. Manage IaC using Terraform, optimize cloud costs, and ensure security compliance.' },
  { title: 'Associate Software Engineer', level: 'fresher', years: 0, desc: 'Entry-level role for recent graduates. Learn and contribute to production codebases under mentorship. Training provided in company tech stack. Strong programming fundamentals in any language required.' },
  { title: 'UI/UX Developer', level: 'fresher', years: 0, desc: 'Bridge design and development by building pixel-perfect interfaces. Work with Figma handoffs, design systems, and component libraries. Eye for detail and understanding of usability principles required.' },
  { title: 'Technical Support Engineer', level: 'fresher', years: 0, desc: 'Provide technical assistance to enterprise customers. Diagnose and resolve product issues, escalate complex cases, and document solutions. Strong communication and troubleshooting skills required.' },
  { title: 'Database Administrator', level: 'experienced', years: 4, desc: 'Manage and optimize production databases. Handle backups, replication, performance tuning, and security. Experience with MongoDB, MySQL, or PostgreSQL at scale required.' },
];

const cities = ['Hyderabad', 'Bangalore', 'Pune', 'Chennai', 'Mumbai', 'Noida', 'Gurgaon'];


// ---- Safety guard: runs BEFORE any database connection is opened ----
// seed.js deletes every Company and Job. It may only run against a local MongoDB,
// or against a remote one when the operator explicitly names that exact database.
const describeTarget = () => {
  const uri = process.env.MONGO_URI || '';
  const m = uri.match(/^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
  if (!m) return null;
  const hosts = m[2].split(',').map((h) => h.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase());
  const isLocal = m[1] === 'mongodb' && hosts.every((h) => ['localhost', '127.0.0.1', '::1'].includes(h));
  // With no database in the URI, MongoDB uses its default database named "test".
  return { hosts, dbName: m[3] || 'test', isLocal };
};

const assertSafeTarget = () => {
  const target = describeTarget();
  if (!target) {
    console.error('Refusing to seed: MONGO_URI is missing or not a valid MongoDB URI.');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is "production".');
    process.exit(1);
  }
  console.log(`Seed target: host=${target.hosts.join(',')} database=${target.dbName} (${target.isLocal ? 'local' : 'REMOTE'})`);
  if (!target.isLocal) {
    const confirmed = process.env.SEED_ALLOW_REMOTE_DB === target.dbName && process.argv.includes('--force');
    if (!confirmed) {
      console.error(
        'Refusing to seed a REMOTE database. This script deletes all companies and jobs. ' +
        `If you really mean it, run: SEED_ALLOW_REMOTE_DB=${target.dbName} node seed.js --force`
      );
      process.exit(1);
    }
    console.warn(`WARNING: seeding remote database "${target.dbName}" as explicitly confirmed.`);
  }
};

const seed = async () => {
  try {
    assertSafeTarget();
    await connectDB();

    const existing = await Job.countDocuments();
    if (existing > 0 && !process.argv.includes('--force')) {
      console.error(`Database already has ${existing} jobs. Seeding DELETES all companies and jobs (saved jobs/applications would point at removed jobs). Re-run with --force to continue.`);
      process.exit(1);
    }

    console.log('Clearing existing companies and jobs...');
    await Company.deleteMany({});
    await Job.deleteMany({});

    console.log('Inserting companies...');
    const createdCompanies = await Company.insertMany(companies);
    console.log(`${createdCompanies.length} companies inserted.`);

    console.log('Generating jobs...');
    const jobs = [];
    createdCompanies.forEach((company) => {
      const shuffled = [...jobTemplates].sort(() => 0.5 - Math.random());
      const picked = shuffled.slice(0, 4);

      picked.forEach((template) => {
        jobs.push({
          title: template.title,
          company: company._id,
          city: cities[Math.floor(Math.random() * cities.length)],
          jobDescription: template.desc,
          experienceLevel: template.level,
          yearsRequired: template.years,
        });
      });
    });

    const createdJobs = await Job.insertMany(jobs);
    console.log(`${createdJobs.length} jobs inserted.`);

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();