import { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage } from '../components/Feedback';
import { CheckIcon } from '../components/Icons';
import { CATEGORIES } from '../utils/support';

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 2000;
const field = 'focus-ring w-full border border-sage/60 rounded-xl px-3 py-2.5 text-sm bg-white text-ink';

function Contact() {
  const user = getUser();
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!category) return setError('Please choose what your message is about.');
    if (subject.trim().length < 3) return setError('Please enter a subject (at least 3 characters).');
    if (message.trim().length < 10) return setError('Please write a message of at least 10 characters.');
    setSending(true);
    try {
      const res = await axiosClient.post('/contact', { category, subject: subject.trim(), message: message.trim() });
      setSent(res.data?.ticket || {});
      setCategory('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send your message'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-primary">Contact Us</h1>
        <p className="text-ink/70 mt-1">Questions, feedback or something not working? Send us a message and we will take a look.</p>
        <Link to="/contact/history" className="focus-ring inline-block mt-2 text-sm text-primary underline underline-offset-2 rounded">View my previous requests and replies</Link>
      </header>

      {sent ? (
        <div className="bg-white rounded-2xl border border-sage/30 shadow-sm p-8 text-center" role="status">
          <span className="mx-auto w-12 h-12 rounded-full bg-mint text-primary flex items-center justify-center"><CheckIcon size={24} /></span>
          <h2 className="font-display text-xl font-bold text-primary mt-4">Message sent</h2>
          <p className="text-sm text-ink/70 mt-1">Thanks for reaching out. Your request was saved under your account (status: open). Replies from our team appear in your request history and in your notifications.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            {sent.id && <Link to={`/contact/history/${sent.id}`} className="focus-ring bg-primary text-white rounded-xl px-5 py-2.5 text-sm hover:bg-primary-dark transition">View request</Link>}
            <button onClick={() => setSent(null)} className="focus-ring border border-sage text-primary rounded-xl px-5 py-2.5 text-sm hover:bg-mint transition">Send another</button>
            <Link to="/dashboard" className="focus-ring border border-sage text-primary rounded-xl px-5 py-2.5 text-sm hover:bg-mint transition">Back to Dashboard</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-sage/30 shadow-sm p-6 grid gap-4" noValidate>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium text-ink">
              Name
              <input type="text" value={user?.name || ''} readOnly aria-readonly="true" className={`${field} mt-1 font-normal bg-bg/60 cursor-not-allowed`} />
            </label>
            <label className="text-sm font-medium text-ink">
              Email
              <input type="email" value={user?.email || ''} readOnly aria-readonly="true" className={`${field} mt-1 font-normal bg-bg/60 cursor-not-allowed`} />
            </label>
          </div>
          <label className="text-sm font-medium text-ink">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-1 font-normal`}>
              <option value="">Choose a category</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            <span className="flex justify-between"><span>Subject</span><span className="text-xs font-normal text-ink/55">{subject.length}/{SUBJECT_MAX}</span></span>
            <input type="text" maxLength={SUBJECT_MAX} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What is this about?" className={`${field} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium text-ink">
            <span className="flex justify-between"><span>Message</span><span className="text-xs font-normal text-ink/55">{message.length}/{MESSAGE_MAX}</span></span>
            <textarea rows={7} maxLength={MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us a little more…" className={`${field} mt-1 font-normal`} />
          </label>
          {error && <ErrorMessage message={error} />}
          <div>
            <button type="submit" disabled={sending} className="focus-ring bg-primary text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default Contact;
