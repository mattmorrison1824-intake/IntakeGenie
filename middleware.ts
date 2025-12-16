import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/database';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const { pathname } = request.nextUrl;

  // Public routes - allow landing page, login, and API routes
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/api/twilio')) {
    return NextResponse.next();
  }

  // Create response to modify cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client with cookie support for middleware
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(cookie => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Get session from cookies
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protected routes - redirect to login if not authenticated
  if (!session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/twilio (Twilio webhooks - must be public)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|api/twilio|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

