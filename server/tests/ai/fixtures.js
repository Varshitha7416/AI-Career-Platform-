// Sample data for the stub-based AI tests. No network, no real model.
const RESUME = `Asha Rao
Software Developer | Hyderabad

SKILLS
JavaScript, ReactJS, Node, Postgres, Git, REST APIs

EXPERIENCE
Junior Developer, Brightside Technologies (2022 - 2024)
- Built a customer dashboard with ReactJS and Redux used by 3 internal teams
- Designed REST APIs in Node and Express backed by Postgres
- Reviewed pull requests and wrote unit tests with Jest

EDUCATION
B.Tech in Computer Science, JNTU Hyderabad`;

const JOB = {
  title: 'Frontend Engineer',
  company: 'Nimbus Labs',
  description: 'Build web apps with React and TypeScript. Deploy with Docker and Kubernetes.',
  requirements: ['2+ years of frontend experience'],
  responsibilities: ['Ship UI features'],
  skills: ['React', 'JavaScript', 'TypeScript', 'Kubernetes', 'PostgreSQL'],
  preferredSkills: ['Docker'],
  education: "Bachelor's degree in Computer Science",
  experienceLevel: 'experienced',
};

module.exports = { RESUME, JOB };
