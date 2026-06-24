"use client";

import { signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth, db, ensureSessionAuthPersistence, googleProvider, firebaseConfigured } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleEmailLogin() {
    try {
      if (!firebaseConfigured || !auth) {
        window.alert("Firebase is not configured. Please set NEXT_PUBLIC_FIREBASE_* env vars.");
        return;
      }

      await ensureSessionAuthPersistence();
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = result.user.email;
      if (!firebaseConfigured || !db) {
        window.alert("Firebase is not configured. Please set NEXT_PUBLIC_FIREBASE_* env vars.");
        return;
      }

      const q = query(collection(db, "authorizedUsers"), where("email", "==", userEmail));
      const snaps = await getDocs(q);
      if (snaps.empty) {
        await signOut(auth);
        window.alert("Access denied. Your account is not authorized to use this portal.");
        return;
      }

      const data = snaps.docs[0].data();

      if (data.role === "client") {
        await signOut(auth);
        window.alert("Access denied. Please use the Client Portal to log in.");
        return;
      }

      if (data.role !== "admin") {
        await signOut(auth);
        window.alert("Access denied. Contact your administrator.");
        return;
      }

      router.push("/");
    } catch (error) {
      console.error(error);
      window.alert("Sign in failed. Check your email and password and try again.");
    }
  }

  async function handleGoogleLogin() {
    try {
      if (!firebaseConfigured || !auth) {
        window.alert("Firebase is not configured. Please set NEXT_PUBLIC_FIREBASE_* env vars.");
        return;
      }

      await ensureSessionAuthPersistence();
      const result = await signInWithPopup(auth, googleProvider);
      const { email } = result.user;
      if (!firebaseConfigured || !db) {
        window.alert("Firebase is not configured. Please set NEXT_PUBLIC_FIREBASE_* env vars.");
        return;
      }

      const q = query(collection(db, "authorizedUsers"), where("email", "==", email));
      const snaps = await getDocs(q);
      if (snaps.empty) {
        await signOut(auth);
        window.alert("Access denied. Your account is not authorized to use this portal.");
        return;
      }

      const data = snaps.docs[0].data();

      if (data.role === "client") {
        await signOut(auth);
        window.alert("Access denied. Please use the Client Portal to log in.");
        return;
      }

      if (data.role !== "admin") {
        await signOut(auth);
        window.alert("Access denied. Contact your administrator.");
        return;
      }

      router.push("/");
    } catch (error) {
      console.error(error);
      window.alert("Google login failed. Please try again.");
    }
  }

  return (
    <main className="min-h-screen pg-bg p-8">
      <section className="mx-auto mt-24 max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-slate-950 text-sm font-black text-white">
            AX
          </div>
          <div>
            <h1 className="m-0 text-xl font-black text-slate-950">Axis Payroll System</h1>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Admin Access
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-black text-slate-950">Sign in</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Sign in with your authorized account to access the HR Admin dashboard.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-700"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-700"
          />
          <button
            type="button"
            onClick={handleEmailLogin}
            className="w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
          >
            Sign in
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-bold text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
        >
          Sign in with Google
        </button>
      </section>
    </main>
  );
}
