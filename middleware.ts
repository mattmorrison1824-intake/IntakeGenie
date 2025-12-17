import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/database';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Public routes - allow landing page, login, ALL Twilio webhook routes, Vapi webhook route, audio endpoints, and test endpoints
  // This check happens FIRST before any Supabase client creation to avoid 401 errors
  // CRITICAL: Return immediately for webhook routes and audio endpoints to prevent any interference
  const publicRoutes = [
    '/api/twilio',
    '/api/vapi/webhook', // Vapi webhook route (must be public for Vapi to call it)
    '/api/audio',
    '/api/process-call', // Allow process-call (called by Twilio and watchdog)
    '/api/test-email',
    '/api/test-intake-email',
    '/api/test-voice-latency',
    '/api/test-transcription',
  ];
  
  // Check if this is a public route - must check exact match for /api/vapi/webhook first
  const isPublicRoute = 
    pathname === '/api/vapi/webhook' ||
    pathname.startsWith('/api/twilio') ||
    pathname.startsWith('/api/audio') ||
    pathname.startsWith('/api/process-call') ||
    pathname.startsWith('/api/test-email') ||
    pathname.startsWith('/api/test-intake-email') ||
    pathname.startsWith('/api/test-voice-latency') ||
    pathname.startsWith('/api/test-transcription');
  
  if (isPublicRoute) {
    console.log(`[Middleware] Allowing public route: ${method} ${pathname}`);
    // Return immediately without any modifications to preserve the request
    // CRITICAL: Do NOT create Supabase client or check session for public routes
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
     * - api/vapi/webhook (Vapi webhooks - must be public, handled by early return)
     * - api/audio (audio endpoints - must be public)
     * - public folder
     * 
     * Note: Even though we check for public routes in the middleware function,
     * we still try to exclude them from the matcher to minimize processing
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/twilio|api/vapi/webhook|api/audio|api/process-call|api/test-|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

