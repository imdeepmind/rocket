import { redirect } from 'next/navigation';

export default function AuthIndexPage(): never {
  redirect('/auth/sign-in');
}

