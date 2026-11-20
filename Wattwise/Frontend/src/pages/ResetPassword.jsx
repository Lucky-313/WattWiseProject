import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/api";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setMessage("");

        if (!token) {
            setError("Password reset link is invalid");
            return;
        }

        if (password.length <8) {
            setError("Password must be at least 8 characters");
            return;
        }

        if (password !== confirmPassword) {
            setError("passwords do not match");
            return;
        }

        setLoading(true);

        try {
            await resetPassword(token, password);
            
            setMessage("Your password has been reset successfully");
            
        } catch (err) {
            setError(err.message || "password reset failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="landing-page">
            <div className="reset-card">
                <h1>Reset your password</h1>

                <p className="reset-description">Choose a new password for your WattWise account</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="field-group">
                        <label htmlFor="new-password">New password</label>
                        <input
                            id="new-password"
                            type="password"
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <label htmlFor="confirm-password">Confirm password</label>
                        <input
                            id="confirm-password"
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="reset-error" role="alert">{error}</p>}
                    {message && <p className="reset-success" role="status">{message}</p>}

                    <button 
                        type="submit" 
                        className="submit-button"
                        disabled={loading || !!message}
                    >
                        {loading ? "Resetting" : "Reset password"}

                    </button>

                    {message &&(
                        <button 
                            type="button"
                            className="text-link"
                            onClick={() => navigate("/")}
                            >
                                Return to login


                        </button>

                    )
                    }
                </form>
            </div>
        </main>
    );
    
}