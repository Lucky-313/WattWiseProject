import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout.jsx";
import FrontPage from "./pages/FrontPage.jsx";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Calculator from "./pages/Calculator.jsx";
import Logbook from "./pages/Logbook.jsx";
import Reports from "./pages/Reports.jsx";
import Notfound from "./pages/Notfound.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FrontPage />} />
      <Route path="/home" element={<Home />} />
      <Route path="/logbook" element={<Logbook />} />
      <Route path="/reports" element={<Navigate to="/logbook" replace />} />
      <Route path="/dashboard/:id" element={<Dashboard />} />
      <Route path="/dashboard/:id/reports" element={<Reports />} />
      <Route element={<Layout />}>
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/simulation" element={<Navigate to="/home" replace />} />
      </Route>
      <Route path="*" element={<Notfound />} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
  );
}
