import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ACCESS_TOKEN_KEY,
  createDashboard,
  deleteDashboard,
  getDashboards,
  getTelemetry,
  updateDashboardSettings,
  uploadDashboardCsv,
  verifyDashboardPasscode,
} from "../services/api.js";

const MAX_DASHBOARDS = 3;

function BrandMark() {
  return (
    <span className="workspace-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M17.8 3.5 8.2 17h6.4l-.6 11.5L23.8 15h-6.4l.4-11.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="workspace-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="workspace-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-modal-title"
      >
        <div className="workspace-modal-heading">
          <div>
            <span className="workspace-eyebrow">WATTWISE WORKSPACE</span>
            <h2 id="workspace-modal-title">{title}</h2>
          </div>
          <button
            type="button"
            className="workspace-modal-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FileDropzone({ file, onFile, error }) {
  const [dragging, setDragging] = useState(false);

  function acceptFile(candidate) {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".csv")) {
      onFile(null, "Choose a .csv file.");
      return;
    }
    if (candidate.size > 5 * 1024 * 1024) {
      onFile(null, "CSV files must be 5 MB or smaller.");
      return;
    }
    onFile(candidate, "");
  }

  return (
    <label
      className={`workspace-dropzone${dragging ? " is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        acceptFile(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          acceptFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <span className="workspace-upload-icon" aria-hidden="true">↑</span>
      <span className="workspace-drop-title">
        {file ? file.name : "Drop your CSV here, or browse"}
      </span>
      <span className="workspace-drop-help">
        CSV file · up to 5 MB {file ? `· ${(file.size / 1024).toFixed(0)} KB` : ""}
      </span>
      {error && <span className="workspace-field-error">{error}</span>}
    </label>
  );
}

function PasscodeChoices({ value, onChange }) {
  return (
    <div className="workspace-segmented" role="group" aria-label="Protect with a passcode">
      <span>Protect with a passcode?</span>
      <div>
        <button
          type="button"
          className={value ? "selected" : ""}
          aria-pressed={value}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={!value ? "selected" : ""}
          aria-pressed={!value}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    </div>
  );
}

function DashboardBar({ dashboard, onOpen, onSettings }) {
  return (
    <div
      className="workspace-dashboard-bar configured"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open ${dashboard.name}`}
    >
      <div className="workspace-dashboard-copy">
        <div className="workspace-dashboard-title-row">
          <h3>{dashboard.name}</h3>
          {dashboard.is_locked && (
            <span className="workspace-lock-badge">
              <span aria-hidden="true">▣</span> Locked
            </span>
          )}
        </div>
        <div className="workspace-dashboard-meta">
          <span>
            <i className={`workspace-source-dot ${dashboard.has_csv ? "csv" : ""}`} />
            {dashboard.has_csv
              ? `CSV · ${dashboard.csv_filename}`
              : dashboard.input_method === "csv"
                ? "CSV import · awaiting data"
                : "Manual entry"}
          </span>
          <span className="workspace-meta-divider" />
          <span className="workspace-sci">
            SCI{" "}
            {dashboard.sci_summary === null || dashboard.sci_summary === undefined
              ? "—"
              : Number(dashboard.sci_summary).toFixed(3)}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="workspace-settings-button"
        aria-label={`Settings for ${dashboard.name}`}
        title="Dashboard settings"
        onClick={(event) => {
          event.stopPropagation();
          onSettings();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="m19.2 13.1 1.1.85-1.6 2.77-1.3-.52a7.6 7.6 0 0 1-1.7.98l-.2 1.4h-3.2l-.2-1.4a7.6 7.6 0 0 1-1.7-.98l-1.3.52-1.6-2.77 1.1-.85a7.8 7.8 0 0 1 0-2.2l-1.1-.85 1.6-2.77 1.3.52a7.6 7.6 0 0 1 1.7-.98l.2-1.4h3.2l.2 1.4a7.6 7.6 0 0 1 1.7.98l1.3-.52 1.6 2.77-1.1.85a7.8 7.8 0 0 1 0 2.2Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGuestPreview = searchParams.get("preview") === "1";
  const openedSettingsFor = useRef("");
  const [dashboards, setDashboards] = useState([]);
  const [emptySlots, setEmptySlots] = useState(1);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [setupOpen, setSetupOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState("");
  const [protectWithPasscode, setProtectWithPasscode] = useState(false);
  const [newPasscode, setNewPasscode] = useState("");
  const [inputMethod, setInputMethod] = useState("manual");
  const [setupFile, setSetupFile] = useState(null);
  const [setupFileError, setSetupFileError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);

  const [unlockDashboard, setUnlockDashboard] = useState(null);
  const [unlockPasscode, setUnlockPasscode] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);

  const [settingsDashboard, setSettingsDashboard] = useState(null);
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [removePasscode, setRemovePasscode] = useState(false);
  const [setPasscode, setSetPasscode] = useState(false);
  const [settingsPasscode, setSettingsPasscode] = useState("");
  const [settingsFile, setSettingsFile] = useState(null);
  const [settingsFileError, setSettingsFileError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const modalOpen = setupOpen || Boolean(unlockDashboard) || Boolean(settingsDashboard);
  const emptyIndices = useMemo(
    () => Array.from({ length: emptySlots }, (_, index) => index),
    [emptySlots]
  );

  useEffect(() => {
    if (isGuestPreview) {
      setDashboards([]);
      setEmptySlots(1);
      setTelemetry(null);
      setPageError("");
      setLoading(false);
      return undefined;
    }

    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      navigate("/", { replace: true });
      return undefined;
    }

    let active = true;
    setLoading(true);
    Promise.all([getDashboards(), getTelemetry()])
      .then(([savedDashboards, currentTelemetry]) => {
        if (!active) return;
        setDashboards(savedDashboards);
        setEmptySlots(savedDashboards.length < MAX_DASHBOARDS ? 1 : 0);
        setTelemetry(currentTelemetry);
        setPageError("");
      })
      .catch((error) => {
        if (!active) return;
        if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
          navigate("/", { replace: true });
          return;
        }
        setPageError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isGuestPreview, navigate]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") closeModals();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  useEffect(() => {
    const settingsId = searchParams.get("settings");
    const requestedDashboard = dashboards.find(
      (dashboard) => String(dashboard.dashboard_id) === settingsId
    );
    if (
      requestedDashboard &&
      openedSettingsFor.current !== String(requestedDashboard.dashboard_id)
    ) {
      openedSettingsFor.current = String(requestedDashboard.dashboard_id);
      openSettings(requestedDashboard);
    }
  }, [dashboards, searchParams]);

  function closeModals() {
    setSetupOpen(false);
    setUnlockDashboard(null);
    setSettingsDashboard(null);
    setSetupError("");
    setUnlockError("");
    setSettingsError("");
  }

  function openSetup() {
    setDashboardName("");
    setProtectWithPasscode(false);
    setNewPasscode("");
    setInputMethod("manual");
    setSetupFile(null);
    setSetupFileError("");
    setSetupError("");
    setSetupOpen(true);
  }

  function openUnlock(dashboard) {
    setUnlockPasscode("");
    setUnlockError("");
    setUnlockDashboard(dashboard);
  }

  function openSettings(dashboard) {
    setCurrentPasscode("");
    setRemovePasscode(false);
    setSetPasscode(false);
    setSettingsPasscode("");
    setSettingsFile(null);
    setSettingsFileError("");
    setSettingsError("");
    setConfirmDelete(false);
    setSettingsDashboard(dashboard);
  }

  function logout() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("wattwise_dashboard_unlock_"))
      .forEach((key) => sessionStorage.removeItem(key));
    navigate("/", { replace: true });
  }

  async function finishSetup(event) {
    event.preventDefault();
    setSetupError("");
    if (!dashboardName.trim()) {
      setSetupError("Enter a dashboard name.");
      return;
    }
    if (protectWithPasscode && newPasscode.length < 4) {
      setSetupError("Passcodes must be at least 4 characters.");
      return;
    }
    if (setupFileError) {
      setSetupError(setupFileError);
      return;
    }

    setSetupBusy(true);
    try {
      const request = {
        name: dashboardName.trim(),
        protect_with_passcode: protectWithPasscode,
        passcode: protectWithPasscode ? newPasscode : null,
        input_method: inputMethod,
      };
      if (setupFile) {
        request.csv_filename = setupFile.name;
        request.csv_content = await setupFile.text();
      }
      const dashboard = await createDashboard(request);
      if (dashboard.dashboard_access_token) {
        sessionStorage.setItem(
          `wattwise_dashboard_unlock_${dashboard.dashboard_id}`,
          dashboard.dashboard_access_token
        );
      }
      navigate(`/dashboard/${dashboard.dashboard_id}`);
    } catch (error) {
      if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
        navigate("/", { replace: true });
        return;
      }
      setSetupError(error.message);
    } finally {
      setSetupBusy(false);
    }
  }

  async function unlock(event) {
    event.preventDefault();
    if (!unlockDashboard) return;
    setUnlockError("");
    setUnlockBusy(true);
    try {
      const result = await verifyDashboardPasscode(
        unlockDashboard.dashboard_id,
        unlockPasscode
      );
      if (result.dashboard_access_token) {
        sessionStorage.setItem(
          `wattwise_dashboard_unlock_${unlockDashboard.dashboard_id}`,
          result.dashboard_access_token
        );
      }
      navigate(`/dashboard/${unlockDashboard.dashboard_id}`);
    } catch (error) {
      setUnlockError(error.message);
    } finally {
      setUnlockBusy(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!settingsDashboard) return;
    setSettingsError("");
    if (settingsFileError) {
      setSettingsError(settingsFileError);
      return;
    }
    if (setPasscode && settingsPasscode.length < 4) {
      setSettingsError("Passcodes must be at least 4 characters.");
      return;
    }

    setSettingsBusy(true);
    try {
      const id = settingsDashboard.dashboard_id;
      const wasLocked = settingsDashboard.is_locked;
      if (settingsFile && wasLocked) {
        const result = await verifyDashboardPasscode(id, currentPasscode);
        if (result.dashboard_access_token) {
          sessionStorage.setItem(
            `wattwise_dashboard_unlock_${id}`,
            result.dashboard_access_token
          );
        }
      }
      if (removePasscode || setPasscode) {
        const updated = await updateDashboardSettings(id, {
          current_passcode: currentPasscode || null,
          new_passcode: setPasscode ? settingsPasscode : null,
          remove_passcode: removePasscode,
        });
        setDashboards((items) =>
          items.map((item) =>
            item.dashboard_id === id ? { ...item, ...updated } : item
          )
        );
      }
      if (settingsFile) {
        const updated = await uploadDashboardCsv(id, settingsFile);
        setDashboards((items) =>
          items.map((item) =>
            item.dashboard_id === id ? { ...item, ...updated } : item
          )
        );
      }
      closeModals();
    } catch (error) {
      if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
        navigate("/", { replace: true });
        return;
      }
      setSettingsError(error.message);
    } finally {
      setSettingsBusy(false);
    }
  }

  async function removeDashboard() {
    if (!settingsDashboard) return;
    setSettingsError("");
    setDeleteBusy(true);
    try {
      const id = settingsDashboard.dashboard_id;
      await deleteDashboard(id, currentPasscode || null);
      sessionStorage.removeItem(`wattwise_dashboard_unlock_${id}`);
      setDashboards((items) =>
        items.filter((item) => item.dashboard_id !== id)
      );
      setEmptySlots((count) =>
        Math.min(Math.max(count, 1), MAX_DASHBOARDS - (dashboards.length - 1))
      );
      closeModals();
    } catch (error) {
      if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
        navigate("/", { replace: true });
        return;
      }
      setSettingsError(error.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const dashboardCount = dashboards.length + emptySlots;

  return (
    <main className="workspace-page">
      <div className="workspace-shell">
        <header className="workspace-topbar">
          <div className="workspace-topbar-left">
            <a className="workspace-brand" href="/home">
              <BrandMark />
              <span>WattWise</span>
            </a>
            <span className="workspace-header-divider" />
            <span className="workspace-header-label">Workspace</span>
          </div>
          <div className="workspace-topbar-right">
            <section className="workspace-telemetry" aria-label="Live grid telemetry">
              <div className="workspace-telemetry-icon" aria-hidden="true">↗</div>
              <div className="workspace-telemetry-content">
                <div className="workspace-telemetry-label">
                  <span className="workspace-live-dot" />
                  REGIONAL GRID <span>· {telemetry?.region || "GB"}</span>
                </div>
                <div className="workspace-telemetry-values">
                  <span>
                    <strong className="workspace-mono">
                      {telemetry
                        ? Number(telemetry.carbon_intensity_gco2_kwh).toFixed(0)
                        : "—"}
                    </strong>
                    <small>gCO₂/kWh</small>
                  </span>
                  <i />
                  <span>
                    <strong className="workspace-mono">
                      {telemetry?.ambient_temperature_c == null
                        ? "N/A"
                        : `${Number(telemetry.ambient_temperature_c).toFixed(1)}°`}
                    </strong>
                    <small>ambient</small>
                  </span>
                </div>
              </div>
            </section>
            {isGuestPreview ? (
              <button
                type="button"
                className="workspace-preview-login"
                onClick={() => navigate("/")}
              >
                Sign in
              </button>
            ) : (
              <button type="button" className="workspace-logout" onClick={logout}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M8 3.5H4.75a1.25 1.25 0 0 0-1.25 1.25v10.5a1.25 1.25 0 0 0 1.25 1.25H8m3-3 3-3m0 0-3-3m3 3H7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Log out
              </button>
            )}
          </div>
        </header>

        {isGuestPreview && (
          <div className="workspace-preview-notice">
            <span>Preview mode</span>
            Sign in to create, edit, or save your workspaces.
          </div>
        )}

        <section className="workspace-intro">
          <div>
            <span className="workspace-eyebrow">YOUR ENGINEERING, IN BALANCE</span>
            <h1>Your workspaces</h1>
            <p>
              A clearer picture of the energy behind your software.
              Configure a dashboard to get started.
            </p>
          </div>
          <div className="workspace-count">
            <span className="workspace-count-number">
              {dashboards.length.toString().padStart(2, "0")}
            </span>
            <span>of {MAX_DASHBOARDS} workspaces</span>
          </div>
        </section>

        {pageError && (
          <div className="workspace-page-error" role="alert">
            <span>{pageError}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              aria-label="Retry loading"
            >
              Retry
            </button>
          </div>
        )}

        <section className="workspace-list-section" aria-labelledby="dashboards-title">
          <div className="workspace-list-heading">
            <div>
              <h2 id="dashboards-title">Dashboards</h2>
              <p>Open a workspace or configure a new one.</p>
            </div>
            <span className="workspace-list-cap">
              {dashboardCount} / {MAX_DASHBOARDS} SLOTS
            </span>
          </div>

          <div className="workspace-dashboard-list">
            {dashboards.map((dashboard) => (
              <DashboardBar
                key={dashboard.dashboard_id}
                dashboard={dashboard}
                onOpen={() => {
                  const dashboardToken = sessionStorage.getItem(
                    `wattwise_dashboard_unlock_${dashboard.dashboard_id}`
                  );
                  if (dashboard.is_locked && !dashboardToken) {
                    openUnlock(dashboard);
                  } else {
                    navigate(`/dashboard/${dashboard.dashboard_id}`);
                  }
                }}
                onSettings={() => openSettings(dashboard)}
              />
            ))}
            {emptyIndices.map((index) => (
              <button
                type="button"
                className="workspace-dashboard-bar empty"
                key={`empty-${index}`}
                onClick={openSetup}
                disabled={isGuestPreview}
                title={isGuestPreview ? "Sign in to configure a dashboard" : undefined}
              >
                <span className="workspace-empty-plus" aria-hidden="true">+</span>
                <span>
                  <strong>Empty Workspace</strong>
                  <small>Click to configure</small>
                </span>
                <span className="workspace-empty-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>

          {loading && (
            <div className="workspace-loading" role="status">
              <span className="workspace-spinner" /> Loading your workspaces…
            </div>
          )}

          {dashboardCount < MAX_DASHBOARDS && (
            <button
              type="button"
              className={`workspace-add-button${isGuestPreview ? " is-preview" : ""}`}
              onClick={() => setEmptySlots((count) => Math.min(count + 1, MAX_DASHBOARDS - dashboards.length))}
              disabled={loading || isGuestPreview}
            >
              <span aria-hidden="true">+</span>
              {isGuestPreview ? "Sign in to add dashboards" : "Add Dashboard"}
            </button>
          )}
          <p className="workspace-list-note">
            {MAX_DASHBOARDS} dashboard limit keeps your command centre focused.
          </p>
        </section>

        <footer className="workspace-footer">
          <a className="workspace-footer-brand" href="/home">
            <BrandMark /> WattWise
          </a>
          <span>Make every watt count.</span>
          <span className="workspace-footer-mono">ENGINEERING A LIGHTER WEB</span>
        </footer>
      </div>

      {setupOpen && (
        <Modal title="Set up a dashboard" onClose={closeModals}>
          <form className="workspace-modal-body" onSubmit={finishSetup}>
            <label className="workspace-field-label" htmlFor="dashboard-name">
              Dashboard name
            </label>
            <input
              id="dashboard-name"
              className="workspace-input"
              type="text"
              maxLength={100}
              placeholder="e.g. Production API"
              value={dashboardName}
              onChange={(event) => setDashboardName(event.target.value)}
              autoFocus
            />

            <div className="workspace-modal-section">
              <PasscodeChoices
                value={protectWithPasscode}
                onChange={setProtectWithPasscode}
              />
              {protectWithPasscode && (
                <div className="workspace-passcode-field">
                  <label className="workspace-field-label" htmlFor="new-passcode">
                    Dashboard passcode
                  </label>
                  <input
                    id="new-passcode"
                    className="workspace-input"
                    type="password"
                    autoComplete="new-password"
                    minLength={4}
                    maxLength={128}
                    placeholder="At least 4 characters"
                    value={newPasscode}
                    onChange={(event) => setNewPasscode(event.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="workspace-modal-section">
              <span className="workspace-field-label">Choose a data source</span>
              <div className="workspace-method-grid">
                <button
                  type="button"
                  className={`workspace-method-card${inputMethod === "csv" ? " selected" : ""}`}
                  aria-pressed={inputMethod === "csv"}
                  onClick={() => setInputMethod("csv")}
                >
                  <span className="workspace-method-icon">↥</span>
                  <span><strong>Import CSV</strong><small>Upload measurement data</small></span>
                  <span className="workspace-method-check">{inputMethod === "csv" ? "✓" : ""}</span>
                </button>
                <button
                  type="button"
                  className={`workspace-method-card${inputMethod === "manual" ? " selected" : ""}`}
                  aria-pressed={inputMethod === "manual"}
                  onClick={() => setInputMethod("manual")}
                >
                  <span className="workspace-method-icon">✎</span>
                  <span><strong>Manual Entry</strong><small>Configure data later</small></span>
                  <span className="workspace-method-check">{inputMethod === "manual" ? "✓" : ""}</span>
                </button>
              </div>
              {inputMethod === "csv" && (
                <FileDropzone
                  file={setupFile}
                  error={setupFileError}
                  onFile={(file, error) => {
                    setSetupFile(file);
                    setSetupFileError(error);
                  }}
                />
              )}
            </div>

            {setupError && <p className="workspace-form-error" role="alert">{setupError}</p>}
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="workspace-cancel-button"
                onClick={closeModals}
                disabled={setupBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="workspace-finish-button"
                disabled={setupBusy}
              >
                {setupBusy ? <><span className="workspace-spinner" /> Saving…</> : "Finished"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {unlockDashboard && (
        <Modal title={`Unlock ${unlockDashboard.name}`} onClose={closeModals}>
          <form className="workspace-modal-body" onSubmit={unlock}>
            <p className="workspace-modal-description">
              This dashboard is protected. Enter its passcode to continue.
            </p>
            <label className="workspace-field-label" htmlFor="unlock-passcode">
              Passcode
            </label>
            <input
              id="unlock-passcode"
              className="workspace-input"
              type="password"
              autoComplete="current-password"
              value={unlockPasscode}
              onChange={(event) => setUnlockPasscode(event.target.value)}
              autoFocus
            />
            {unlockError && <p className="workspace-form-error" role="alert">{unlockError}</p>}
            <div className="workspace-modal-actions">
              <button type="button" className="workspace-cancel-button" onClick={closeModals}>
                Cancel
              </button>
              <button type="submit" className="workspace-finish-button" disabled={unlockBusy}>
                {unlockBusy ? <><span className="workspace-spinner" /> Verifying…</> : "Unlock dashboard"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {settingsDashboard && (
        <Modal title={`${settingsDashboard.name} settings`} onClose={closeModals}>
          <form className="workspace-modal-body" onSubmit={saveSettings}>
            <div className="workspace-settings-section">
              <h3>Passcode management</h3>
              {settingsDashboard.is_locked && (
                <>
                  <label className="workspace-field-label" htmlFor="current-passcode">
                    Current passcode
                  </label>
                  <input
                    id="current-passcode"
                    className="workspace-input"
                    type="password"
                    autoComplete="current-password"
                    value={currentPasscode}
                    onChange={(event) => setCurrentPasscode(event.target.value)}
                  />
                  <label className="workspace-check-row">
                    <input
                      type="checkbox"
                      checked={removePasscode}
                      onChange={(event) => {
                        setRemovePasscode(event.target.checked);
                        if (event.target.checked) setSetPasscode(false);
                      }}
                    />
                    <span>Remove Passcode / I don’t want a passcode</span>
                  </label>
                </>
              )}
              {!removePasscode && (
                <label className="workspace-check-row">
                  <input
                    type="checkbox"
                    checked={setPasscode}
                    onChange={(event) => setSetPasscode(event.target.checked)}
                  />
                  <span>{settingsDashboard.is_locked ? "Change passcode" : "Protect with a passcode"}</span>
                </label>
              )}
              {setPasscode && (
                <>
                  <label className="workspace-field-label" htmlFor="settings-passcode">
                    {settingsDashboard.is_locked ? "New passcode" : "Dashboard passcode"}
                  </label>
                  <input
                    id="settings-passcode"
                    className="workspace-input"
                    type="password"
                    minLength={4}
                    maxLength={128}
                    autoComplete="new-password"
                    value={settingsPasscode}
                    onChange={(event) => setSettingsPasscode(event.target.value)}
                  />
                </>
              )}
            </div>

            <div className="workspace-settings-section">
              <h3>CSV data</h3>
              <p className="workspace-modal-description">
                Import a new file to replace this dashboard’s current CSV.
              </p>
              <FileDropzone
                file={settingsFile}
                error={settingsFileError}
                onFile={(file, error) => {
                  setSettingsFile(file);
                  setSettingsFileError(error);
                }}
              />
            </div>

            <div className="workspace-delete-section">
              {!confirmDelete ? (
                <button
                  type="button"
                  className="workspace-delete-button"
                  onClick={() => setConfirmDelete(true)}
                >
                  Remove dashboard
                </button>
              ) : (
                <div className="workspace-delete-confirm">
                  <p>
                    Remove <strong>{settingsDashboard.name}</strong> and its
                    saved data? This can’t be undone.
                    {settingsDashboard.is_locked &&
                      " Enter the dashboard passcode above to confirm."}
                  </p>
                  {settingsDashboard.is_locked && (
                    <>
                      <label className="workspace-field-label" htmlFor="delete-passcode">
                        Current passcode
                      </label>
                      <input
                        id="delete-passcode"
                        className="workspace-input"
                        type="password"
                        autoComplete="current-password"
                        value={currentPasscode}
                        onChange={(event) => setCurrentPasscode(event.target.value)}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    className="workspace-delete-confirm-button"
                    onClick={removeDashboard}
                    disabled={deleteBusy}
                  >
                    {deleteBusy ? "Removing…" : "Confirm removal"}
                  </button>
                </div>
              )}
            </div>

            {settingsError && <p className="workspace-form-error" role="alert">{settingsError}</p>}
            <div className="workspace-modal-actions">
              <button type="button" className="workspace-cancel-button" onClick={closeModals}>
                Cancel
              </button>
              <button type="submit" className="workspace-finish-button" disabled={settingsBusy}>
                {settingsBusy ? <><span className="workspace-spinner" /> Saving…</> : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}