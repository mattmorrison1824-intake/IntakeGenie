'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #F5F7FA, #ffffff, #F5F7FA)' }}>
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50" style={{ borderColor: '#4A5D73' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/">
                <img 
                  src="/full-logo.png" 
                  alt="IntakeGenie" 
                  className="h-16 w-auto"
                />
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              <nav className="hidden md:flex items-center space-x-6">
                <a
                  href="#features"
                  className="text-sm font-medium transition-colors hover:[color:#0B1F3B] cursor-pointer"
                  style={{ color: '#4A5D73' }}
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  className="text-sm font-medium transition-colors hover:[color:#0B1F3B] cursor-pointer"
                  style={{ color: '#4A5D73' }}
                >
                  How It Works
                </a>
                <a
                  href="#pricing"
                  className="text-sm font-medium transition-colors hover:[color:#0B1F3B] cursor-pointer"
                  style={{ color: '#4A5D73' }}
                >
                  Pricing
                </a>
              </nav>
              <Link
                href="/login"
                className="px-3 py-2 rounded-md text-sm font-medium transition-colors hover:[color:#0B1F3B] cursor-pointer"
                style={{ color: '#4A5D73' }}
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm text-white hover:[background-color:#0A1A33] cursor-pointer"
                style={{ backgroundColor: '#0B1F3B' }}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 overflow-visible">
        <div className="text-center overflow-visible">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-[1.1] py-2" style={{ color: '#0B1F3B' }}>
            Never Miss a{' '}
            <span className="block leading-[1.1] py-1 mt-2" style={{ background: 'linear-gradient(to right, #0B1F3B, #C9A24D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}>
              Legal Lead Again
            </span>
          </h1>
          <p className="text-xl mb-8 max-w-3xl mx-auto" style={{ color: '#4A5D73' }}>
            AI-powered voice agent that captures intake information when your firm is busy or closed.
            Get structured summaries delivered to your inbox instantly.
          </p>
          <p className="text-sm mb-8 max-w-2xl mx-auto" style={{ color: '#4A5D73' }}>
            No credit card required • Set up in 10 minutes • Cancel anytime
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-white hover:[background-color:#0A1A33] cursor-pointer"
              style={{ backgroundColor: '#0B1F3B' }}
            >
              Start Free Trial - No Credit Card
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg border-2 bg-white hover:[background-color:#F5F7FA] cursor-pointer"
              style={{ color: '#0B1F3B', borderColor: '#0B1F3B' }}
            >
              See How It Works
            </Link>
          </div>
        </div>

        {/* Hero Image/Illustration */}
        <div className="mt-16 flex justify-center">
          <div className="relative w-full max-w-4xl">
            <div className="rounded-2xl p-8 shadow-2xl" style={{ background: 'linear-gradient(to right, rgba(11, 31, 59, 0.1), rgba(201, 162, 77, 0.1))' }}>
              <div className="bg-white rounded-lg p-6 shadow-lg">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0B1F3B' }}>
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-24"></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 rounded w-full" style={{ backgroundColor: 'rgba(11, 31, 59, 0.1)' }}></div>
                  <div className="h-4 rounded w-3/4" style={{ backgroundColor: 'rgba(11, 31, 59, 0.1)' }}></div>
                  <div className="h-4 rounded w-5/6" style={{ backgroundColor: 'rgba(201, 162, 77, 0.1)' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ color: '#0B1F3B' }}>Turn Missed Calls Into Clients</h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: '#4A5D73' }}>
            Capture leads 24/7 with intelligent routing and automated intake collection. Every call becomes an opportunity.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(11, 31, 59, 0.1)' }}>
              <svg
                className="w-6 h-6"
                style={{ color: '#0B1F3B' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#0B1F3B' }}>24/7 Availability</h3>
            <p style={{ color: '#4A5D73' }}>
              Never miss a call. Our AI agent handles after-hours and no-answer scenarios
              automatically, ensuring every lead is captured.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(201, 162, 77, 0.1)' }}>
              <svg
                className="w-6 h-6"
                style={{ color: '#C9A24D' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#0B1F3B' }}>Structured Intake</h3>
            <p style={{ color: '#4A5D73' }}>
              Collects all essential information: contact details, incident information, injuries,
              treatment status, and more in a structured format.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(11, 31, 59, 0.1)' }}>
              <svg
                className="w-6 h-6"
                style={{ color: '#0B1F3B' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#0B1F3B' }}>Instant Summaries</h3>
            <p style={{ color: '#4A5D73' }}>
              Receive beautifully formatted email summaries with transcripts, recordings, and
              actionable insights within minutes of each call.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(201, 162, 77, 0.1)' }}>
              <svg
                className="w-6 h-6"
                style={{ color: '#C9A24D' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#0B1F3B' }}>Emergency Detection</h3>
            <p style={{ color: '#4A5D73' }}>
              Automatically detects emergencies and directs callers to 911, while flagging urgent
              cases for immediate attention.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(11, 31, 59, 0.1)' }}>
              <svg
                className="w-6 h-6"
                style={{ color: '#0B1F3B' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#0B1F3B' }}>Easy Configuration</h3>
            <p style={{ color: '#4A5D73' }}>
              Set up business hours, routing preferences, and notification emails in minutes. No
              technical expertise required.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(201, 162, 77, 0.1)' }}>
              <svg
                className="w-6 h-6"
                style={{ color: '#C9A24D' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#0B1F3B' }}>Call Analytics</h3>
            <p style={{ color: '#4A5D73' }}>
              Track all calls with detailed logs, transcripts, and recordings. Filter by status,
              urgency, and date for easy management.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20" style={{ backgroundColor: '#F5F7FA' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#0B1F3B' }}>How It Works</h2>
            <p className="text-xl max-w-2xl mx-auto mb-6" style={{ color: '#4A5D73' }}>
              Set up in minutes, start capturing leads today. No technical expertise required.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4" style={{ backgroundColor: '#0B1F3B' }}>
                1
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#0B1F3B' }}>Call Comes In</h3>
              <p style={{ color: '#4A5D73' }}>
                Caller dials your firm number during or after business hours
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4" style={{ backgroundColor: '#0B1F3B' }}>
                2
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#0B1F3B' }}>Smart Routing</h3>
              <p style={{ color: '#4A5D73' }}>
                System routes to your team if available, or to AI agent if busy/closed
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4" style={{ backgroundColor: '#0B1F3B' }}>
                3
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#0B1F3B' }}>Intake Collection</h3>
              <p style={{ color: '#4A5D73' }}>
                AI agent conducts professional intake conversation, collecting all essential details
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4" style={{ backgroundColor: '#0B1F3B' }}>
                4
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#0B1F3B' }}>Instant Delivery</h3>
              <p style={{ color: '#4A5D73' }}>
                Receive formatted email with summary, transcript, and recording link
              </p>
            </div>
          </div>
          <div className="text-center mt-12">
            <Link
              href="/login"
              className="px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg inline-block text-white hover:[background-color:#0A1A33] cursor-pointer"
              style={{ backgroundColor: '#0B1F3B' }}
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20" style={{ backgroundColor: '#F5F7FA' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#0B1F3B' }}>Simple, Transparent Pricing</h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#4A5D73' }}>
              Choose the plan that works best for your firm
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#0B1F3B' }}>Starter</h3>
                <div className="mb-4">
                  <span className="text-4xl font-extrabold" style={{ color: '#0B1F3B' }}>$99</span>
                  <span className="text-lg" style={{ color: '#4A5D73' }}>/month</span>
                </div>
                <p className="text-sm mb-6" style={{ color: '#4A5D73' }}>
                  Perfect for small firms getting started
                </p>
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Up to 100 calls/month</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>24/7 AI agent</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Email summaries</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Call recordings</span>
                  </li>
                </ul>
                <Link
                  href="/login"
                  className="block w-full px-6 py-3 rounded-lg text-center font-semibold transition-all border-2 hover:[background-color:#F5F7FA] cursor-pointer"
                  style={{ color: '#0B1F3B', borderColor: '#0B1F3B' }}
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Professional Plan - Featured */}
            <div className="bg-white p-8 rounded-xl shadow-xl hover:shadow-2xl transition-shadow border-2 relative" style={{ borderColor: '#C9A24D' }}>
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-[#0B1F3B] to-[#C9A24D] text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#0B1F3B' }}>Professional</h3>
                <div className="mb-4">
                  <span className="text-4xl font-extrabold" style={{ color: '#0B1F3B' }}>$299</span>
                  <span className="text-lg" style={{ color: '#4A5D73' }}>/month</span>
                </div>
                <p className="text-sm mb-6" style={{ color: '#4A5D73' }}>
                  Ideal for growing law firms
                </p>
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Up to 500 calls/month</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>24/7 AI agent</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Email summaries</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Call recordings</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Priority support</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Advanced analytics</span>
                  </li>
                </ul>
                <Link
                  href="/login"
                  className="block w-full px-6 py-3 rounded-lg text-center font-semibold text-white transition-all hover:[background-color:#0A1A33] cursor-pointer"
                  style={{ backgroundColor: '#0B1F3B' }}
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#0B1F3B' }}>Enterprise</h3>
                <div className="mb-4">
                  <span className="text-4xl font-extrabold" style={{ color: '#0B1F3B' }}>Custom</span>
                </div>
                <p className="text-sm mb-6" style={{ color: '#4A5D73' }}>
                  For large firms with high call volume
                </p>
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Unlimited calls</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>24/7 AI agent</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Email summaries</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Call recordings</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Dedicated support</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ color: '#4A5D73' }}>Custom integrations</span>
                  </li>
                </ul>
                <Link
                  href="/login"
                  className="block w-full px-6 py-3 rounded-lg text-center font-semibold transition-all border-2 hover:[background-color:#F5F7FA] cursor-pointer"
                  style={{ color: '#0B1F3B', borderColor: '#0B1F3B' }}
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20" style={{ background: 'linear-gradient(to right, #0B1F3B, #1a2f4f)' }}>
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Stop Losing Leads?</h2>
          <p className="text-xl mb-4" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Start capturing intake calls 24/7 with IntakeGenie. Set up takes less than 10 minutes.
          </p>
          <p className="text-base mb-8" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            No credit card required • Free trial • Cancel anytime
          </p>
          <Link
            href="/login"
            className="px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg inline-block bg-white hover:bg-gray-100 cursor-pointer"
            style={{ color: '#0B1F3B' }}
          >
            Start Your Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12" style={{ backgroundColor: '#0B1F3B' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <img 
              src="/full-logo.png" 
              alt="IntakeGenie" 
              className="h-8 w-auto mx-auto mb-4"
            />
            <p className="mb-4" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Never miss a legal lead again.</p>
            <div className="flex justify-center space-x-6">
              <Link 
                href="/login" 
                className="transition-colors hover:text-white" 
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Sign In
              </Link>
              <Link 
                href="/login" 
                className="transition-colors hover:text-white" 
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Get Started
              </Link>
            </div>
            <p className="mt-8 text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>© 2024 IntakeGenie. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
