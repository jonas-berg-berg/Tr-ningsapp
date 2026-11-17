import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Sidor som nås utan inloggning.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/api/cron/')
  );
}

/**
 * Förnyar Supabase-sessionen (cookies) på varje sidanrop och skickar
 * utloggade besökare till /login. Riktig behörighet avgörs av RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Felkonfiguration: släpp inte igenom skyddade sidor.
    if (isPublicPath(request.nextUrl.pathname)) return response;
    return new NextResponse('Supabase är inte konfigurerat.', { status: 500 });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Kör inget mellan createServerClient och getUser (sessionen förnyas här).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    const redirect = NextResponse.redirect(loginUrl);
    // Behåll eventuella cookie-uppdateringar (t.ex. rensad session).
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Allt utom Next-interna filer, statiska filer, manifest och service worker.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|js|css|map|woff2?)$).*)',
  ],
};
