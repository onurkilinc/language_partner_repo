import { Amplify } from "aws-amplify";
import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";

import { authEnabled, cognitoConfig, isUserApproved } from "./config";

let configured = false;

export function configureAuth() {
  if (!authEnabled || configured) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: cognitoConfig.userPoolId,
        userPoolClientId: cognitoConfig.userPoolClientId,
        loginWith: {
          email: true,
        },
      },
    },
  });
  configured = true;
}

export async function getIdToken() {
  if (!authEnabled) return null;
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() ?? null;
}

export async function getUserApprovalStatus(forceRefresh = false) {
  if (!authEnabled) return cognitoConfig.approvedValue;
  const session = await fetchAuthSession({ forceRefresh });
  const payload = session.tokens?.idToken?.payload;
  const status = payload?.[cognitoConfig.userAttribute];
  return typeof status === "string" ? status : "pending";
}

export { isUserApproved };

export async function authGetCurrentUser() {
  if (!authEnabled) return null;
  return getCurrentUser();
}

export async function authSignIn(email, password) {
  return signIn({ username: email, password });
}

export async function authSignUp(email, password) {
  return signUp({
    username: email,
    password,
    options: {
      userAttributes: { email },
    },
  });
}

export async function authConfirmSignUp(email, code) {
  return confirmSignUp({ username: email, confirmationCode: code });
}

export async function authSignOut() {
  if (!authEnabled) return;
  await signOut();
}
