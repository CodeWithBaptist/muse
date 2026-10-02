'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { transitions, fadeInUp, staggerContainer } from '@/lib/motion';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/ui/Logo';
import Link from 'next/link';

export function Hero() {
  const { authenticated } = useAuth();
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <motion.div
        variants={staggerContainer(0.1, 0.2)}
        initial="initial"
        animate="animate"
        className="max-w-4xl mx-auto text-center space-y-8"
      >
        <div className="flex justify-center overflow-hidden">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ ...transitions.emphasized, duration: 0.8 }}
          >
            <Logo variant="wordmark" size={240} className="md:w-[480px] md:h-auto" />
          </motion.div>
        </div>

        <motion.div variants={fadeInUp} className="space-y-6">
          <h2 className="type-display text-[clamp(40px,7vw,80px)] text-balance">
            Your music,<br />understood.
          </h2>
          <p className="max-w-2xl mx-auto text-text-secondary text-lg md:text-xl font-medium text-balance leading-relaxed">
            Discover music, build playlists, and explore your taste through conversation.
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          {authenticated ? (
            <Link href="/chat">
              <Button variant="primary">Go to Chat</Button>
            </Link>
          ) : (
            <Button 
              onClick={() => window.location.href = '/api/auth/spotify'}
              variant="primary"
            >
              Connect Spotify
            </Button>
          )}
          <Button variant="outline">See how it works</Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
