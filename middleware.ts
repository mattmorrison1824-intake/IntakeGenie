import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/database';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Public routes - allow landing page, login, ALL Twilio webhook routes, audio endpoints, and test endpoints
  // This check happens FIRST before any Supabase client creation to avoid 401 errors
  // CRITICAL: Return immediately for Twilio routes and audio endpoints to prevent any interference
  if (
    pathname.startsWith('/api/twilio') || 
    pathname.startsWith('/api/audio') ||
    pathname.startsWith('/api/test-email') ||
    pathname.startsWith('/api/test-intake-email') ||
    pathname.startsWith('/api/test-voice-latency')
  ) {
    console.log(`[Middleware] Allowing public route: ${method} ${pathname}`);
    // Return immediately without any modifications to preserve the request
    return NextResponse.next();
  }

  if (pathname === '/' || pathname === '/login') {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
     * - api/twilio (Twilio webhooks - must be public, handled by early return)
     * - public folder
     * 
     * Note: Even though we check for /api/twilio in the middleware function,
     * we still try to exclude it from the matcher to minimize processing
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

