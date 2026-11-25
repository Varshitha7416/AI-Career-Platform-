/*
 * Curated DEMO career programs for CareerNest.
 *
 * Provider names are real organisations, but this content is demo data: titles/durations/descriptions are
 * illustrative and may not match what a provider currently offers. `url` is ONLY the provider's public home page
 * (no course URLs are invented). Every program is flagged source: 'demo'.
 */
const NOTE = ' (Curated demo listing: check the provider for current details.)';

const PROGRAMS = [
  { slug: 'full-stack-web-development-foundations', title: 'Full-Stack Web Development Foundations', provider: 'freeCodeCamp', category: 'Software Engineering', level: 'Beginner', duration: '12 weeks', skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js'], url: 'https://www.freecodecamp.org', theme: 'forest',
    description: 'Learn to build complete web applications: responsive pages, interactive front ends with React and server-side APIs with Node.js, through hands-on projects.' + NOTE },
  { slug: 'introduction-to-computer-science', title: 'Introduction to Computer Science', provider: 'Harvard CS50', category: 'Software Engineering', level: 'Beginner', duration: '11 weeks', skills: ['C', 'Python', 'Algorithms', 'Data Structures'], url: 'https://cs50.harvard.edu', theme: 'moss',
    description: 'A broad introduction to programming and computational thinking, covering algorithms, data structures, memory and web development with weekly problem sets.' + NOTE },
  { slug: 'data-structures-and-algorithms', title: 'Data Structures and Algorithms', provider: 'NPTEL', category: 'Software Engineering', level: 'Intermediate', duration: '12 weeks', skills: ['Data Structures', 'Algorithms', 'Complexity Analysis', 'Problem Solving'], url: 'https://nptel.ac.in', theme: 'sage',
    description: 'Strengthen the fundamentals that technical interviews test: arrays, trees, graphs, sorting, dynamic programming and complexity analysis.' + NOTE },
  { slug: 'azure-fundamentals-learning-path', title: 'Azure Fundamentals Learning Path', provider: 'Microsoft Learn', category: 'Cloud & DevOps', level: 'Beginner', duration: '4 weeks', skills: ['Azure', 'Cloud Concepts', 'Security', 'Networking'], url: 'https://learn.microsoft.com', theme: 'sage',
    description: 'Understand core cloud concepts and the main Azure services for compute, storage, networking and security, with guided modules and sandbox exercises.' + NOTE },
  { slug: 'aws-cloud-practitioner-essentials', title: 'AWS Cloud Practitioner Essentials', provider: 'AWS Skill Builder', category: 'Cloud & DevOps', level: 'Beginner', duration: '3 weeks', skills: ['AWS', 'Cloud Economics', 'Core Services', 'Security'], url: 'https://skillbuilder.aws', theme: 'mint',
    description: 'A first look at the AWS cloud: global infrastructure, core services, pricing models and the shared responsibility model.' + NOTE },
  { slug: 'kubernetes-and-cloud-native-fundamentals', title: 'Kubernetes and Cloud Native Fundamentals', provider: 'Linux Foundation', category: 'Cloud & DevOps', level: 'Advanced', duration: '6 weeks', skills: ['Kubernetes', 'Containers', 'Observability', 'CI/CD'], url: 'https://training.linuxfoundation.org', theme: 'forest',
    description: 'Go deeper into container orchestration and the cloud-native ecosystem: deployments, services, scaling, observability and delivery pipelines.' + NOTE },
  { slug: 'google-data-analytics-certificate', title: 'Data Analytics Certificate', provider: 'Google Career Certificates', category: 'Data & AI', level: 'Beginner', duration: '6 months (flexible)', skills: ['SQL', 'Spreadsheets', 'Data Visualization', 'R'], url: 'https://grow.google/certificates', theme: 'moss',
    description: 'Job-focused training in the data analysis workflow: asking questions, cleaning data, analysing with SQL and spreadsheets and presenting findings.' + NOTE },
  { slug: 'machine-learning-specialization', title: 'Machine Learning Specialization', provider: 'Coursera', category: 'Data & AI', level: 'Intermediate', duration: '3 months', skills: ['Python', 'Machine Learning', 'Neural Networks', 'Model Evaluation'], url: 'https://www.coursera.org', theme: 'forest',
    description: 'Learn supervised and unsupervised learning, neural networks and practical advice for building and evaluating models, with coding assignments.' + NOTE },
  { slug: 'intro-to-machine-learning-and-pandas', title: 'Intro to Machine Learning and Pandas', provider: 'Kaggle Learn', category: 'Data & AI', level: 'Beginner', duration: '2 weeks', skills: ['Python', 'Pandas', 'Scikit-learn', 'Data Cleaning'], url: 'https://www.kaggle.com/learn', theme: 'mint',
    description: 'Short, hands-on lessons to get productive with data in Python and train your first models on real datasets.' + NOTE },
  { slug: 'ux-design-fundamentals', title: 'UX Design Fundamentals', provider: 'Interaction Design Foundation', category: 'Design', level: 'Beginner', duration: '8 weeks', skills: ['User Research', 'Wireframing', 'Prototyping', 'Usability Testing'], url: 'https://www.interaction-design.org', theme: 'sage',
    description: 'Understand the user-centred design process from research to prototyping and testing, and build a portfolio-ready case study.' + NOTE },
  { slug: 'interview-preparation-and-communication', title: 'Interview Preparation and Communication Skills', provider: 'LinkedIn Learning', category: 'Career Skills', level: 'Beginner', duration: '3 weeks', skills: ['Interviewing', 'Communication', 'Storytelling', 'Negotiation'], url: 'https://www.linkedin.com/learning', theme: 'moss',
    description: 'Practise answering common questions, telling your project stories clearly and handling offers, with short video lessons and exercises.' + NOTE },
  { slug: 'resume-writing-and-personal-branding', title: 'Resume Writing and Personal Branding', provider: 'edX', category: 'Career Skills', level: 'Beginner', duration: '2 weeks', skills: ['Resume Writing', 'Personal Branding', 'LinkedIn', 'Networking'], url: 'https://www.edx.org', theme: 'mint',
    description: 'Turn your experience into a focused resume and online profile that recruiters notice, and learn how to network effectively.' + NOTE },
];

module.exports = { PROGRAMS };
