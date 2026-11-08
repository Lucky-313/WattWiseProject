import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div>
      <header>
        <h1>WattWise</h1>
        <nav>
          <NavLink to="/">Dashboard</NavLink>{" | "}
          <NavLink to="/calculator">SCI Calculator</NavLink>{" | "}
          <NavLink to="/simulation">Simulation</NavLink>{" | "}
          <NavLink to="/logbook">Logbook</NavLink>{" | "}
          <NavLink to="/reports">Reports</NavLink>
        </nav>
        <hr />
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        <hr />
        <p>WattWise - Team 20</p>
      </footer>
    </div>
  );
}
