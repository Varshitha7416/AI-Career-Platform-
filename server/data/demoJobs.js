/*
 * Demo / sample job data for CareerNest.
 *
 * Everything generated here is SAMPLE DATA for demonstration. Listings are flagged source: 'demo' and are NOT
 * verified live vacancies. No genuine employer application URLs are invented: where an apply link is present
 * it points at the reserved placeholder domain example.com.
 *
 * The generator is deterministic (seeded PRNG + fixed ordering) so re-running the seed produces the same set
 * and the seed script can safely skip anything that already exists (keyed by externalId).
 */
const { toAnnualInr } = require('../utils/salary');

// ------------------------------------------------------------------ deterministic helpers
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ------------------------------------------------------------------ companies
// tier drives the salary multiplier; websites are the companies' public home pages.
const COMPANIES = [
  { name: 'Infosys', industry: 'IT Services', tier: 'it-services', location: 'Bangalore', size: '300,000+ employees', website: 'https://infosys.com', description: 'Global leader in next-generation digital services and consulting.', cities: ['Bangalore', 'Pune', 'Hyderabad', 'Chennai'] },
  { name: 'TCS', industry: 'IT Services', tier: 'it-services', location: 'Mumbai', size: '600,000+ employees', website: 'https://tcs.com', description: "India's largest IT services company, part of the Tata Group.", cities: ['Mumbai', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata'] },
  { name: 'Wipro', industry: 'IT Services', tier: 'it-services', location: 'Bangalore', size: '230,000+ employees', website: 'https://wipro.com', description: 'Leading technology services and consulting company.', cities: ['Bangalore', 'Hyderabad', 'Pune', 'Chennai'] },
  { name: 'HCLTech', industry: 'IT Services', tier: 'it-services', location: 'Noida', size: '220,000+ employees', website: 'https://hcltech.com', description: 'Global technology company helping enterprises reimagine their businesses.', cities: ['Noida', 'Chennai', 'Bangalore', 'Gurgaon'] },
  { name: 'Cognizant', industry: 'IT Services', tier: 'it-services', location: 'Chennai', size: '340,000+ employees', website: 'https://cognizant.com', description: 'Professional services company delivering digital engineering and consulting.', cities: ['Chennai', 'Bangalore', 'Pune', 'Hyderabad'] },
  { name: 'Accenture', industry: 'Consulting', tier: 'consulting', location: 'Bangalore', size: '700,000+ employees', website: 'https://accenture.com', description: 'Global professional services company with leading capabilities in digital, cloud and security.', cities: ['Bangalore', 'Mumbai', 'Hyderabad', 'Gurgaon', 'Pune'] },
  { name: 'Capgemini', industry: 'Consulting', tier: 'consulting', location: 'Mumbai', size: '340,000+ employees', website: 'https://capgemini.com', description: 'Technology and engineering services partner to large enterprises.', cities: ['Mumbai', 'Pune', 'Bangalore', 'Chennai'] },
  { name: 'Deloitte', industry: 'Consulting', tier: 'consulting', location: 'Mumbai', size: '450,000+ employees', website: 'https://deloitte.com', description: 'Professional services network providing consulting, advisory and technology services.', cities: ['Mumbai', 'Hyderabad', 'Bangalore', 'Gurgaon'] },
  { name: 'ThoughtWorks', industry: 'Software Consulting', tier: 'product', location: 'Pune', size: '10,000+ employees', website: 'https://thoughtworks.com', description: 'Technology consultancy known for software craftsmanship and agile delivery.', cities: ['Pune', 'Bangalore', 'Hyderabad', 'Gurgaon'] },
  { name: 'Zoho', industry: 'Product', tier: 'product', location: 'Chennai', size: '18,000+ employees', website: 'https://zoho.com', description: 'Bootstrapped SaaS company building a full suite of business software.', cities: ['Chennai', 'Tenkasi', 'Hyderabad'] },
  { name: 'Freshworks', industry: 'Product', tier: 'product', location: 'Chennai', size: '5,000+ employees', website: 'https://freshworks.com', description: 'Customer engagement software built for businesses of all sizes.', cities: ['Chennai', 'Bangalore', 'Hyderabad'] },
  { name: 'Razorpay', industry: 'Fintech', tier: 'startup', location: 'Bangalore', size: '3,000+ employees', website: 'https://razorpay.com', description: 'Full-stack payments and banking platform for businesses in India.', cities: ['Bangalore', 'Mumbai', 'Gurgaon'] },
  { name: 'PhonePe', industry: 'Fintech', tier: 'startup', location: 'Bangalore', size: '5,000+ employees', website: 'https://phonepe.com', description: 'Digital payments and financial services platform.', cities: ['Bangalore', 'Pune', 'Gurgaon'] },
  { name: 'CRED', industry: 'Fintech', tier: 'startup', location: 'Bangalore', size: '1,000+ employees', website: 'https://cred.club', description: 'Members-only credit card payments and rewards platform.', cities: ['Bangalore'] },
  { name: 'Swiggy', industry: 'Consumer Tech', tier: 'startup', location: 'Bangalore', size: '6,000+ employees', website: 'https://swiggy.com', description: "India's leading on-demand food and grocery delivery platform.", cities: ['Bangalore', 'Hyderabad', 'Gurgaon'] },
  { name: 'Zomato', industry: 'Consumer Tech', tier: 'startup', location: 'Gurgaon', size: '5,000+ employees', website: 'https://zomato.com', description: 'Food delivery and restaurant discovery platform.', cities: ['Gurgaon', 'Bangalore', 'Mumbai'] },
  { name: 'Flipkart', industry: 'E-commerce', tier: 'big-tech', location: 'Bangalore', size: '20,000+ employees', website: 'https://flipkart.com', description: "India's homegrown e-commerce marketplace.", cities: ['Bangalore', 'Hyderabad', 'Chennai'] },
  { name: 'Meesho', industry: 'E-commerce', tier: 'startup', location: 'Bangalore', size: '2,000+ employees', website: 'https://meesho.com', description: 'Social commerce platform connecting small businesses with online customers.', cities: ['Bangalore'] },
  { name: 'Amazon', industry: 'E-commerce & Cloud', tier: 'big-tech', location: 'Hyderabad', size: '1,500,000+ employees', website: 'https://amazon.jobs', description: 'Global e-commerce, cloud computing and technology company.', cities: ['Hyderabad', 'Bangalore', 'Chennai', 'Pune'] },
  { name: 'Google', industry: 'Technology', tier: 'big-tech', location: 'Bangalore', size: '180,000+ employees', website: 'https://careers.google.com', description: 'Global technology company focused on search, cloud, AI and consumer products.', cities: ['Bangalore', 'Hyderabad', 'Gurgaon'] },
  { name: 'Microsoft', industry: 'Product', tier: 'big-tech', location: 'Hyderabad', size: '220,000+ employees', website: 'https://microsoft.com', description: 'Global technology company empowering every person and organization.', cities: ['Hyderabad', 'Bangalore', 'Noida'] },
  { name: 'Salesforce', industry: 'Product', tier: 'big-tech', location: 'Hyderabad', size: '70,000+ employees', website: 'https://salesforce.com', description: "World's #1 customer relationship management platform.", cities: ['Hyderabad', 'Bangalore'] },
  { name: 'Adobe', industry: 'Software', tier: 'big-tech', location: 'Noida', size: '30,000+ employees', website: 'https://adobe.com', description: 'Creative, document and digital experience software company.', cities: ['Noida', 'Bangalore'] },
  { name: 'Atlassian', industry: 'Software', tier: 'big-tech', location: 'Bangalore', size: '11,000+ employees', website: 'https://atlassian.com', description: 'Team collaboration and developer productivity software.', cities: ['Bangalore', 'Remote'] },
  { name: 'Oracle', industry: 'Software & Cloud', tier: 'big-tech', location: 'Bangalore', size: '160,000+ employees', website: 'https://oracle.com', description: 'Enterprise software, databases and cloud infrastructure.', cities: ['Bangalore', 'Hyderabad', 'Pune'] },
  { name: 'SAP', industry: 'Enterprise Software', tier: 'big-tech', location: 'Bangalore', size: '105,000+ employees', website: 'https://sap.com', description: 'Enterprise application software for business operations.', cities: ['Bangalore', 'Gurgaon', 'Pune'] },
];

const TIER = { 'it-services': 0.8, consulting: 0.95, product: 1.15, startup: 1.1, 'big-tech': 1.6 };

const INTERNATIONAL = [
  { city: 'London', country: 'United Kingdom', currency: 'GBP' },
  { city: 'Dublin', country: 'Ireland', currency: 'EUR' },
  { city: 'Singapore', country: 'Singapore', currency: 'SGD' },
  { city: 'San Francisco', country: 'United States', currency: 'USD' },
  { city: 'Seattle', country: 'United States', currency: 'USD' },
  { city: 'Toronto', country: 'Canada', currency: 'CAD' },
  { city: 'Dubai', country: 'United Arab Emirates', currency: 'AED' },
  { city: 'Sydney', country: 'Australia', currency: 'AUD' },
];

// ------------------------------------------------------------------ role templates
// baseLpa = junior (0 years) annual salary in lakhs INR before company tier.
const T = (o) => o;
const TEMPLATES = [
  T({ key: 'software-engineer', title: 'Software Engineer', team: 'platform engineering', baseLpa: 6, category: 'engineering',
    summary: 'design, build and ship reliable software used by thousands of customers',
    skills: ['Java', 'Python', 'Data Structures', 'REST APIs', 'SQL', 'Git'], preferred: ['Spring Boot', 'Docker', 'AWS', 'System Design'],
    responsibilities: ['Design, develop and test features across the product stack', 'Write clean, well-tested and maintainable code', 'Participate in code reviews and design discussions', 'Debug production issues and improve system reliability', 'Collaborate with product managers and designers to deliver releases'],
    requirements: ['Strong fundamentals in data structures and algorithms', 'Experience with at least one object-oriented language', 'Understanding of REST APIs and relational databases', 'Good communication and problem-solving skills'],
    education: ["Bachelor's degree in Computer Science, IT or a related field"] }),
  T({ key: 'associate-software-engineer', title: 'Associate Software Engineer', team: 'graduate engineering', baseLpa: 4, category: 'engineering', fresher: true,
    summary: 'learn and contribute to production code under the guidance of senior engineers',
    skills: ['Java', 'Python', 'SQL', 'Data Structures', 'OOP'], preferred: ['Git', 'Linux', 'Cloud basics'],
    responsibilities: ['Complete structured onboarding and training in the company tech stack', 'Implement small features and fix bugs under mentorship', 'Write unit tests for assigned modules', 'Document code and share learnings with the team', 'Take part in agile ceremonies and sprint reviews'],
    requirements: ['Strong programming fundamentals in any language', 'Understanding of basic data structures and databases', 'Willingness to learn quickly', 'Good written and verbal communication'],
    education: ["Bachelor's degree in Computer Science, IT, Electronics or a related field"] }),
  T({ key: 'frontend-developer', title: 'Frontend Developer', team: 'web experience', baseLpa: 6, category: 'engineering',
    summary: 'build fast, accessible and beautiful user interfaces',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'REST APIs', 'Git'], preferred: ['TypeScript', 'Tailwind CSS', 'Next.js', 'Jest'],
    responsibilities: ['Build responsive interfaces from design mockups', 'Develop reusable components and maintain a design system', 'Integrate frontend views with REST and GraphQL APIs', 'Optimise pages for performance and accessibility', 'Write component and end-to-end tests'],
    requirements: ['Solid knowledge of JavaScript (ES6+), HTML5 and CSS3', 'Hands-on experience with React or a similar framework', 'Familiarity with browser dev tools and debugging', 'Eye for detail and UI quality'],
    education: ["Bachelor's degree in Computer Science or equivalent practical experience"] }),
  T({ key: 'backend-developer', title: 'Backend Developer', team: 'core services', baseLpa: 7, category: 'engineering',
    summary: 'build scalable APIs and services that power the product',
    skills: ['Node.js', 'Express', 'MongoDB', 'SQL', 'REST APIs', 'Git'], preferred: ['Redis', 'Docker', 'Kafka', 'Microservices'],
    responsibilities: ['Design and implement secure, scalable REST APIs', 'Model data and optimise database queries', 'Implement authentication, authorisation and validation', 'Monitor services and resolve performance bottlenecks', 'Write automated tests and maintain API documentation'],
    requirements: ['Experience building server-side applications', 'Good understanding of databases and indexing', 'Knowledge of authentication and API security basics', 'Comfortable with Git and code review workflows'],
    education: ["Bachelor's degree in Computer Science, IT or a related field"] }),
  T({ key: 'full-stack-developer', title: 'Full Stack Developer', team: 'product engineering', baseLpa: 8, category: 'engineering',
    summary: 'own features end to end across the frontend, backend and database',
    skills: ['React', 'Node.js', 'MongoDB', 'JavaScript', 'REST APIs', 'Git'], preferred: ['TypeScript', 'Docker', 'AWS', 'CI/CD'],
    responsibilities: ['Deliver features end to end from UI to database', 'Design APIs and data models with the team', 'Set up automated testing and CI/CD for your services', 'Review code and mentor teammates', 'Work with product and design to refine requirements'],
    requirements: ['Hands-on experience with a modern frontend framework and a backend runtime', 'Understanding of database design', 'Ability to ship independently in an agile team', 'Strong debugging skills'],
    education: ["Bachelor's degree in Computer Science or equivalent experience"] }),
  T({ key: 'product-engineer', title: 'Product Engineer', team: 'product', baseLpa: 9, category: 'engineering',
    summary: 'turn customer problems into well-crafted product features',
    skills: ['JavaScript', 'React', 'Node.js', 'SQL', 'Product Thinking', 'Git'], preferred: ['TypeScript', 'Analytics', 'A/B Testing', 'AWS'],
    responsibilities: ['Partner with product managers to scope and deliver user-facing features', 'Build and ship across the stack with a strong product mindset', 'Instrument features and use data to iterate', 'Own quality, performance and reliability of your features', 'Talk to users and incorporate feedback quickly'],
    requirements: ['Strong engineering fundamentals and product sense', 'Experience shipping web products', 'Comfort working with ambiguity', 'Clear communication with non-technical teammates'],
    education: ["Bachelor's degree in Engineering or equivalent practical experience"] }),
  T({ key: 'data-analyst', title: 'Data Analyst', team: 'analytics', baseLpa: 5, category: 'data',
    summary: 'turn data into insights that guide business decisions',
    skills: ['SQL', 'Excel', 'Python', 'Power BI', 'Data Visualization', 'Statistics'], preferred: ['Tableau', 'Pandas', 'A/B Testing', 'Looker'],
    responsibilities: ['Write SQL queries to extract and analyse business data', 'Build dashboards and recurring reports for stakeholders', 'Identify trends, anomalies and opportunities in the data', 'Define and track key business metrics', 'Present findings clearly to non-technical audiences'],
    requirements: ['Strong SQL and spreadsheet skills', 'Basic statistics and analytical thinking', 'Experience with a BI tool', 'Attention to data quality'],
    education: ["Bachelor's degree in Statistics, Mathematics, Engineering, Economics or a related field"] }),
  T({ key: 'data-engineer', title: 'Data Engineer', team: 'data platform', baseLpa: 8, category: 'data',
    summary: 'build reliable pipelines and platforms that move and model data at scale',
    skills: ['Python', 'SQL', 'Apache Spark', 'ETL', 'Airflow', 'Data Modeling'], preferred: ['Kafka', 'Snowflake', 'AWS', 'dbt'],
    responsibilities: ['Design and maintain batch and streaming data pipelines', 'Model warehouse tables for analytics and ML', 'Monitor data quality and pipeline health', 'Optimise cost and performance of data workloads', 'Collaborate with analysts and data scientists'],
    requirements: ['Strong SQL and Python', 'Experience with a distributed processing framework', 'Understanding of data warehousing concepts', 'Experience with workflow orchestration'],
    education: ["Bachelor's degree in Computer Science, IT or a related field"] }),
  T({ key: 'machine-learning-engineer', title: 'Machine Learning Engineer', team: 'applied ML', baseLpa: 10, category: 'data',
    summary: 'design, train and deploy machine learning models into production',
    skills: ['Python', 'Machine Learning', 'TensorFlow', 'PyTorch', 'SQL', 'Statistics'], preferred: ['MLOps', 'Docker', 'AWS SageMaker', 'NLP'],
    responsibilities: ['Develop and evaluate ML models for product use cases', 'Build feature pipelines and training workflows', 'Deploy and monitor models in production', 'Run experiments and communicate results', 'Improve model quality, latency and cost'],
    requirements: ['Solid grounding in ML fundamentals and statistics', 'Proficiency in Python and an ML framework', 'Experience taking models from notebook to production', 'Good experimentation discipline'],
    education: ["Bachelor's or Master's degree in Computer Science, Data Science, Mathematics or related field"] }),
  T({ key: 'devops-engineer', title: 'DevOps Engineer', team: 'infrastructure', baseLpa: 8, category: 'infra',
    summary: 'automate delivery pipelines and keep infrastructure reliable and secure',
    skills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux', 'Terraform'], preferred: ['Jenkins', 'Prometheus', 'Ansible', 'Python'],
    responsibilities: ['Build and maintain CI/CD pipelines', 'Manage containerised workloads and cloud infrastructure', 'Automate infrastructure with code', 'Set up monitoring, alerting and logging', 'Improve security and cost efficiency'],
    requirements: ['Hands-on experience with containers and a cloud provider', 'Scripting skills in Bash or Python', 'Understanding of networking and Linux administration', 'Incident response experience is a plus'],
    education: ["Bachelor's degree in Computer Science, IT or a related field"] }),
  T({ key: 'cloud-engineer', title: 'Cloud Engineer', team: 'cloud platform', baseLpa: 8, category: 'infra',
    summary: 'design and operate secure, cost-efficient cloud infrastructure',
    skills: ['AWS', 'Azure', 'Terraform', 'Linux', 'Networking', 'Python'], preferred: ['Kubernetes', 'CloudFormation', 'Security', 'FinOps'],
    responsibilities: ['Design and implement cloud architectures', 'Manage infrastructure as code', 'Optimise cloud costs and performance', 'Enforce security and compliance controls', 'Support application teams with migrations'],
    requirements: ['Experience with AWS or Azure services', 'Knowledge of networking and identity management', 'Familiarity with infrastructure as code', 'Strong troubleshooting skills'],
    education: ["Bachelor's degree in Computer Science, IT or a related field"] }),
  T({ key: 'qa-automation-engineer', title: 'QA Automation Engineer', team: 'quality engineering', baseLpa: 5, category: 'quality',
    summary: 'build automated test suites that keep releases fast and safe',
    skills: ['Selenium', 'Cypress', 'JavaScript', 'API Testing', 'SQL', 'Git'], preferred: ['Playwright', 'Postman', 'CI/CD', 'Performance Testing'],
    responsibilities: ['Design and maintain UI and API automation suites', 'Create test plans and test cases from requirements', 'Log, track and verify defects', 'Integrate tests into CI pipelines', 'Work with developers to improve testability'],
    requirements: ['Understanding of the software development life cycle', 'Experience with an automation framework', 'Attention to detail', 'Basic SQL and API testing knowledge'],
    education: ["Bachelor's degree in Computer Science, IT or a related field"] }),
  T({ key: 'mobile-app-developer', title: 'Mobile App Developer', team: 'mobile', baseLpa: 7, category: 'engineering',
    summary: 'build smooth, high-quality mobile apps for millions of users',
    skills: ['React Native', 'JavaScript', 'Android', 'iOS', 'REST APIs', 'Git'], preferred: ['Flutter', 'Kotlin', 'Swift', 'Firebase'],
    responsibilities: ['Build and maintain cross-platform mobile applications', 'Integrate with REST APIs and handle offline storage', 'Optimise performance, battery and app size', 'Publish and monitor app releases', 'Collaborate with designers on native-feeling UX'],
    requirements: ['Experience shipping a mobile app', 'Understanding of mobile UI patterns and lifecycle', 'Good grasp of state management', 'Debugging skills on real devices'],
    education: ["Bachelor's degree in Computer Science or equivalent practical experience"] }),
  T({ key: 'ui-ux-designer', title: 'UI/UX Designer', team: 'design', baseLpa: 6, category: 'design',
    summary: 'design intuitive, delightful experiences backed by research',
    skills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems', 'Usability Testing'], preferred: ['Adobe XD', 'Motion Design', 'Accessibility', 'HTML/CSS'],
    responsibilities: ['Translate requirements into wireframes and high-fidelity designs', 'Run user research and usability tests', 'Maintain and extend the design system', 'Collaborate with engineers on implementation', 'Present design rationale to stakeholders'],
    requirements: ['A portfolio demonstrating end-to-end design work', 'Proficiency in Figma', 'Understanding of accessibility and responsive design', 'Strong communication and storytelling'],
    education: ["Bachelor's degree in Design, HCI, Engineering or equivalent portfolio"] }),
  T({ key: 'product-manager', title: 'Product Manager', team: 'product management', baseLpa: 14, category: 'product',
    summary: 'define the roadmap and drive delivery of products customers love',
    skills: ['Product Strategy', 'Roadmapping', 'User Research', 'SQL', 'Stakeholder Management', 'Agile'], preferred: ['A/B Testing', 'Analytics', 'Go-to-market', 'Jira'],
    responsibilities: ['Own the product roadmap and prioritise the backlog', 'Write clear product requirements and success metrics', 'Work with engineering and design through delivery', 'Analyse usage data and customer feedback', 'Coordinate launches with sales and marketing'],
    requirements: ['Experience in a product, analyst or engineering role', 'Strong analytical and communication skills', 'Ability to prioritise under constraints', 'Customer empathy'],
    education: ["Bachelor's degree; MBA is a plus"] }),
  T({ key: 'business-analyst', title: 'Business Analyst', team: 'business analysis', baseLpa: 6, category: 'product',
    summary: 'bridge business needs and technology teams with clear requirements',
    skills: ['Requirements Gathering', 'SQL', 'Excel', 'Process Modeling', 'Stakeholder Management', 'Jira'], preferred: ['Power BI', 'UML', 'Agile', 'Domain knowledge'],
    responsibilities: ['Elicit and document business and functional requirements', 'Model processes and identify improvement opportunities', 'Support UAT and release readiness', 'Track project progress and risks', 'Communicate status to stakeholders'],
    requirements: ['Strong analytical and documentation skills', 'Working knowledge of SQL and spreadsheets', 'Excellent communication', 'Experience with Agile ceremonies'],
    education: ["Bachelor's degree in Engineering, Commerce, Business or a related field"] }),
  T({ key: 'technical-support-engineer', title: 'Technical Support Engineer', team: 'customer support engineering', baseLpa: 3.5, category: 'support',
    summary: 'resolve customer technical issues and keep them successful',
    skills: ['Troubleshooting', 'SQL', 'Linux', 'REST APIs', 'Customer Communication', 'Ticketing Tools'], preferred: ['Networking', 'Python', 'Zendesk', 'Log analysis'],
    responsibilities: ['Diagnose and resolve product issues reported by customers', 'Escalate complex cases with clear reproduction steps', 'Document solutions in the knowledge base', 'Collaborate with engineering on bug fixes', 'Maintain SLAs and customer satisfaction'],
    requirements: ['Strong troubleshooting and communication skills', 'Basic understanding of APIs and databases', 'Customer-first attitude', 'Willingness to work in shifts when required'],
    education: ["Bachelor's degree or diploma in IT, Computer Science or a related field"] }),
  T({ key: 'cybersecurity-analyst', title: 'Cybersecurity Analyst', team: 'security operations', baseLpa: 7, category: 'infra',
    summary: 'detect, investigate and respond to security threats',
    skills: ['SIEM', 'Network Security', 'Incident Response', 'Linux', 'Vulnerability Assessment', 'Python'], preferred: ['Splunk', 'Penetration Testing', 'Cloud Security', 'ISO 27001'],
    responsibilities: ['Monitor security alerts and investigate incidents', 'Run vulnerability scans and track remediation', 'Improve detection rules and playbooks', 'Support audits and compliance activities', 'Raise security awareness across teams'],
    requirements: ['Understanding of networking and common attack techniques', 'Experience with a SIEM or similar tooling', 'Analytical and calm under pressure', 'Security certifications are a plus'],
    education: ["Bachelor's degree in Computer Science, IT or Cybersecurity"] }),
  T({ key: 'site-reliability-engineer', title: 'Site Reliability Engineer', team: 'reliability engineering', baseLpa: 9, category: 'infra',
    summary: 'keep large-scale systems fast, observable and resilient',
    skills: ['Linux', 'Kubernetes', 'Python', 'Monitoring', 'Incident Management', 'Networking'], preferred: ['Prometheus', 'Grafana', 'Go', 'Chaos Engineering'],
    responsibilities: ['Define and track SLOs and error budgets', 'Automate operations to eliminate toil', 'Lead incident response and blameless postmortems', 'Design for capacity, scaling and failure', 'Partner with developers on production readiness'],
    requirements: ['Strong Linux and networking knowledge', 'Programming skills for automation', 'Experience with monitoring and alerting', 'On-call experience is a plus'],
    education: ["Bachelor's degree in Computer Science or a related field"] }),
  T({ key: 'systems-engineer', title: 'Systems Engineer', team: 'enterprise systems', baseLpa: 4.5, category: 'infra',
    summary: 'support, maintain and improve enterprise systems and applications',
    skills: ['Linux', 'SQL', 'Troubleshooting', 'Shell Scripting', 'Networking', 'ITIL'], preferred: ['Windows Server', 'Cloud basics', 'Monitoring tools'],
    responsibilities: ['Maintain and support enterprise applications', 'Handle incidents and service requests within SLAs', 'Work with clients on technical requirements', 'Automate routine tasks with scripts', 'Document runbooks and procedures'],
    requirements: ['Good communication and problem-solving skills', 'Familiarity with Linux and databases', 'Understanding of ITIL practices', 'Willingness to work in support rotations'],
    education: ["Bachelor's degree in Engineering, IT or a related field"] }),
  T({ key: 'database-administrator', title: 'Database Administrator', team: 'data infrastructure', baseLpa: 6, category: 'infra',
    summary: 'run fast, secure and highly available production databases',
    skills: ['MongoDB', 'MySQL', 'PostgreSQL', 'Backup & Recovery', 'Performance Tuning', 'Linux'], preferred: ['Replication', 'AWS RDS', 'Python', 'Monitoring'],
    responsibilities: ['Administer production databases and backups', 'Tune queries and indexes for performance', 'Plan capacity, replication and failover', 'Apply security patches and access controls', 'Support developers with schema design'],
    requirements: ['Hands-on experience with at least one RDBMS and one NoSQL database', 'Knowledge of backup and recovery strategies', 'Strong troubleshooting skills', 'Scripting ability'],
    education: ["Bachelor's degree in Computer Science, IT or a related field"] }),
  T({ key: 'software-engineering-intern', title: 'Software Engineering Intern', team: 'engineering', baseLpa: 0, category: 'engineering', intern: true,
    summary: 'work on real engineering projects alongside experienced mentors',
    skills: ['Python', 'JavaScript', 'Data Structures', 'Git', 'Problem Solving'], preferred: ['React', 'SQL', 'Open source contributions'],
    responsibilities: ['Contribute to a real feature or tool with a mentor', 'Write and test code following team standards', 'Present your project to the team at the end of the internship', 'Take part in code reviews and engineering sessions', 'Learn how production software is built and operated'],
    requirements: ['Currently pursuing or recently completed a relevant degree', 'Programming fundamentals in any language', 'Curiosity and willingness to learn', 'Ability to commit to the full internship duration'],
    education: ["Pursuing or recently completed a Bachelor's or Master's degree in a technical field"] }),
  T({ key: 'data-science-intern', title: 'Data Science Intern', team: 'data science', baseLpa: 0, category: 'data', intern: true,
    summary: 'explore data and build models on real business problems',
    skills: ['Python', 'SQL', 'Statistics', 'Pandas', 'Machine Learning'], preferred: ['Jupyter', 'Data Visualization', 'Scikit-learn'],
    responsibilities: ['Clean and explore datasets with guidance from a mentor', 'Prototype simple models and evaluate results', 'Create charts and summaries of your findings', 'Document experiments and share learnings', 'Present outcomes to the team'],
    requirements: ['Foundational knowledge of statistics and Python', 'Interest in data and experimentation', 'Good communication', 'Academic projects or coursework in data are a plus'],
    education: ["Pursuing a degree in Data Science, Statistics, Mathematics or Computer Science"] }),
];
const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));

// Titles used by the original demo seed (seed.js) that map to a template, so existing jobs can be enriched.
const TITLE_ALIASES = {
  'QA Engineer': 'qa-automation-engineer',
  'UI/UX Developer': 'ui-ux-designer',
  'Technical Support Engineer': 'technical-support-engineer',
  'Systems Engineer': 'systems-engineer',
  'Database Administrator': 'database-administrator',
};
const templateForTitle = (title) =>
  TEMPLATES.find((t) => t.title.toLowerCase() === String(title).toLowerCase()) || TEMPLATE_BY_KEY[TITLE_ALIASES[title]] || null;

// Which roles each company type hires for (keeps the dataset internally consistent).
const ROLE_POOLS = {
  'it-services': ['software-engineer', 'associate-software-engineer', 'backend-developer', 'full-stack-developer', 'qa-automation-engineer', 'systems-engineer', 'business-analyst', 'technical-support-engineer', 'cloud-engineer', 'database-administrator', 'cybersecurity-analyst', 'software-engineering-intern'],
  consulting: ['software-engineer', 'associate-software-engineer', 'data-analyst', 'business-analyst', 'cloud-engineer', 'cybersecurity-analyst', 'full-stack-developer', 'qa-automation-engineer', 'product-manager', 'data-engineer', 'software-engineering-intern'],
  product: ['software-engineer', 'frontend-developer', 'backend-developer', 'full-stack-developer', 'product-engineer', 'data-analyst', 'ui-ux-designer', 'devops-engineer', 'qa-automation-engineer', 'mobile-app-developer', 'product-manager', 'software-engineering-intern'],
  startup: ['frontend-developer', 'backend-developer', 'full-stack-developer', 'product-engineer', 'data-analyst', 'data-engineer', 'machine-learning-engineer', 'mobile-app-developer', 'ui-ux-designer', 'product-manager', 'devops-engineer', 'data-science-intern'],
  'big-tech': ['software-engineer', 'product-engineer', 'machine-learning-engineer', 'data-engineer', 'site-reliability-engineer', 'cloud-engineer', 'frontend-developer', 'backend-developer', 'ui-ux-designer', 'product-manager', 'devops-engineer', 'software-engineering-intern'],
};

const roundHalf = (n) => Math.round(n * 2) / 2;

// ------------------------------------------------------------------ builders
function salaryFor(template, company, expMin, rng, intl) {
  if (template.intern) {
    const perMonth = Math.round((15000 + rng() * 35000) * (TIER[company.tier] || 1) / 1000) * 1000;
    return { salaryMin: perMonth, salaryMax: Math.round(perMonth * 1.25 / 1000) * 1000, salaryCurrency: 'INR', salaryPeriod: 'month' };
  }
  const mult = 1 + 0.28 * expMin;
  const lowLpa = roundHalf(template.baseLpa * mult * (TIER[company.tier] || 1) * 0.9);
  const highLpa = roundHalf(template.baseLpa * mult * (TIER[company.tier] || 1) * 1.25);
  const inr = { min: lowLpa * 100000, max: Math.max(highLpa, lowLpa + 0.5) * 100000 };
  if (!intl) return { salaryMin: inr.min, salaryMax: inr.max, salaryCurrency: 'INR', salaryPeriod: 'year' };
  const rateInInr = toAnnualInr(1, intl.currency, 'year');
  const uplift = 3.5; // illustrative uplift so overseas figures look plausible in local currency
  return {
    salaryMin: Math.round((inr.min * uplift) / rateInInr / 1000) * 1000,
    salaryMax: Math.round((inr.max * uplift) / rateInInr / 1000) * 1000,
    salaryCurrency: intl.currency,
    salaryPeriod: 'year',
  };
}

function workModeFor(company, rng) {
  const r = rng();
  const remoteShare = company.tier === 'it-services' ? 0.05 : company.tier === 'consulting' ? 0.12 : 0.25;
  if (r < remoteShare) return 'remote';
  if (r < remoteShare + (company.tier === 'it-services' ? 0.3 : 0.4)) return 'hybrid';
  return 'onsite';
}

function levelFor(template, rng) {
  if (template.intern) return { min: 0, max: 0 };
  if (template.fresher) return { min: 0, max: 1 };
  const r = rng();
  if (template.category === 'product') return r < 0.5 ? { min: 3, max: 6 } : { min: 5, max: 9 };
  if (r < 0.28) return { min: 0, max: 2 };
  if (r < 0.52) return { min: 1, max: 3 };
  if (r < 0.74) return { min: 2, max: 4 };
  if (r < 0.9) return { min: 4, max: 6 };
  return { min: 6, max: 10 };
}

const expText = (min, max) => (min === 0 && max <= 1 ? 'freshers and recent graduates' : `candidates with ${min}-${max} years of experience`);

function buildDescription(company, title, template, loc, mode, type, level) {
  const where = mode === 'remote' ? 'a remote-first setup' : `${loc.city}${mode === 'hybrid' ? ' (hybrid)' : ''}`;
  const typeText = type === 'internship' ? 'internship' : type === 'full-time' ? 'full-time role' : `${type} role`;
  return `${company.name} is hiring a ${title} to ${template.summary}. You will join the ${template.team} team (${where}) and work closely with product, design and engineering colleagues. ` +
    `This is a ${typeText} suited to ${expText(level.min, level.max)}. ${company.description} ` +
    'This is a sample listing created for the CareerNest demo; it is not a verified live vacancy.';
}

/**
 * Builds the deterministic list of demo job documents (without jobCode/applyUrl; the seed assigns those).
 * Each doc has a stable externalId so re-seeding never duplicates a listing.
 */
function buildDemoJobs({ now = new Date() } = {}) {
  const jobs = [];
  COMPANIES.forEach((company) => {
    const rng = mulberry32(hashStr(company.name));
    const pool = [...ROLE_POOLS[company.tier]];
    // deterministic shuffle
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const count = 5 + (hashStr(company.name) % 2); // 5-6 roles per company
    pool.slice(0, count).forEach((roleKey, idx) => {
      const template = TEMPLATE_BY_KEY[roleKey];
      const level = levelFor(template, rng);
      const mode = workModeFor(company, rng);
      const international = !template.intern && mode !== 'remote' && company.tier === 'big-tech' && rng() < 0.4;
      const intl = international ? pick(rng, INTERNATIONAL) : null;
      const cityPool = company.cities.filter((c) => c !== 'Remote');
      const city = mode === 'remote' ? 'Remote' : intl ? intl.city : pick(rng, cityPool);
      const country = intl ? intl.country : 'India';
      let employmentType = template.intern ? 'internship' : 'full-time';
      if (!template.intern && ['qa-automation-engineer', 'technical-support-engineer', 'ui-ux-designer'].includes(roleKey)) {
        const r = rng();
        employmentType = r < 0.25 ? 'contract' : r < 0.32 ? 'part-time' : 'full-time';
      }
      const senior = level.min >= 4 && template.category === 'engineering' && !template.intern;
      const title = senior ? `Senior ${template.title}` : template.title;
      const sal = salaryFor(template, company, level.min, rng, intl);
      const daysAgo = Math.floor(rng() * 45);
      jobs.push({
        externalId: `demo:${slug(company.name)}:${roleKey}`,
        companyName: company.name,
        roleKey,
        title,
        city,
        country,
        workMode: mode,
        employmentType,
        experienceMinYears: level.min,
        experienceMaxYears: level.max,
        yearsRequired: level.min,
        experienceLevel: level.min === 0 && level.max <= 1 ? 'fresher' : 'experienced',
        jobDescription: buildDescription(company, title, template, { city }, mode, employmentType, level),
        skills: template.skills,
        preferredSkills: template.preferred,
        responsibilities: template.responsibilities,
        requirements: template.requirements,
        education: template.education,
        ...sal,
        source: 'demo',
        isActive: true,
        postedAt: new Date(now.getTime() - daysAgo * 86400000 - idx * 3600000),
        withApplyLink: rng() < 0.35, // some listings carry a (placeholder) external apply link
      });
    });
  });
  return jobs;
}

// Details used to enrich one of the ORIGINAL 48 demo jobs (only missing fields are ever written).
function enrichmentFor(job, company) {
  const template = templateForTitle(job.title);
  const rng = mulberry32(hashStr(String(job._id)));
  const min = job.experienceMinYears ?? job.yearsRequired ?? 0;
  const level = job.experienceLevel === 'fresher' ? { min: 0, max: 1 } : { min, max: min + 2 };
  const co = company ? COMPANIES.find((c) => c.name === company.name) || { tier: 'product' } : { tier: 'product' };
  const mode = workModeFor(co, rng);
  const patch = {
    source: 'demo',
    isActive: true,
    country: 'India',
    employmentType: 'full-time',
    workMode: mode,
    experienceMinYears: level.min,
    experienceMaxYears: level.max,
    postedAt: job.createdAt || new Date(),
    withApplyLink: rng() < 0.35,
  };
  if (template) {
    Object.assign(patch, {
      skills: template.skills,
      preferredSkills: template.preferred,
      responsibilities: template.responsibilities,
      requirements: template.requirements,
      education: template.education,
      ...salaryFor(template, co, level.min, rng, null),
    });
  }
  return patch;
}

module.exports = { COMPANIES, TEMPLATES, TEMPLATE_BY_KEY, templateForTitle, buildDemoJobs, enrichmentFor, slug };
