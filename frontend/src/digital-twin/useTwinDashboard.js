import { useCallback, useEffect, useRef, useState } from "react";

const base = import.meta.env.VITE_API_BASE_URL || "";

async function read(path, token, signal) {
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const error = new Error(
      response.status === 401 || response.status === 403
        ? "Your session has expired. Sign in again to load your twin."
        : `Your twin could not be refreshed (${response.status}). Please try again.`,
    );
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/** In-memory only. Single-flight refresh; abort and discard work on account change. */
export function useTwinResource(
  userId,
  token,
  walletRevision,
  resource = "dashboard",
) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const active = useRef(false),
    pending = useRef(null),
    lastRequest = useRef(0);
  const refresh = useCallback(async () => {
    if (!active.current || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    lastRequest.current = Date.now();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setState((previous) => ({ ...previous, loading: true }));
    try {
      const data = await read(
        `/users/${userId}/twin/${resource}`,
        token,
        controller.signal,
      );
      if (active.current && pending.current === controller)
        setState({ data, loading: false, error: null });
    } catch (error) {
      if (active.current && pending.current === controller)
        setState((previous) => ({
          data: [401, 403].includes(error.status) ? null : previous.data,
          loading: false,
          error: {
            message:
              error.name === "AbortError"
                ? "The refresh timed out. Please try again."
                : error.message,
            unauthorized: [401, 403].includes(error.status),
          },
        }));
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) pending.current = null;
    }
  }, [userId, token, resource]);

  useEffect(() => {
    active.current = true;
    setState({ data: null, loading: true, error: null });
    refresh();
    const whenVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRequest.current > 5000
      )
        refresh();
    };
    const interval = setInterval(whenVisible, 30000);
    window.addEventListener("focus", whenVisible);
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      active.current = false;
      pending.current?.abort();
      pending.current = null;
      clearInterval(interval);
      window.removeEventListener("focus", whenVisible);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (walletRevision) refresh();
  }, [walletRevision, refresh]);
  return { ...state, refresh };
}

export function useTwinDashboard(userId, token, walletRevision) {
  return useTwinResource(userId, token, walletRevision);
}

export function useDecisionDetail(userId, token, id) {
  const [state, setState] = useState({ id: null, data: null, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setState({ id, data: null, error: null });
    if (!id)
      return () => {
        live = false;
      };
    const timeout = setTimeout(() => controller.abort(), 15000);
    read(`/users/${userId}/decisions/${id}`, token, controller.signal)
      .then((data) => {
        if (live) setState({ id, data, error: null });
      })
      .catch(() => {
        if (live)
          setState({
            id,
            data: null,
            error: "This saved simulation could not be loaded. Try again.",
          });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      live = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [userId, token, id, revision]);
  return {
    ...(state.id === id ? state : { data: null, error: null }),
    retry: () => setRevision((value) => value + 1),
  };
}
