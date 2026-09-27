import { useEffect } from 'react';
import { mountFocusWidget } from '@workspace/lok-focus-widget';

import { lokClient } from '@/lib/lokClient';
import { useAuth } from '@/state/authStore';

/**
 * Mounts the shared GSix focus-timer pill once the player is signed in
 * (same account as the hub). Renders nothing itself; the widget appends its
 * own fixed-position element to document.body and stays invisible until
 * there's an active focus session for this user.
 */
export function FocusWidgetMount() {
  const { user } = useAuth();

  useEffect(() => {
    if (!lokClient || !user) return;
    const handle = mountFocusWidget(document.body, { supabase: lokClient, userId: user.id });
    return () => handle.destroy();
  }, [user]);

  return null;
}
