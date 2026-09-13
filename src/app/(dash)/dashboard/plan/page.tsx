import type { Metadata } from 'next';
import { PlanScreen } from '@/components/dash/plan-screen';

export const metadata: Metadata = { title: 'الاشتراك' };

export default function PlanPage() {
  return <PlanScreen />;
}
