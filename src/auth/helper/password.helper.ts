export function checkPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least of 8 characters';
  }

  if ((password.match(/[0-9]/g) || []).length < 2) {
    return 'Password must contain at least two numbers';
  }

  if ((password.match(/[A-Z]/g) || []).length < 2) {
    return 'Password must contain at least two uppercase character';
  }

  if ((password.match(/[a-z]/g) || []).length < 2) {
    return 'Password must contain at least two lowercase character';
  }
  if ((password.match(/[^A-Za-z0-9]/g) || []).length < 2) {
    return 'Password must contain at least two special characters';
  }

  return null;
}
