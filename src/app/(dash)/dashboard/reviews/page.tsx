import type { Metadata } from 'next';
import { ReviewsScreen } from '@/components/dash/reviews-screen';

export const metadata: Metadata = { title: 'التقييمات' };

export default function ReviewsPage() {
  return <ReviewsScreen />;
}
