import { createContext, useState, useEffect, useContext } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
} from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext();

const isTestAdminClaim = (tokenClaims = {}) => {
  const normalizedRole = String(tokenClaims.adminRole || "")
    .trim()
    .toLowerCase();

  return (
    tokenClaims.adminReadOnly === true ||
    normalizedRole === "readonly" ||
    normalizedRole === "read-only"
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isTestAdmin, setIsTestAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => {
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setIsTestAdmin(false);
        setLoading(false);
        return;
      }

      const tokenResult = await user.getIdTokenResult();
      setIsTestAdmin(isTestAdminClaim(tokenResult.claims));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const canAccessAdmin = Boolean(currentUser);
  const canWriteAdmin = Boolean(currentUser) && !isTestAdmin;
  const isReadOnlyAdmin = Boolean(currentUser) && isTestAdmin;

  const value = {
    canAccessAdmin,
    canWriteAdmin,
    currentUser,
    isReadOnlyAdmin,
    isTestAdmin,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
