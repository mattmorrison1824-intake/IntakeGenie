'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { createBrowserClient } from '@/lib/clients/supabase';

function LandingPageContent() {
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return createBrowserClient();
  }, []);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();

    // Listen for auth changes
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
      });
      return () => subscription.unsubscribe();
    }
  }, [supabase]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    // Create intersection observers for each section
    Object.keys(sectionsRef.current).forEach((key) => {
      const element = sectionsRef.current[key];
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible((prev) => ({ ...prev, [key]: true }));
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #F5F7FA, #ffffff, #F5F7FA)' }}>
      {/* Navigation */}
      <nav 
        className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50 transition-all duration-300"
        style={{ borderColor: '#4A5D73' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 relative">
            <div className="flex items-center">
              <Link href="/" className="transition-transform duration-300 hover:scale-105">
                <img 
                  src="/full-logo.png" 
                  alt="IntakeGenie" 
                  className="h-16 w-auto"
                />
              </Link>
            </div>
            <nav className="hidden md:flex items-center space-x-6 absolute left-1/2 transform -translate-x-1/2">
              <a
                href="#features"
                className="text-sm font-medium transition-all duration-300 hover:[color:#0B1F3B] hover:scale-105 cursor-pointer"
                style={{ color: '#4A5D73' }}
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-sm font-medium transition-all duration-300 hover:[color:#0B1F3B] hover:scale-105 cursor-pointer"
                style={{ color: '#4A5D73' }}
              >
                How It Works
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium transition-all duration-300 hover:[color:#0B1F3B] hover:scale-105 cursor-pointer"
                style={{ color: '#4A5D73' }}
              >
                Pricing
              </a>
            </nav>
            <div className="flex items-center space-x-6">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 shadow-sm text-white hover:[background-color:#0A1A33] hover:scale-105 hover:shadow-lg cursor-pointer"
                  style={{ backgroundColor: '#0B1F3B' }}
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:[color:#0B1F3B] hover:scale-105 cursor-pointer"
                    style={{ color: '#4A5D73' }}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/login"
                    className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 shadow-sm text-white hover:[background-color:#0A1A33] hover:scale-105 hover:shadow-lg cursor-pointer"
                    style={{ backgroundColor: '#0B1F3B' }}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 overflow-visible"
        ref={(el) => { sectionsRef.current['hero'] = el; }}
      >
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-left overflow-visible animate-fade-in-up">
            <h1 
              className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight transition-all duration-1000 ${
                isVisible['hero'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ color: '#0B1F3B' }}
            >
              Never Miss a{' '}
              <span 
                className="block leading-tight mt-2 animate-gradient bg-gradient-to-r from-[#0B1F3B] via-[#4A5D73] to-[#C9A24D] bg-clip-text text-transparent bg-[length:200%_auto]"
                style={{ 
                  background: 'linear-gradient(to right, #0B1F3B, #C9A24D)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  display: 'inline-block',
                  animation: 'gradient-shift 3s ease infinite'
                }}
              >
                Legal Lead Again
              </span>
            </h1>
            <p 
              className={`text-lg sm:text-xl mb-6 transition-all duration-1000 delay-200 ${
                isVisible['hero'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ color: '#4A5D73' }}
            >
              AI-powered voice agent that captures intake information when your firm is busy or closed.
              Get structured summaries delivered to your inbox instantly.
            </p>
            <p 
              className={`text-sm sm:text-base mb-8 transition-all duration-1000 delay-300 ${
                isVisible['hero'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ color: '#4A5D73' }}
            >
              No credit card required • Set up in 10 minutes • Cancel anytime
            </p>
            <div 
              className={`flex flex-col sm:flex-row gap-4 transition-all duration-1000 delay-400 ${
                isVisible['hero'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform hover:-translate-y-1 text-white hover:[background-color:#0A1A33] cursor-pointer text-center"
                  style={{ backgroundColor: '#0B1F3B' }}
                >
                  Go to Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform hover:-translate-y-1 text-white hover:[background-color:#0A1A33] cursor-pointer text-center"
                  style={{ backgroundColor: '#0B1F3B' }}
                >
                  Start Free Trial - No Credit Card
                </Link>
              )}
              <Link
                href="#features"
                className="px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 shadow-lg border-2 bg-white hover:[background-color:#F5F7FA] hover:scale-105 transform hover:-translate-y-1 cursor-pointer text-center"
                style={{ color: '#0B1F3B', borderColor: '#0B1F3B' }}
              >
                See How It Works
              </Link>
            </div>
          </div>

          {/* Right Column - Hero Illustration */}
          <div 
            className={`flex justify-center lg:justify-end items-center transition-all duration-1000 delay-500 ${
              isVisible['hero'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="relative w-full max-w-lg lg:max-w-xl">
              <img
                src="/hero-illustration.png"
                alt="IntakeGenie AI Assistant"
                className="w-full h-auto rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-[1.02]"
                style={{ 
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section 
        id="features" 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        ref={(el) => { sectionsRef.current['features'] = el; }}
      >
        <div 
          className={`text-center mb-16 transition-all duration-1000 ${
            isVisible['features'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h2 className="text-4xl font-bold mb-4" style={{ color: '#0B1F3B' }}>Turn Missed Calls Into Clients</h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: '#4A5D73' }}>
            Capture leads 24/7 with intelligent routing and automated intake collection. Every call becomes an opportunity.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: (
                <svg className="w-6 h-6" style={{ color: '#0B1F3B' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              title: '24/7 Availability',
              description: 'Never miss a call. Our AI agent handles after-hours and no-answer scenarios automatically, ensuring every lead is captured.',
              bgColor: 'rgba(11, 31, 59, 0.1)',
              delay: 0
            },
            {
              icon: (
                <svg className="w-6 h-6" style={{ color: '#C9A24D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
              title: 'Structured Intake',
              description: 'Collects all essential information: contact details, incident information, injuries, treatment status, and more in a structured format.',
              bgColor: 'rgba(201, 162, 77, 0.1)',
              delay: 100
            },
            {
              icon: (
                <svg className="w-6 h-6" style={{ color: '#0B1F3B' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              ),
              title: 'Instant Summaries',
              description: 'Receive beautifully formatted email summaries with transcripts, recordings, and actionable insights within minutes of each call.',
              bgColor: 'rgba(11, 31, 59, 0.1)',
              delay: 200
            },
            {
              icon: (
                <svg className="w-6 h-6" style={{ color: '#C9A24D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
              title: 'Emergency Detection',
              description: 'Automatically detects emergencies and directs callers to 911, while flagging urgent cases for immediate attention.',
              bgColor: 'rgba(201, 162, 77, 0.1)',
              delay: 300
            },
            {
              icon: (
                <svg className="w-6 h-6" style={{ color: '#0B1F3B' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ),
              title: 'Easy Configuration',
              description: 'Set up business hours, routing preferences, and notification emails in minutes. No technical expertise required.',
              bgColor: 'rgba(11, 31, 59, 0.1)',
              delay: 400
            },
            {
              icon: (
                <svg className="w-6 h-6" style={{ color: '#C9A24D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              title: 'Call Analytics',
              description: 'Track all calls with detailed logs, transcripts, and recordings. Filter by status, urgency, and date for easy management.',
              bgColor: 'rgba(201, 162, 77, 0.1)',
              delay: 500
            }
          ].map((feature, index) => (
            <div
              key={index}
              className={`bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 ${
                isVisible['features'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ 
                transitionDelay: `${feature.delay}ms`,
                animation: isVisible['features'] ? `fadeInUp 0.6s ease-out ${feature.delay}ms both` : 'none'
              }}
            >
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform duration-300 hover:rotate-6 hover:scale-110"
                style={{ backgroundColor: feature.bgColor }}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#0B1F3B' }}>{feature.title}</h3>
              <p style={{ color: '#4A5D73' }}>{feature.description}</p>
            </div>
          ))}
          </div>
      </section>

      {/* How It Works */}
      <section 
        id="how-it-works" 
        className="py-20" 
        style={{ backgroundColor: '#F5F7FA' }}
        ref={(el) => { sectionsRef.current['how-it-works'] = el; }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div 
            className={`text-center mb-16 transition-all duration-1000 ${
              isVisible['how-it-works'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#0B1F3B' }}>How It Works</h2>
            <p className="text-xl max-w-2xl mx-auto mb-6" style={{ color: '#4A5D73' }}>
              Set up in minutes, start capturing leads today. No technical expertise required.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { num: '1', title: 'Call Comes In', desc: 'Caller dials your firm number during or after business hours' },
              { num: '2', title: 'Smart Routing', desc: 'System routes to your team if available, or to AI agent if busy/closed' },
              { num: '3', title: 'Intake Collection', desc: 'AI agent conducts professional intake conversation, collecting all essential details' },
              { num: '4', title: 'Instant Delivery', desc: 'Receive formatted email with summary, transcript, and recording link' }
            ].map((step, index) => (
              <div
                key={index}
                className={`text-center transition-all duration-700 ${
                  isVisible['how-it-works'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ 
                  transitionDelay: `${index * 150}ms`,
                  animation: isVisible['how-it-works'] ? `fadeInUp 0.6s ease-out ${index * 150}ms both` : 'none'
                }}
              >
                <div 
                  className="w-16 h-16 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 transition-all duration-500 hover:scale-110 hover:rotate-6 hover:shadow-lg"
                  style={{ backgroundColor: '#0B1F3B' }}
                >
                  {step.num}
            </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#0B1F3B' }}>{step.title}</h3>
                <p style={{ color: '#4A5D73' }}>{step.desc}</p>
          </div>
            ))}
          </div>
          <div 
            className={`text-center mt-12 transition-all duration-1000 delay-700 ${
              isVisible['how-it-works'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 shadow-lg inline-block text-white hover:[background-color:#0A1A33] hover:scale-105 hover:shadow-xl cursor-pointer"
                style={{ backgroundColor: '#0B1F3B' }}
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 shadow-lg inline-block text-white hover:[background-color:#0A1A33] hover:scale-105 hover:shadow-xl cursor-pointer"
                style={{ backgroundColor: '#0B1F3B' }}
              >
                Get Started Now
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section 
        id="pricing" 
        className="py-20" 
        style={{ backgroundColor: '#F5F7FA' }}
        ref={(el) => { sectionsRef.current['pricing'] = el; }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div 
            className={`text-center mb-16 transition-all duration-1000 ${
              isVisible['pricing'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#0B1F3B' }}>Simple, Transparent Pricing</h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#4A5D73' }}>
              Choose the plan that works best for your firm
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Starter',
                price: '$49',
                period: '/month',
                minutes: '60 minutes',
                approxCalls: '~30 calls',
                desc: 'Best to begin with',
                features: ['24/7 AI agent', 'Email summaries', 'Call recordings'],
                cta: 'Get Started',
                featured: false
              },
              {
                name: 'Professional',
                price: '$149',
                period: '/month',
                minutes: '200 minutes',
                approxCalls: '~100 calls',
                desc: 'Best for single attorney',
                features: ['24/7 AI agent', 'Email summaries', 'Call recordings', 'Priority support', 'Advanced analytics'],
                cta: 'Get Started',
                featured: true
              },
              {
                name: 'Turbo',
                price: '$499',
                period: '/month',
                minutes: '1000 minutes',
                approxCalls: '~500 calls',
                desc: 'For bigger firms',
                features: ['24/7 AI agent', 'Email summaries', 'Call recordings', 'Dedicated support', 'Custom integrations'],
                cta: 'Get Started',
                featured: false
              }
            ].map((plan, index) => (
              <div
                key={index}
                className={`bg-white p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 relative ${
                  plan.featured ? 'border-2' : ''
                } ${
                  isVisible['pricing'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ 
                  borderColor: plan.featured ? '#C9A24D' : 'transparent',
                  transitionDelay: `${index * 150}ms`,
                  animation: isVisible['pricing'] ? `fadeInUp 0.6s ease-out ${index * 150}ms both` : 'none'
                }}
              >
                {plan.featured && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 animate-bounce">
                    <span className="bg-gradient-to-r from-[#0B1F3B] to-[#C9A24D] text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
              </div>
                )}
            <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2" style={{ color: '#0B1F3B' }}>{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-extrabold" style={{ color: '#0B1F3B' }}>{plan.price}</span>
                    <span className="text-lg" style={{ color: '#4A5D73' }}>{plan.period}</span>
              </div>
                  <p className="text-sm mb-4" style={{ color: '#4A5D73' }}>{plan.desc}</p>
                  <div className="mb-6 flex items-center justify-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: '#0B1F3B' }}>{plan.minutes}</span>
                    <div className="relative group">
                      <svg 
                        className="w-4 h-4 cursor-help" 
                        style={{ color: '#4A5D73' }} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Approximately {plan.approxCalls} per month
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <ul className="text-left space-y-3 mb-8">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start">
                        <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0 transition-transform duration-300 hover:scale-125" style={{ color: '#C9A24D' }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span style={{ color: '#4A5D73' }}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={isAuthenticated ? "/dashboard" : "/login"}
                    className={`block w-full px-6 py-3 rounded-lg text-center font-semibold transition-all duration-300 hover:scale-105 cursor-pointer ${
                      plan.featured 
                        ? 'text-white hover:[background-color:#0A1A33]' 
                        : 'border-2 hover:[background-color:#F5F7FA]'
                    }`}
                    style={plan.featured ? { backgroundColor: '#0B1F3B' } : { color: '#0B1F3B', borderColor: '#0B1F3B' }}
                  >
                    {isAuthenticated ? "Go to Dashboard" : plan.cta}
                  </Link>
            </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        className="py-20 relative overflow-hidden" 
        style={{ background: 'linear-gradient(to right, #0B1F3B, #1a2f4f)' }}
        ref={(el) => { sectionsRef.current['cta'] = el; }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-[#C9A24D] rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#C9A24D] rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        <div className={`max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-1000 ${
          isVisible['cta'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Stop Losing Leads?</h2>
          <p className="text-xl mb-4" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Start capturing intake calls 24/7 with IntakeGenie. Set up takes less than 10 minutes.
          </p>
          <p className="text-base mb-8" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            No credit card required • Free trial • Cancel anytime
          </p>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 shadow-lg inline-block bg-white hover:bg-gray-100 hover:scale-105 hover:shadow-xl cursor-pointer"
              style={{ color: '#0B1F3B' }}
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 shadow-lg inline-block bg-white hover:bg-gray-100 hover:scale-105 hover:shadow-xl cursor-pointer"
              style={{ color: '#0B1F3B' }}
            >
              Start Your Free Trial
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12" style={{ backgroundColor: '#0B1F3B' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <img 
              src="/full-logo.png" 
              alt="IntakeGenie" 
              className="h-8 w-auto mx-auto mb-4 transition-transform duration-300 hover:scale-110"
            />
            <p className="mb-4" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Never miss a legal lead again.</p>
            <div className="flex justify-center space-x-6">
              {isAuthenticated ? (
                <Link 
                  href="/dashboard" 
                  className="transition-all duration-300 hover:text-white hover:scale-110" 
                  style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link 
                    href="/login" 
                    className="transition-all duration-300 hover:text-white hover:scale-110" 
                    style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/login" 
                    className="transition-all duration-300 hover:text-white hover:scale-110" 
                    style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
            <p className="mt-8 text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>© 2024 IntakeGenie. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #F5F7FA, #ffffff, #F5F7FA)' }}>
        <div className="text-center">
          <div className="text-2xl font-bold mb-2 animate-pulse" style={{ color: '#0B1F3B' }}>Loading...</div>
        </div>
      </div>
    }>
      <LandingPageContent />
    </Suspense>
  );
}
