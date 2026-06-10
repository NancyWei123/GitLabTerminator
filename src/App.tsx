import { NavLink, Outlet } from "react-router-dom";

function App() {
  return (
    <div className="app">
      <nav className="top-navbar">
        <NavLink to="/" className="nav-logo">
          <span className="logo-icon">⚡</span>
          <span>GitLabTerminator</span>
        </NavLink>

        <div className="nav-links">
          <NavLink to="/find-project">Find Project</NavLink>
          <NavLink to="/understand-project">Understand Project</NavLink>
          <NavLink to="/user-center">User Center</NavLink>
        </div>
      </nav>

      <Outlet />
    </div>
  );
}

export default App;