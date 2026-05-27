import { redirect } from 'next/navigation';

export default function AdminFreeTestUsersRedirectPage() {
  redirect('/admin/users?view=free-test');
}
