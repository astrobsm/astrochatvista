import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Video, FileText, Users, Shield, Mic, BarChart3 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Top Banner */}
      <div className="fixed top-0 z-50 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 py-1.5 text-center">
        <p className="text-sm font-medium text-white">
          A <span className="font-bold">Blackvelvet</span> production by <span className="font-bold">Bonnesante Medicals</span>
        </p>
      </div>

      {/* Navigation */}
      <nav className="fixed top-8 z-50 w-full border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ChatVista" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="text-xl font-bold text-white">ChatVista</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="/features" className="text-gray-400 hover:text-white transition">
              Features
            </Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition">
              Pricing
            </Link>
            <Link href="/enterprise" className="text-gray-400 hover:text-white transition">
              Enterprise
            </Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition">
              Docs
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-300 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-40 pb-20">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-400 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            Now with AI-powered meeting intelligence
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Video Meetings That
            <span className="block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Work for You
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-xl text-gray-400 mb-10">
            Enterprise-grade video conferencing with real-time transcription, 
            AI-generated meeting minutes, and seamless team collaboration.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="group flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-4 text-lg font-semibold text-white hover:bg-indigo-700 transition"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/demo"
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-8 py-4 text-lg font-semibold text-white hover:bg-gray-800 transition"
            >
              <Video className="h-5 w-5" />
              Watch Demo
            </Link>
          </div>

          {/* Hero Image/Preview */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent z-10" />
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-2 shadow-2xl">
              <div className="aspect-video rounded-lg bg-gray-800 flex items-center justify-center">
                <div className="text-center text-gray-600">
                  <Video className="h-16 w-16 mx-auto mb-4" />
                  <p>Meeting Preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-gray-800">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything you need for productive meetings
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              From HD video to AI-powered insights, ChatVista transforms how teams collaborate
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            <FeatureCard
              icon={<Video className="h-6 w-6" />}
              title="HD Video Conferencing"
              description="Crystal clear video and audio with support for up to 1000 participants and advanced noise cancellation."
            />
            <FeatureCard
              icon={<Mic className="h-6 w-6" />}
              title="Real-time Transcription"
              description="Automatic speech-to-text with speaker identification and multi-language support."
            />
            <FeatureCard
              icon={<FileText className="h-6 w-6" />}
              title="AI Meeting Minutes"
              description="Intelligent summarization with action items, decisions, and key discussion points."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Team Collaboration"
              description="Shared whiteboards, screen sharing, polls, reactions, and real-time chat."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Enterprise Security"
              description="End-to-end encryption, SSO, RBAC, and compliance with SOC 2, HIPAA, GDPR."
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Advanced Analytics"
              description="Meeting insights, engagement metrics, and productivity reports for your organization."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-gray-800">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to transform your meetings?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands of teams already using ChatVista for smarter collaboration.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-4 text-lg font-semibold text-white hover:bg-indigo-700 transition"
          >
            Get Started for Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="ChatVista" width={32} height={32} className="h-8 w-8 rounded-lg" />
              <span className="text-xl font-bold text-white">ChatVista</span>
            </div>
            <p className="text-gray-500">
              © {new Date().getFullYear()} ChatVista. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-indigo-500/50 hover:bg-gray-900 transition-all">
      <div className="mb-4 inline-flex rounded-lg bg-indigo-500/10 p-3 text-indigo-400 group-hover:bg-indigo-500/20 transition">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
