export default function PendingPage({ email, onSignOut, onRefresh, refreshing }) {
  return (
    <main className="app auth-screen pending-screen">
      <h1>Account pending approval</h1>
      <p className="auth-subtitle">
        Your account is waiting for admin approval before you can use the French Language Partner app.
      </p>
      {email && (
        <p className="pending-email">
          Signed in as <strong>{email}</strong>
        </p>
      )}
      <p className="pending-hint">
        Once an admin sets your access to <strong>approved</strong> in Cognito, click &quot;Check
        again&quot; or sign out and sign back in.
      </p>
      <div className="pending-actions">
        <button type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Checking..." : "Check again"}
        </button>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </main>
  );
}
