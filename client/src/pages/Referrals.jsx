import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

function Referrals() {
  const [company, setCompany] = useState('');
  const [referrers, setReferrers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!company) return;
    setSearching(true);
    setError('');
    try {
      const response = await axiosClient.get('/referrals/find', { params: { company } });
      setReferrers(response.data.referrers);
    } catch (err) {
      setError(`DEBUG: ${err.message} | ${JSON.stringify(err.response?.data)}`);
    } finally {
      setSearching(false);
    }
  };

  const handleRequest = async (referrerId) => {
    try {
      await axiosClient.post('/referrals', {
        seekerId: user.id,
        referrerId,
        message: `Hi, I'd love a referral at your company.`,
      });
      setMessage('Referral requested!');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Request failed');
    }
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8 text-center">Find a Referral</h1>

      <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by company (e.g. HCL)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {message && <p className="text-center text-accent font-medium mb-4">{message}</p>}
      {error && <p className="text-center text-red-600 mb-4">{error}</p>}

      <div className="max-w-xl mx-auto flex flex-col gap-4">
        {referrers.map((ref) => (
          <div key={ref._id} className="bg-white rounded-xl shadow-sm p-5 flex justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-charcoal">{ref.name}</h3>
              <p className="text-sm text-gray-500">{ref.currentCompanyRole || 'Employee'} at {ref.currentCompany}</p>
            </div>
            <button
              onClick={() => handleRequest(ref._id)}
              className="shrink-0 bg-accent text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 transition"
            >
              Request Referral
            </button>
          </div>
        ))}
        {referrers.length === 0 && company && !searching && (
          <p className="text-center text-gray-500">No referrers found for "{company}".</p>
        )}
      </div>
    </div>
  );
}

export default Referrals;