/**
 * A tiny event bridge so the non-React API layer can tell the auth provider
 * that the session is dead. Without this, an expired token left the user on a
 * screen that silently failed every request.
 */
type UnauthorizedListener = () => void;

const listeners = new Set<UnauthorizedListener>();

export const authEvents = {
  onUnauthorized(listener: UnauthorizedListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emitUnauthorized(): void {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.warn("Unauthorized listener failed:", error);
      }
    });
  },
};
