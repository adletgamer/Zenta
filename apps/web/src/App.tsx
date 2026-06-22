import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ProductionPlanning } from './pages/ProductionPlanning';
import { OperatorAssignment } from './pages/OperatorAssignment';
import { RateManagement } from './pages/RateManagement';
import { WeeklyPayroll } from './pages/WeeklyPayroll';
import { AuditLog } from './pages/AuditLog';
import { ZkVerification } from './pages/ZkVerification';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/production" element={<ProductionPlanning />} />
          <Route path="/operators" element={<OperatorAssignment />} />
          <Route path="/rates" element={<RateManagement />} />
          <Route path="/payroll" element={<WeeklyPayroll />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/zk" element={<ZkVerification />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
