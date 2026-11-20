import {redirect} from 'next/navigation';

export default function NewProjectRedirect(): never {
  redirect('/dashboard/new');
}
