export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const cognitoConfig = {
  region: import.meta.env.VITE_COGNITO_REGION || "ca-central-1",
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
};

export const authEnabled = Boolean(cognitoConfig.userPoolId && cognitoConfig.userPoolClientId);
