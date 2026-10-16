/**
 * Shared JWT utility - eliminates code duplication
 */
export function parseJwt(token: string): { userId: string; name: string } | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    
    // Validate required fields
    if (!payload.userId || !payload.name) {
      return null;
    }
    
    return {
      userId: payload.userId,
      name: payload.name
    };
  } catch (error) {
    return null;
  }
}
