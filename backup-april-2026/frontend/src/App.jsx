import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

function App() {
  const [resume, setResume] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      // Ensure your Node server is running on port 3000
      const response = await axios.post('http://localhost:3000/resume-updater', {
        resumeText: resume,
        jobDesc: jobDesc
      });
      setResult(response.data.updatedResume);
    } catch (error) {
      console.error(error);
      alert("Check if your backend server is running on port 3000!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px' }}>
      <h1>Resume AI Updater</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <section>
          <h3>Current Resume</h3>
          <textarea 
            style={{ width: '100%', height: '300px' }} 
            onChange={(e) => setResume(e.target.value)}
            placeholder="Paste your text-based resume here..."
          />
        </section>
        
        <section>
          <h3>Job Description</h3>
          <textarea 
            style={{ width: '100%', height: '300px' }} 
            onChange={(e) => setJobDesc(e.target.value)}
            placeholder="Paste the target job description here..."
          />
        </section>
      </div>

      <button 
        onClick={handleUpdate} 
        disabled={loading || !resume || !jobDesc}
        style={{ marginTop: '20px', padding: '12px 24px', fontSize: '16px' }}
      >
        {loading ? 'Gemini is thinking...' : 'Generate Tailored Resume'}
      </button>

      {result && (
        <div style={{ marginTop: '40px', borderTop: '2px solid #eee', paddingTop: '20px' }}>
          <h2>Tailored Resume</h2>
          <div style={{ background: '#f4f4f4', padding: '20px', borderRadius: '8px' }}>
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;