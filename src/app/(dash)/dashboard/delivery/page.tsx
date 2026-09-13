import type { Metadata } from 'next';
import { DeliveryScreen } from '@/components/dash/delivery-screen';

export const metadata: Metadata = { title: 'التوصيل والدفع' };

export default function DeliveryPage() {
  return <DeliveryScreen />;
}
