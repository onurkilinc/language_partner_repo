export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const cognitoConfig = {
  region: import.meta.env.VITE_COGNITO_REGION || "ca-central-1",
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  userAttribute: import.meta.env.VITE_COGNITO_USER_ATTRIBUTE || "custom:user",
  approvedValue: import.meta.env.VITE_COGNITO_APPROVED_VALUE || "approved",
};

export const authEnabled = Boolean(cognitoConfig.userPoolId && cognitoConfig.userPoolClientId);

export function isUserApproved(status) {
  return status === cognitoConfig.approvedValue;
}
