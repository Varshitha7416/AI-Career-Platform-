import { Link } from 'react-router-dom';
import LegalPage from '../components/legal/LegalPage';

const SECTIONS = [
  {
    id: 'about',
    title: 'About these terms',
    body: (
      <>
        <p>These terms describe the rules for using CareerNest, a career platform for job discovery, application tracking, AI resume feedback, AI cover letter drafting, interview scheduling, career programs and referral requests between users.</p>
        <p>By creating an account (you confirm this by ticking the agreement box on the sign-up form) or by using CareerNest, you agree to these terms. If you do not agree, please do not use the service. Please also read the <Link to="/privacy">Privacy Policy</Link>, which explains what data is stored.</p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <ul>
        <li>Give accurate information when you sign up and keep your profile reasonably up to date. Do not claim experience, education, employers or skills that are not yours.</li>
        <li>Keep your password secret. You are responsible for activity that happens through your account. Passwords are stored only as a one-way hash, and CareerNest cannot show you your current password.</li>
        <li>If you change your password, sessions started with the older password are signed out.</li>
        <li>Tell us through the Contact page if you think someone else has accessed your account.</li>
      </ul>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>abuse the service, attempt to break or bypass its security, or interfere with other people&rsquo;s use of it;</li>
          <li>scrape, crawl or otherwise collect data from CareerNest in bulk or with automated tools, or send automated or excessive requests;</li>
          <li>send spam, fake or misleading referral requests, or messages that harass or deceive other users, or use referral requests for anything other than a genuine request for a referral;</li>
          <li>upload resumes or other content that contain another person&rsquo;s data unless you have the right to share it, or upload malicious files;</li>
          <li>impersonate another person, or misrepresent your employer or your ability to refer someone;</li>
          <li>use the service for anything unlawful.</li>
        </ul>
        <p>CareerNest limits some actions (for example how many referral requests or contact messages you can send in a period) to reduce misuse. These limits can change.</p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content',
    body: (
      <>
        <p>Your content includes your profile details, resumes, messages and anything else you enter. You keep ownership of it. You allow CareerNest to store and process it only to provide the features you use, such as showing it back to you, running AI analysis on it when you ask, and sharing a resume copy with a person you send a referral request to.</p>
        <p>You are responsible for making sure you may upload and share what you add. Resume uploads accept PDF, DOCX or TXT files up to 5 MB; CareerNest keeps the text extracted from the file, not the original file. See the <Link to="/privacy">Privacy Policy</Link> for details.</p>
      </>
    ),
  },
  {
    id: 'job-listings',
    title: 'Job listings and sample data',
    body: (
      <>
        <p>Many job listings and career programs in CareerNest are sample (demo) content created for the platform. Listings of this kind carry a &ldquo;Demo&rdquo; badge and are not verified live vacancies. Apply links on sample listings may be placeholders.</p>
        <p>Do not rely on a listing, salary range, company description or program detail in CareerNest as accurate or current. Check the employer&rsquo;s or provider&rsquo;s own site before acting on it. CareerNest does not guarantee that any job exists, is open, or will lead to an interview or offer.</p>
        <p>Job recommendations are produced by fixed matching rules using your target role, resume skills and preferences. They are suggestions, not advice and not a prediction of success.</p>
      </>
    ),
  },
  {
    id: 'referrals',
    title: 'Referrals',
    body: (
      <>
        <p>The referral feature lets you ask other CareerNest users who say they work at a company to refer you. Whether someone replies or refers you is entirely their own voluntary choice. CareerNest does not guarantee that anyone will respond, accept or refer you, and does not guarantee any hiring outcome.</p>
        <p>The company and role shown for a referrer are what that person entered about themselves; CareerNest does not verify employment. If you opt in as a referrer, you decide whom to help and you should only mark a request as referred after you have actually submitted the referral through your company&rsquo;s own process.</p>
        <p>When you send a request, a copy of the chosen resume&rsquo;s text is attached to it. Read the <Link to="/privacy#referrals">Privacy Policy</Link> so you know how that copy is handled before you send a request.</p>
      </>
    ),
  },
  {
    id: 'ai-content',
    title: 'AI-generated content',
    body: (
      <>
        <p>Resume analyses and cover letters are generated with an AI model. AI output can be wrong, incomplete, out of date or not a good fit for you. It may miss skills, misjudge a match, or phrase things in a way you would not choose.</p>
        <ul>
          <li>Always read and check AI output yourself before you rely on it or send it to anyone.</li>
          <li>Do not submit a generated cover letter that states things about you that are not true.</li>
          <li>A match percentage or score from CareerNest is an estimate. It is not the result of an employer&rsquo;s applicant tracking system and does not predict hiring decisions.</li>
        </ul>
        <p>You are responsible for what you submit to employers.</p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes to the service',
    body: (
      <p>CareerNest is provided as available. It may be unavailable from time to time, features can change or be removed, and AI features depend on an outside service that can fail or be limited. We do not promise uninterrupted or error-free operation, and you should keep your own copies of anything important, such as your resume files.</p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers and limits of responsibility',
    body: (
      <>
        <p>CareerNest is provided &ldquo;as is&rdquo;, without promises about accuracy, availability or results. We do not guarantee that you will find a job, get an interview, receive a referral or reach any particular career outcome.</p>
        <p>To the extent the law allows, CareerNest is not responsible for decisions you make based on its content, for the actions of other users or employers, or for losses that come from using or being unable to use the service. Nothing in these terms limits rights that the law says cannot be limited.</p>
      </>
    ),
  },
  {
    id: 'ending',
    title: 'Ending your use',
    body: (
      <>
        <p>You can stop using CareerNest at any time and log out. CareerNest may restrict or close accounts that break these terms.</p>
        <p>There is currently no self-service button to delete your whole account. You can delete individual items yourself (see the Privacy Policy), and you can ask us to handle a broader request through the <Link to="/contact">Contact page</Link>.</p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: <p>We may update these terms as the product changes. The &ldquo;Last updated&rdquo; date at the top shows when this version was written. Continuing to use CareerNest after a change means you accept the updated terms.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <p>For questions about these terms, use the <Link to="/contact">Contact page</Link> inside CareerNest (you need to be logged in to send a message).</p>,
  },
];

function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms explain what you can expect from CareerNest and what we expect from you. They are written in plain language and describe the service as it works today."
      sections={SECTIONS}
      other={{ to: '/privacy', label: 'Privacy Policy' }}
    />
  );
}

export default Terms;
