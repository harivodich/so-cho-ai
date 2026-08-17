"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";

import {
  configureFirebaseClient,
  consumeFirebaseRedirectResult,
  deleteFirebaseUser,
  isFirebaseConfigured,
  saveFirebaseUserProfile,
  sendFirebasePasswordReset,
  verifyFirebaseEmail,
  signInOrLinkEmailAccount,
  signInWithExistingGoogleAccount,
  signInWithGoogleAccount,
  signOutFirebase,
  subscribeFirebaseAuth,
  type FirebaseWebConfig,
} from "@/lib/firebase/client";

type AuthConfigResponse =
  | { configured: false }
  | { configured: true; firebase: FirebaseWebConfig };

type AuthStatus = "loading" | "disabled" | "ready";

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function initialize() {
      try {
        const response = await fetch("/api/firebase-config", { cache: "no-store" });
        const configuration = (await response.json()) as AuthConfigResponse;
        if (!configuration.configured || !isFirebaseConfigured(configuration.firebase)) {
          if (active) setStatus("disabled");
          return;
        }

        configureFirebaseClient(configuration.firebase);
        try {
          await consumeFirebaseRedirectResult();
        } catch (reason) {
          if (active) setError(reason instanceof Error ? reason.message : 'Khong the hoan tat dang nhap Google.');
        }
        unsubscribe = subscribeFirebaseAuth((nextUser) => {
          if (!active) return;
          setUser(nextUser);
          setStatus("ready");
          if (nextUser) {
            void saveFirebaseUserProfile(nextUser).catch((reason) => {
              if (active) setError(reason instanceof Error ? reason.message : "Không thể lưu hồ sơ tài khoản.");
            });
          }
        });
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Không thể khởi tạo đăng nhập.");
        setStatus("disabled");
      }
    }

    void initialize();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setError(null);
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hoàn tất thao tác tài khoản.");
      throw reason;
    }
  }, []);

  const signInGoogle = useCallback(() => run(signInWithGoogleAccount), [run]);
  const signInGoogleExisting = useCallback(() => run(signInWithExistingGoogleAccount), [run]);
  const signInEmail = useCallback((email: string, password: string, create: boolean) => (
    run(() => signInOrLinkEmailAccount(email, password, create))
  ), [run]);
  const resetPassword = useCallback((email: string) => run(() => sendFirebasePasswordReset(email)), [run]);
  const verifyEmail = useCallback(() => run(verifyFirebaseEmail), [run]);
  const signOut = useCallback(() => run(signOutFirebase), [run]);
  const deleteAccount = useCallback(() => run(deleteFirebaseUser), [run]);

  return {
    deleteAccount,
    error,
    isLoading: status === "loading",
    isConfigured: status !== "disabled",
    resetPassword,
    verifyEmail,
    signInEmail,
    signInGoogle,
    signInGoogleExisting,
    signOut,
    user,
  };
}
