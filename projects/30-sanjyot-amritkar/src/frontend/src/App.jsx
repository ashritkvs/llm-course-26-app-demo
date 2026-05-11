import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Onboarding from './pages/Onboarding.jsx';
import BurnoutTracker from './pages/BurnoutTracker.jsx';
import WorkoutPlanner from './pages/WorkoutPlanner.jsx';
import Results from './pages/Results.jsx';
import History from './pages/History.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { getHealth } from './services/api.js';

const App = () => {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    let isMounted = true;
    getHealth()
      .then(() => {
        if (isMounted) setApiStatus('ok');
      })
      .catch(() => {
        if (isMounted) setApiStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Layout apiStatus={apiStatus}>
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/burnout" element={<BurnoutTracker />} />
        <Route path="/workout" element={<WorkoutPlanner />} />
        <Route path="/history" element={<History />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </Layout>
  );
};

export default App;
