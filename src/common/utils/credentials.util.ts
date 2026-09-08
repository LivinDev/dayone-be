// Copy/pasted credentials (from a chat message, a password manager, a doc) very
// commonly carry a stray leading/trailing space or differ only in email casing —
// neither should ever cause a legitimate login to fail. Applied consistently at
// every write (signup, staff creation, password reset) and every read (login,
// forgot-password lookup) so what's hashed always matches what's compared.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePassword(password: string): string {
  return password.trim();
}
