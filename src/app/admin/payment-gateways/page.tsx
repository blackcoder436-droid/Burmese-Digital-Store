import { redirect } from 'next/navigation';

export default function AdminPaymentGatewaysRedirectPage() {
  redirect('/admin/settings#payment-gateways');
}
