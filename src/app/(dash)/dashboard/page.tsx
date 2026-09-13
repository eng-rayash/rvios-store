import type { Metadata } from 'next';
import { OverviewScreen } from '@/components/dash/overview';

export const metadata: Metadata = { title: 'نظرة عامة' };

export default function DashboardPage() {
  return <OverviewScreen />;
}
