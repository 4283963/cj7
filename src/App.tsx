import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ClusterJobs from '@/pages/ClusterJobs';
import FluidVisualization from '@/pages/FluidVisualization';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/cluster/jobs" replace />} />
        <Route path="/cluster/jobs" element={<ClusterJobs />} />
        <Route path="/cluster/fluid" element={<FluidVisualization />} />
        <Route path="*" element={<Navigate to="/cluster/jobs" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
