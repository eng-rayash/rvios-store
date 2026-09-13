import type { Metadata } from 'next';
import { CategoriesScreen } from '@/components/dash/categories-screen';

export const metadata: Metadata = { title: 'التصنيفات' };

export default function CategoriesPage() {
  return <CategoriesScreen />;
}
