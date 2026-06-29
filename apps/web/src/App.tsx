import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { OperatorAssignment } from './pages/OperatorAssignment';
import { WeeklyPayroll } from './pages/WeeklyPayroll';
import { AuditLog } from './pages/AuditLog';
import { ZkVerification } from './pages/ZkVerification';
import { Admin } from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/production" element={<Navigate to="/" replace />} />
          <Route path="/operators" element={<OperatorAssignment />} />
          <Route path="/rates" element={<Navigate to="/operators" replace />} />
          <Route path="/payroll" element={<WeeklyPayroll />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/zk" element={<ZkVerification />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
