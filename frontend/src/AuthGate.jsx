import { useEffect, useState } from "react";

import {
  authConfirmSignUp,
  authGetCurrentUser,
  authSignIn,
  authSignOut,
  authSignUp,
  configureAuth,
} from "./auth";
import { authEnabled } from "./config";

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(authEnabled);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    configureAuth();
    if (!authEnabled) {
      setLoading(false);
      return;
    }

    authGetCurrentUser()
      .then((current) => setUser(current))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleSignIn(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await authSignIn(email.trim(), password);
      if (result.isSignedIn) {
        setUser(await authGetCurrentUser());
      } else {
        setMessage("Additional sign-in step required.");
      }
    } catch (err) {
      setError(err.message || "Sign in failed.");
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    setError("");
    setMessage("");
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
  }

  if (!authEnabled) {
    return children;
  }

  if (loading) {
    return <main className="app auth-screen">Loading...</main>;
  }

  if (!user) {
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
