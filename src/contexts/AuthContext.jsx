import { createContext, useState, useEffect, useContext } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
} from "firebase/auth";
import { auth } from "../firebase";
import { ADMIN_ACCESS_LEVELS, getAdminAccess } from "../utils/adminAccess";

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [adminAccess, setAdminAccess] = useState({
    accessLevel: ADMIN_ACCESS_LEVELS.NONE,
    canAccessAdmin: false,
    canWriteAdmin: false,
    isReadOnlyAdmin: false,
  });
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
        setAdminAccess({
          accessLevel: ADMIN_ACCESS_LEVELS.NONE,
          canAccessAdmin: false,
          canWriteAdmin: false,
          isReadOnlyAdmin: false,
        });
        setLoading(false);
        return;
      }

      const tokenResult = await user.getIdTokenResult();
      setAdminAccess(getAdminAccess(tokenResult.claims, true));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    ...adminAccess,
    currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
