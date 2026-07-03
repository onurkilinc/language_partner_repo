import { useCallback, useEffect, useState } from "react";

import {
  authConfirmSignUp,
  authGetCurrentUser,
  authSignIn,
  authSignOut,
  authSignUp,
  configureAuth,
  getUserApprovalStatus,
  isUserApproved,
} from "./auth";
import { authEnabled } from "./config";
import PendingPage from "./PendingPage";

function isPendingAuthError(message) {
  return /pending|approval/i.test(message || "");
}

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(authEnabled);
  const [user, setUser] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loginBlockedPending, setLoginBlockedPending] = useState(false);

  const syncUserSession = useCallback(async (forceRefresh = false) => {
    const current = await authGetCurrentUser();
    const status = await getUserApprovalStatus(forceRefresh);
    setUser(current);
    setApprovalStatus(status);
    return { current, status };
  }, []);

  useEffect(() => {
    configureAuth();
    if (!authEnabled) {
      setLoading(false);
      return;
    }

    syncUserSession()
      .catch(() => {
        setUser(null);
        setApprovalStatus(null);
      })
      .finally(() => setLoading(false));
  }, [syncUserSession]);

  async function handleSignIn(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoginBlockedPending(false);
    try {
      const result = await authSignIn(email.trim(), password);
      if (result.isSignedIn) {
        const { status } = await syncUserSession(true);
        if (!isUserApproved(status)) {
          setMessage("");
        }
      } else {
        setMessage("Additional sign-in step required.");
      }
    } catch (err) {
      const errMessage = err.message || "Sign in failed.";
      if (isPendingAuthError(errMessage)) {
        setLoginBlockedPending(true);
        setError("");
      } else {
        setError(errMessage);
      }
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoginBlockedPending(false);
    try {
      const result = await authSignUp(email.trim(), password);
      if (result.isSignUpComplete) {
        setMessage("Account created. You can sign in after admin approval.");
        setMode("signIn");
      } else {
        setMessage("Check your email for the confirmation code.");
        setMode("confirm");
      }
    } catch (err) {
      setError(err.message || "Sign up failed.");
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await authConfirmSignUp(email.trim(), code.trim());
      setMessage("Email confirmed. Wait for admin approval, then sign in.");
      setMode("signIn");
    } catch (err) {
      setError(err.message || "Confirmation failed.");
    }
  }

  async function handleSignOut() {
    await authSignOut();
    setUser(null);
    setApprovalStatus(null);
    setLoginBlockedPending(false);
  }

  async function handleRefreshApproval() {
    setRefreshing(true);
    setError("");
    try {
      const { status } = await syncUserSession(true);
      if (!isUserApproved(status)) {
        setMessage("Still pending. Please try again after admin approval.");
      } else {
        setMessage("");
      }
    } catch (err) {
      setError(err.message || "Could not refresh session.");
    } finally {
      setRefreshing(false);
    }
  }

  if (!authEnabled) {
    return children;
  }

  if (loading) {
    return <main className="app auth-screen">Loading...</main>;
  }

  if (user && approvalStatus && !isUserApproved(approvalStatus)) {
    return (
      <PendingPage
        email={user.signInDetails?.loginId || user.username}
        onSignOut={handleSignOut}
        onRefresh={handleRefreshApproval}
        refreshing={refreshing}
      />
    );
  }

  if (!user) {
    if (loginBlockedPending) {
      return (
        <main className="app auth-screen pending-screen">
          <h1>Account pending approval</h1>
          <p className="auth-subtitle">
            Sign-in is blocked until an admin approves your account.
          </p>
          <p className="pending-hint">
            After approval, return here and sign in again.
          </p>
          <div className="pending-actions">
            <button type="button" onClick={() => setLoginBlockedPending(false)}>
              Back to sign in
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="app auth-screen">
        <h1>French Language Partner</h1>
        <p className="auth-subtitle">Sign in to practice French</p>

        <div className="auth-tabs">
          <button type="button" className={mode === "signIn" ? "active" : ""} onClick={() => setMode("signIn")}>
            Sign in
          </button>
          <button type="button" className={mode === "signUp" ? "active" : ""} onClick={() => setMode("signUp")}>
            Sign up
          </button>
          <button type="button" className={mode === "confirm" ? "active" : ""} onClick={() => setMode("confirm")}>
            Confirm
          </button>
        </div>

        {mode === "signIn" && (
          <form onSubmit={handleSignIn} className="auth-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="submit">Sign in</button>
          </form>
        )}

        {mode === "signUp" && (
          <form onSubmit={handleSignUp} className="auth-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
            <button type="submit">Create account</button>
          </form>
        )}

        {mode === "confirm" && (
          <form onSubmit={handleConfirm} className="auth-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Confirmation code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
            <button type="submit">Confirm email</button>
          </form>
        )}

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-message">{message}</p>}
      </main>
    );
  }

  return (
    <>
      <div className="auth-bar">
        <span>{user.signInDetails?.loginId || user.username}</span>
        <button type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
