'use client';

import { Mail, Phone } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

function SocialIcon({ type }: { type: 'telegram' | 'whatsapp' | 'viber' | 'facebook' | 'email' }) {
  if (type === 'telegram') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0088cc]" fill="currentColor" aria-hidden="true">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    );
  }

  if (type === 'whatsapp') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#25d366]" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
      </svg>
    );
  }

  if (type === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#1877f2]" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  if (type === 'viber') {
    return <Phone className="w-5 h-5 text-[#7360f2]" />;
  }

  return <Mail className="w-5 h-5 text-[#ea4335]" />;
}

export default function ContactPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();

  const contacts = [
    {
      type: 'telegram' as const,
      title: t('contact.page.telegramBot'),
      subtitle: t('contact.page.telegramBotSubtitle'),
      value: '@BurmeseDigitalStore_bot',
      href: 'https://t.me/BurmeseDigitalStore_bot',
    },
    {
      type: 'telegram' as const,
      title: t('contact.page.telegramChannel'),
      subtitle: t('contact.page.telegramChannelSubtitle'),
      value: '@BurmeseDigitalStore',
      href: 'https://t.me/BurmeseDigitalStore',
    },
    {
      type: 'whatsapp' as const,
      title: 'WhatsApp',
      subtitle: t('contact.page.whatsappSubtitle'),
      value: '+1 (857) 334-2772',
      href: 'https://wa.me/18573342772',
    },
    {
      type: 'viber' as const,
      title: 'Viber',
      subtitle: t('contact.page.viberSubtitle'),
      value: '+1 (857) 334-2772',
      href: 'viber://chat?number=%2B18573342772',
    },
    {
      type: 'email' as const,
      title: t('auth.email'),
      subtitle: t('contact.page.emailSubtitle'),
      value: 'support@burmesedigital.store',
      href: 'mailto:support@burmesedigital.store',
    },
    {
      type: 'facebook' as const,
      title: 'Facebook',
      subtitle: t('contact.page.facebookSubtitle'),
      value: 'Burmese Digital Store',
      href: 'https://www.facebook.com/BurmeseDigitalStore/',
    },
  ];

  return (
    <div className="min-h-screen pt-8 sm:pt-10 pb-16 sm:pb-20 bg-mesh relative z-[1]" ref={containerRef}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="scroll-fade text-center mb-16">
          <h1 className="heading-lg mb-4">
            {t('contact.page.contact')} <span className="text-accent-gradient">{t('contact.page.us')}</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            {t('contact.page.helpText')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {contacts.map((contact, i) => {
              return (
                <a
                  key={contact.title}
                  href={contact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="scroll-fade game-card p-5 flex items-start space-x-4 group"
                  data-delay={`${i * 100}`}
                >
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 group-hover:shadow-glow-sm transition-all">
                    <SocialIcon type={contact.type} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{contact.title}</p>
                    <p className="text-sm font-medium text-gray-200">
                      {contact.value}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{contact.subtitle}</p>
                  </div>
                </a>
              );
            })}
        </div>

      </div>
    </div>
  );
}
