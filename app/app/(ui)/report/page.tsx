import ReportView from '@/components/report/ReportView';

export const metadata = {
  title: 'Report · Tracker',
};

/**
 * The clinical export. One surface at every width — it is a document, not a
 * console, so it does not fork into desktop and mobile layouts the way the
 * home and nutrition routes do.
 */
export default function ReportPage() {
  return <ReportView />;
}
