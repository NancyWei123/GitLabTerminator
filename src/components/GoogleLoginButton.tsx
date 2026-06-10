import { useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

type GoogleLoginButtonProps = {
  className?: string;
};

function GoogleLoginButton({ className = "" }: GoogleLoginButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setError("");
      console.log("Google login button clicked");

      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google login failed:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Google login failed.");
      }
    }
  };

  const logout = async () => {
    try {
      setError("");
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Logout failed.");
      }
    }
  };

  if (user) {
    return (
      <div className="google-user-box">
        {user.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName || "User"}
            className="google-user-avatar"
          />
        )}

        <span>{user.displayName || user.email}</span>

        <button className={className} onClick={logout}>
          Logout
        </button>

        {error && <p className="error-message">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button className={className} onClick={loginWithGoogle}>
        Login with Google
      </button>

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default GoogleLoginButton;