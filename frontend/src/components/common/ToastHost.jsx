import React, { useEffect, useState } from 'react';
import { subscribeToToasts } from '../../lib/http';

/**
 * Standardized Toast Display Host (SDD Section 4.1.4.2 - Table 4.1-5).
 */
export function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToToasts((payload) => {
      setToasts((prev) => {
        if (prev.some((t) => t.message === payload.message)) return prev;
        return [...prev, { ...payload, id: Date.now() + Math.random() }].slice(-3);
      });
    });
  }, []);

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, maxWidth: 420 }}>
      {toasts.map((t) => {
        const bg =
          t.type === 'SUCCESS'
            ? '#D1E7DD'
            : t.type === 'WARNING'
            ? '#FFF3CD'
            : t.type === 'INFO'
            ? '#CFF4FC'
            : '#F8D7DA';
        const border =
          t.type === 'SUCCESS'
            ? '#198754'
            : t.type === 'WARNING'
            ? '#FFC107'
            : t.type === 'INFO'
            ? '#0DCAF0'
            : '#DC3545';
        return (
          <div
            key={t.id}
            role="alert"
            className="p-3 mb-2 rounded shadow-sm d-flex justify-content-between align-items-start"
            style={{ backgroundColor: bg, borderLeft: `5px solid ${border}` }}
          >
            <div>
              <div className="fw-semibold">{t.message}</div>
              {t.traceId && (
                <div className="small text-muted mt-1">
                  Trace ID: <code>{t.traceId}</code>
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn-close ms-3"
              aria-label="Close"
              onClick={() => dismiss(t.id)}
            />
          </div>
        );
      })}
    </div>
  );
}