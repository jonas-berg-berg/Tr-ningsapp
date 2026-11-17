import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Träningsappen</h1>
        <p className="mt-1 text-zinc-400">Logga in med ditt användarnamn.</p>
      </div>
      <LoginForm />
      <p className="text-sm text-zinc-500">Inget konto? Be tränaren om en inbjudningslänk.</p>
    </main>
  );
}
