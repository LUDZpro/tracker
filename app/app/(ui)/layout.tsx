import Rail from '@/components/nav/Rail';
import TabBar from '@/components/nav/TabBar';

/**
 * Navigation for every page in this group: bottom TabBar on mobile,
 * left Rail on desktop (each hides itself at the other breakpoint).
 */
export default function UiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Rail />
      {children}
      <TabBar />
    </>
  );
}
