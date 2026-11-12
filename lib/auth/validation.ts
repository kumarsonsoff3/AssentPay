export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export const passwordRules = [
  {
    label: "12–256 characters",
    test: (value: string) =>
      value.length >= PASSWORD_MIN_LENGTH &&
      value.length <= PASSWORD_MAX_LENGTH,
  },
  {
    label: "An uppercase letter (A–Z)",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "A lowercase letter (a–z)",
    test: (value: string) => /[a-z]/.test(value),
  },
  { label: "A number (0–9)", test: (value: string) => /[0-9]/.test(value) },
  {
    label: "A symbol (for example, !@#$)",
    test: (value: string) => /[^a-zA-Z0-9\s]/.test(value),
  },
];

export function validatePassword(password: string): string | undefined {
  if (/[\u0000-\u001f\u007f]/.test(password))
    return "Passwords cannot contain control characters.";
  if (passwordRules.some((rule) => !rule.test(password))) {
    return "Use 12–256 characters, including uppercase and lowercase letters, a number, and a symbol.";
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validToken(userId: string, secret: string) {
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(userId) &&
    secret.length > 0 &&
    secret.length <= 1024 &&
    !/[\s\u0000-\u001f\u007f]/.test(secret)
  );
}
