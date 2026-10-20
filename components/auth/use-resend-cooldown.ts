"use client";

import { useEffect, useState } from "react";

export function useResendCooldown() {
  const [deadline, setDeadline] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  function start() {
    setSeconds(60);
    setDeadline(Date.now() + 60_000);
  }

  return { seconds, start };
}
