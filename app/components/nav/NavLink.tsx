'use client';

import { useRouter } from 'next/navigation';

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

/**
 * Plain-anchor nav link driven by router.push.
 *
 * Replaces next/link in the Rail/TabBar: <Link> clicks in this app dispatch
 * the navigation but the suspended transition never commits (observed on
 * next 15.5.20, prod + preview, real pointer clicks — router.push through
 * the same reducer commits fine). Until that's understood upstream, the
 * app's five nav links use the mechanism that verifiably works.
 */
export default function NavLink({ href, children, ...rest }: NavLinkProps) {
  const router = useRouter();

  return (
    <a
      href={href}
      onClick={(e) => {
        // Let middle-click / cmd-click / shift-click keep native behavior.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
          return;
        }
        e.preventDefault();
        // Deferring out of the React event context is load-bearing: a push
        // dispatched inside the click's transition never commits (the same
        // push from a macrotask does). See NavLink doc comment.
        setTimeout(() => router.push(href), 0);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
