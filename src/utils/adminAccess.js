const ADMIN_ACCESS_LEVELS = {
  NONE: "none",
  READ: "read",
  WRITE: "write",
};

const normalizeRole = (role = "") => role.trim().toLowerCase();

export const getAdminAccess = (tokenClaims = {}, hasAuthenticatedUser = false) => {
  const normalizedRole = normalizeRole(tokenClaims.adminRole || "");
  const isReadOnlyClaim =
    tokenClaims.adminReadOnly === true ||
    normalizedRole === "readonly" ||
    normalizedRole === "read-only";
  const canAccessAdmin = hasAuthenticatedUser;
  const accessLevel = !hasAuthenticatedUser
    ? ADMIN_ACCESS_LEVELS.NONE
    : isReadOnlyClaim
      ? ADMIN_ACCESS_LEVELS.READ
      : ADMIN_ACCESS_LEVELS.WRITE;

  return {
    accessLevel,
    canAccessAdmin,
    canWriteAdmin: accessLevel === ADMIN_ACCESS_LEVELS.WRITE,
    isReadOnlyAdmin: accessLevel === ADMIN_ACCESS_LEVELS.READ,
  };
};

export { ADMIN_ACCESS_LEVELS };
