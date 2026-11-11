import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, signup } from "../services/api.js";

const features = [
  {
    icon: "⚡",
    title: "Live Grid & SCI Analytics",
    description:
      "Stop guessing with annual averages. WattWise connects directly to live regional power grids and hardware telemetry to calculate your exact ISO 21031 SCI score per API call or active user. Watch your real-time energy impact shift between peak and clean off-peak hours.",
  },
  {
    icon: "🎛️",
    title: '"What-If" Simulation Sliders',
    description:
      "Test your impact before writing a single line of code. Use our interactive simulation sliders to mock server wattage drops, hardware upgrades, or code refactoring. Instantly see the projected percentage drop in carbon emissions and SCI score right on your charts.",
  },
  {
    icon: "🛡️",
    title: "Automated SLA Logbook",
    description:
      "Set your green boundaries and let WattWise stand guard. Define custom sustainability thresholds (like 0.05g CO₂ per 100 calls). If your infrastructure spikes, our automated monitor catches the breach immediately and logs a full diagnostic breakdown of peak times and variance.",
  },
];

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M17.8 3.5 8.2 17h6.4l-.6 11.5L23.8 15h-6.4l.4-11.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function FeatureCard({ feature, index }) {
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <article
      className={`feature-card${visible ? " is-visible" : ""}`}
      ref={cardRef}
      style={{ "--card-index": index }}
    >
      <div className="feature-icon" aria-hidden="true">
        {feature.icon}
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.description}</p>
      <span className="feature-line" aria-hidden="true" />
    </article>
  );
}

export default function FrontPage() {
  const navigate = useNavigate();
  const nameInputRef = useRef(null);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const isSignup = mode === "signup";

  useEffect(() => {
    if (isSignup) nameInputRef.current?.focus();
  }, [isSignup]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setErrors({});
    setRequestError("");
  }

  function validateForm() {
    const nextErrors = {};
    if (isSignup && name.trim().length < 2) {
      nextErrors.name = "Enter your name (at least 2 characters).";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Enter your password.";
    } else if (isSignup && password.length < 8) {
      nextErrors.password = "Use at least 8 characters for your password.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setRequestError("");
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const session = isSignup
        ? await signup({ name: name.trim(), email: email.trim(), password })
        : await login({ email: email.trim(), password });

      if (typeof session.access_token !== "string" || !session.access_token) {
        throw new Error("The server did not return a valid sign-in session.");
      }

      sessionStorage.setItem("wattwise_access_token", session.access_token);
      navigate("/home", { replace: true });
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "We couldn't sign you in. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="landing-page">
      <div className="landing-shell">
        <header className="landing-header">
          <a className="brand-lockup" href="/" aria-label="WattWise home">
            <BrandMark />
            <span>WattWise</span>
          </a>
          <div className="header-note">
            <span className="status-dot" />
            Sustainability, measured
          </div>
        </header>

        <section className="hero-grid" aria-label="Welcome to WattWise">
          <div className="auth-card">
            <div className="auth-intro">
              <span className="eyebrow">YOUR ENGINEERING, IN BALANCE</span>
              <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
              <p>
                {isSignup
                  ? "Start making every deployment a little lighter."
                  : "Sign in to your sustainability command centre."}
              </p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignup}
                className={!isSignup ? "active" : ""}
                onClick={() => changeMode("login")}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignup}
                className={isSignup ? "active" : ""}
                onClick={() => changeMode("signup")}
              >
                Create Account
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {isSignup && (
                <div className="field-group">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    ref={nameInputRef}
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                  {errors.name && (
                    <span className="field-error" id="name-error">
                      {errors.name}
                    </span>
                  )}
                </div>
              )}

              <div className="field-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <span className="field-error" id="email-error">
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <label htmlFor="password">Password</label>
                  {!isSignup && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setResetOpen(true)}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                {errors.password && (
                  <span className="field-error" id="password-error">
                    {errors.password}
                  </span>
                )}
              </div>

              {requestError && (
                <div className="request-error" role="alert">
                  <span aria-hidden="true">!</span>
                  {requestError}
                </div>
              )}

              <button className="submit-button" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    {isSignup ? "Creating account..." : "Signing in..."}
                  </>
                ) : (
                  <>
                    {isSignup ? "Create Account" : "Sign In"}
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="auth-footnote">
              <span className="lock-icon" aria-hidden="true">⌑</span>
              Your session is limited to this browser tab.
            </div>
          </div>

          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="kicker-line" />
              THE FUTURE OF RESPONSIBLE SOFTWARE
            </div>
            <h2>
              Measure, Simulate, and Shrink Your Software’s Carbon Footprint.
            </h2>
            <p className="hero-description">
              Welcome to WattWise—the real-time sustainability command centre
              for modern engineering teams. Track your live Software Carbon
              Intensity (SCI), test code optimizations before you deploy, and
              keep your digital infrastructure clean, fast, and compliant.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="button-primary"
                onClick={() => navigate("/home")}
              >
                Explore Live Dashboards <span aria-hidden="true">↗</span>
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  changeMode("signup");
                }}
              >
                + Create New Workspace
              </button>
            </div>
            <div className="hero-metrics" aria-label="WattWise metrics">
              <div>
                <strong>SCI</strong>
                <span>ISO 21031 aligned</span>
              </div>
              <span className="metric-divider" />
              <div>
                <strong>Real-time</strong>
                <span>Grid-aware insights</span>
              </div>
              <span className="metric-divider" />
              <div>
                <strong>CO₂</strong>
                <span>Impact, made visible</span>
              </div>
            </div>
            <div className="hero-decoration" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit-core"><BrandMark /></div>
              <span className="orbit-label label-one">kWh</span>
              <span className="orbit-label label-two">gCO₂</span>
              <span className="orbit-label label-three">SCI</span>
            </div>
          </div>
        </section>

        <section className="features-section" aria-labelledby="features-title">
          <div className="features-heading">
            <div>
              <span className="eyebrow">BUILT FOR BETTER SYSTEMS</span>
              <h2 id="features-title">What to Expect</h2>
            </div>
            <p>Clarity for every decision, from the grid to your code.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </section>

        <footer className="landing-footer">
          <a className="footer-brand" href="/">
            <BrandMark /> WattWise
          </a>
          <span>Make every watt count.</span>
          <span className="footer-version">ENGINEERING A LIGHTER WEB</span>
        </footer>
      </div>

      {resetOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setResetOpen(false);
          }}
        >
          <section
            className="reset-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => setResetOpen(false)}
            >
              ×
            </button>
            <span className="modal-icon" aria-hidden="true">✳</span>
            <h2 id="reset-title">Password reset</h2>
            <p>
              Password reset isn’t available yet. Contact your workspace
              administrator for help recovering your account.
            </p>
            <button
              type="button"
              className="submit-button"
              onClick={() => setResetOpen(false)}
            >
              Got it
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
