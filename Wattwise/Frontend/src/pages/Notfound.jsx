import { Link } from "react-router-dom";

export default function Notfound() {
  return (
    <main className="not-found-page">
      <p className="not-found-code">404</p>
      <h1>Page not found</h1>
      <p>That page doesn’t exist. Head back to WattWise to continue.</p>
      <Link to="/">Back to WattWise</Link>
    </main>
  );
}