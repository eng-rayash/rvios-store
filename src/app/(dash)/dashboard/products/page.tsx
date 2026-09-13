import type { Metadata } from 'next';
import { ProductsScreen } from '@/components/dash/products-screen';

export const metadata: Metadata = { title: 'المنتجات' };

export default function ProductsPage() {
  return <ProductsScreen />;
}
