import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/database';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Public routes - allow landing page, login, and ALL Twilio webhook routes
  // This check happens FIRST before any Supabase client creation to avoid 401 errors
  if (
    pathname === '/' || 
    pathname === '/login' || 
    pathname.startsWith('/api/twilio')
  ) {
    // Log for debugging (remove in production if needed)
    if (pathname.startsWith('/api/twilio')) {
      console.log(`[Middleware] Allowing Twilio webhook: ${method} ${pathname}`);
    }
    // Create a response that preserves the method
    const response = NextResponse.next();
    // Ensure CORS headers are set for Twilio webhooks
    if (pathname.startsWith('/api/twilio')) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    }
    return response;
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
     * - api/twilio (Twilio webhooks - must be public, completely excluded from middleware)
     * - public folder
     * 
     * Note: We use a negative lookahead at the start to exclude /api/twilio paths
     */
    '^/(?!api/twilio)((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

