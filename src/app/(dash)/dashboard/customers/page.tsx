import type { Metadata } from 'next';
import { CustomersScreen } from '@/components/dash/customers-screen';

export const metadata: Metadata = { title: 'العملاء' };

export default function CustomersPage() {
  return <CustomersScreen />;
}
