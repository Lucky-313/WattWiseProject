
import { NavLink, Outlet } from "react-router-dom";

const navigationItems = [
  { name: "Dashboard", path: "/" },
  { name: "SCI Calculator", path: "/calculator" },
  { name: "Simulation", path: "/simulation" },
  { name: "Logbook", path: "/logbook" },
  { name: "Reports", path: "/reports" },
];

export default function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          Watt<span>Wise</span>
        </div>

        <div className="brand-subtitle">
          SUSTAINABILITY PLATFORM
        </div>

        <div className="nav-heading">WORKSPACE</div>

        <nav>
          {navigationItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          WattWise · Team 20
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            Sustainability Analytics
          </div>

          <div className="topbar-status">
            ● Platform active
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
