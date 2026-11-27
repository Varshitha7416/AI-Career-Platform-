// Safe access to the session stored in localStorage.

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function updateStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('resumeId');
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem('token') && getUser()?.id);
}
