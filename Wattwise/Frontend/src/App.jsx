import { Routes, Route } from "react-router-dom";
import Layout from "./Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Calculator from "./pages/Calculator.jsx";
import Simulation from "./pages/Simulation.jsx";
import Logbook from "./pages/Logbook.jsx";
import Reports from "./pages/Reports.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/simulation" element={<Simulation />} />
        <Route path="/logbook" element={<Logbook />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  );
}
