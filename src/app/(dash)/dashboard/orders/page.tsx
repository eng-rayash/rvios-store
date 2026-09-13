import type { Metadata } from 'next';
import { OrdersScreen } from '@/components/dash/orders-screen';

export const metadata: Metadata = { title: 'الطلبات' };

export default function OrdersPage() {
  return <OrdersScreen />;
}
