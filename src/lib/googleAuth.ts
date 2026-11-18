import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export const DEFAULT_OAUTH_CLIENT_ID = firebaseConfig.oAuthClientId || "";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Strictly in-memory OAuth access token (never written to localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface GoogleSessionUser {
  email: string;
  displayName: string;
  photoURL?: string;
}

export function getInMemoryAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearInMemoryAccessToken(): void {
  cachedAccessToken = null;
}

export function subscribeGoogleAuth(
  onUserChange: (user: GoogleSessionUser | null, hasToken: boolean) => void
): () => void {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      onUserChange(
        {
          email: user.email || "Connected Google User",
          displayName: user.displayName || user.email || "Google Account",
          photoURL: user.photoURL || undefined,
        },
        true
      );
    } else if (!user && !isSigningIn) {
      cachedAccessToken = null;
      onUserChange(null, false);
    } else if (user && !cachedAccessToken && !isSigningIn) {
      // User session exists in Firebase, but OAuth access token needs refresh on click
      onUserChange(
        {
          email: user.email || "Google Account",
          displayName: user.displayName || user.email || "Google Account",
          photoURL: user.photoURL || undefined,
        },
        false
      );
    }
  });
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = window as unknown as {
      google?: { accounts?: { oauth2?: unknown } };
    };
    if (win.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });
}

async function signInWithCustomClientId(
  clientId: string
): Promise<{ user: GoogleSessionUser; accessToken: string }> {
  await loadGisScript();
  const win = window as unknown as {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  };

  const accessToken = await new Promise<string>((resolve, reject) => {
    const tokenClient = win.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: `${GOOGLE_WORKSPACE_SCOPES.join(" ")} https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile`,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || "Google authorization was cancelled."));
          return;
        }
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });

  cachedAccessToken = accessToken;

  // Fetch basic profile from Google userinfo
  let user: GoogleSessionUser = {
    email: "Connected Google Account",
    displayName: "Google Account",
  };
  try {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as {
        email?: string;
        name?: string;
        picture?: string;
      };
      user = {
        email: profile.email || user.email,
        displayName: profile.name || profile.email || user.displayName,
        photoURL: profile.picture,
      };
    }
  } catch {
    // Non-fatal if userinfo fails
  }

  return { user, accessToken };
}

export async function signInWithGoogleWorkspace(
  clientIdOverride?: string
): Promise<{ user: GoogleSessionUser; accessToken: string }> {
  const customId = clientIdOverride?.trim();
  isSigningIn = true;
  try {
    if (customId && customId !== DEFAULT_OAUTH_CLIENT_ID) {
      return await signInWithCustomClientId(customId);
    }

    const provider = new GoogleAuthProvider();
    GOOGLE_WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));
    provider.setCustomParameters({ prompt: "consent" });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Could not retrieve Google Workspace access token.");
    }

    cachedAccessToken = credential.accessToken;
    const user: GoogleSessionUser = {
      email: result.user.email || "Google Account",
      displayName: result.user.displayName || result.user.email || "Google Account",
      photoURL: result.user.photoURL || undefined,
    };
    return { user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogleWorkspace(): Promise<void> {
  cachedAccessToken = null;
  try {
    await signOut(auth);
  } catch {
    // Ignore if signed in via custom GIS token only
  }
}
