import type { Coverage } from '@/lib/goals';
import styles from './charts.module.css';

interface Props {
  /** Factual summary with its denominator, e.g. "In range 3 of 6 logged nights". */
  summary: string;
  /** The count inside the summary, emphasised. */
  count?: string;
  coverage: Coverage;
}

/**
 * Mandatory row under every chart. An average over 3 of 7 days is a different
 * claim from an average over 7, so the denominator is never implied.
 */
export default function ChartFoot({ summary, count, coverage }: Props) {
  return (
    <div className={styles.foot}>
      <span>
        {coverage.insufficient ? (
          'Not enough logged days to summarise yet'
        ) : (
          <>
            {summary}
            {count !== undefined && <b> {count}</b>}
          </>
        )}
      </span>
      <span className={`${styles.cov} ${coverage.thin ? styles.covThin : ''}`}>
        {coverage.logged} / {coverage.total}
      </span>
    </div>
  );
}
