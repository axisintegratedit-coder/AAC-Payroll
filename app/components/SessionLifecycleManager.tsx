"use client";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { auth, ensureSessionAuthPersistence, firebaseConfigured } from "@/lib/firebase";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;
const WARNING_AFTER_MS = 9 * 60 * 1000;
const LOGOUT_AFTER_MS = 10 * 60 * 1000;
const WARNING_SECONDS = 60;

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname === "/client-portal/login";
}

function getLoginPath(pathname: string) {
  return pathname.startsWith("/client-portal") ? "/client-portal/login" : "/login";
}

function clearTabSession() {
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

export default function SessionLifecycleManager() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  function clearTimers() {
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownTimerRef.current = null;
  }

  async function logout(reason: "inactive" | "manual" = "manual") {
    clearTimers();
    setShowWarning(false);
    clearTabSession();
    try {
      if (firebaseConfigured && auth) await signOut(auth);
    } catch {
      // ignore
    }
    if (reason === "inactive") {
      router.replace(getLoginPath(pathname));
    }
  }

  function scheduleTimers() {
    clearTimers();
    if (!firebaseConfigured || !auth || !auth.currentUser || isLoginPath(pathname)) return;

    lastActivityRef.current = Date.now();
    warningTimerRef.current = window.setTimeout(() => {
      setCountdown(WARNING_SECONDS);
      setShowWarning(true);
      countdownTimerRef.current = window.setInterval(() => {
        setCountdown((current) => Math.max(0, current - 1));
      }, 1000);
    }, WARNING_AFTER_MS);

    logoutTimerRef.current = window.setTimeout(() => {
      logout("inactive");
    }, LOGOUT_AFTER_MS);
  }

  function resetActivity() {
    if (!firebaseConfigured || !auth || !auth.currentUser || isLoginPath(pathname)) return;
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    scheduleTimers();
  }

  useEffect(() => {
    ensureSessionAuthPersistence().catch(() => {});
    if (!firebaseConfigured || !auth) {
      setIsAuthenticated(false);
      return () => {
        clearTimers();
      };
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(Boolean(user));
      if (!user) {
        clearTimers();
        setShowWarning(false);
        clearTabSession();
      }
    });
    return () => {
      unsubscribe();
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isLoginPath(pathname)) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    scheduleTimers();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetActivity);
      });
      clearTimers();
    };
  }, [isAuthenticated, pathname]);

  useEffect(() => {
    function handleBeforeUnload() {
      // Firebase browserSessionPersistence and sessionStorage are scoped to the
      // tab/window lifetime, so a real close naturally requires login on reopen.
      // Avoid clearing here because beforeunload also fires on refresh, where
      // draft restore must continue to work.
      try {
        sessionStorage.setItem("axis_pending_unload_at", String(Date.now()));
      } catch {
        // ignore
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        try {
          sessionStorage.setItem("axis_last_hidden_at", String(Date.now()));
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!showWarning || isLoginPath(pathname)) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-[0_24px_70px_-24px_rgba(15,23,42,0.5)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl font-black text-amber-700">
          {countdown}
        </div>
        <h2 className="text-xl font-black text-slate-950">You've been inactive.</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          You will be logged out in 60 seconds.
        </p>
        <button
          type="button"
          onClick={resetActivity}
          className="mt-6 w-full rounded-2xl bg-[#0a4f8f] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#073c6d]"
        >
          Stay Logged In
        </button>
      </div>
    </div>
  );
}
