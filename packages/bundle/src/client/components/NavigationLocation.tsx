import * as React from 'react';
import { useEffect, useRef } from 'react';
import type { PanelInfo } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';

type NavigationLocationProps = PropsRuntime<'shell.overlay'> & InjectFace<{
  readonly initialProductView: string | null;
  readonly panelToView: Readonly<Record<string, string>>;
  readonly selectView: (view: string | null) => string | null;
}>;

/** URL stores presentation only, never Session identity or authority. */
export function NavigationLocation({ usePanelInfo, initialProductView, panelToView, selectView }: NavigationLocationProps) {
  const active = usePanelInfo((info: PanelInfo) => info.activePanelId);
  const initialized = useRef(false);
  const restoring = useRef(false);
  const startupRestoring = useRef(false);
  useEffect(() => {
    const restore = () => {
      restoring.current = true;
      selectView(new URL(window.location.href).searchParams.get('workdsh-view'));
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [selectView]);
  useEffect(() => {
    if (!initialProductView || initialProductView === 'conversation' || !Object.values(panelToView).includes(initialProductView)) return;
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    startupRestoring.current = true;
    const stabilize = () => {
      if (cancelled) return;
      const selected = selectView(initialProductView);
      if (selected) {
        const url = new URL(window.location.href);
        if (url.searchParams.get('workdsh-view') !== initialProductView) {
          url.searchParams.set('workdsh-view', initialProductView);
          window.history.replaceState(window.history.state, '', url);
        }
      }
      attempts += 1;
      if (attempts < 150) {
        timer = window.setTimeout(stabilize, 100);
        return;
      }
      // The official first-run notice can reset the selected panel late in a
      // cold boot. Finish with one authoritative restore after the client graph
      // has had a bounded 15-second stabilization window.
      selectView(initialProductView);
      startupRestoring.current = false;
      initialized.current = true;
      restoring.current = true;
    };
    stabilize();
    return () => {
      cancelled = true;
      startupRestoring.current = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [initialProductView, panelToView, selectView]);
  useEffect(() => {
    if (startupRestoring.current) return;
    if (!initialized.current) {
      // Restore after the official Client boot has composed the feature entries,
      // rather than while one feature's apply is still awaiting its services.
      const url = new URL(window.location.href);
      const currentView = url.searchParams.get('workdsh-view');
      const requested = initialProductView && initialProductView !== 'conversation'
        ? initialProductView
        : currentView ?? (url.searchParams.get('diagnostics') === '1' ? 'diagnostics' : null);
      const knownView = requested !== null && requested !== 'conversation' && Object.values(panelToView).includes(requested);
      if (knownView) {
        let cancelled = false;
        let timer: number | undefined;
        let attempts = 0;
        const restoreKnownView = () => {
          if (cancelled) return;
          const selected = selectView(requested);
          if (selected) {
            initialized.current = true;
            restoring.current = true;
            return;
          }
          attempts += 1;
          // A cold preview start can spend several seconds loading the official
          // client graph before business plugins register their main panels.
          // Keep the requested product URL during that bounded startup window
          // instead of prematurely rewriting it to the conversation view.
          if (attempts < 600) {
            timer = window.setTimeout(restoreKnownView, 25);
            return;
          }
          // A known feature that never registered is unavailable in this
          // installation. Preserve the existing safe fallback contract.
          initialized.current = true;
          restoring.current = true;
          selectView(null);
          url.searchParams.set('workdsh-view', 'conversation');
          window.history.replaceState(window.history.state, '', url);
        };
        restoreKnownView();
        return () => {
          cancelled = true;
          if (timer !== undefined) window.clearTimeout(timer);
        };
      }
      const selected = selectView(requested);
      initialized.current = true;
      restoring.current = true;
      if (selected !== active) return;
    }
    if (active !== null && !(active in panelToView)) return;
    const url = new URL(window.location.href);
    const view = active === null ? 'conversation' : panelToView[active];
    if (url.searchParams.get('workdsh-view') !== view) {
      url.searchParams.set('workdsh-view', view);
      if (!initialized.current || restoring.current) window.history.replaceState(window.history.state, '', url);
      else window.history.pushState(window.history.state, '', url);
    }
    initialized.current = true;
    restoring.current = false;
  }, [active, panelToView, selectView]);
  return null;
}
