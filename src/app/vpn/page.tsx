'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/language';
import MobileCarousel from '@/components/MobileCarousel';

/* pricing data (1-5 devices x 6 durations) */
const pricing: Record<number, { months: number; price: string; popular?: boolean }[]> = {
  1: [
    { months: 1, price: '3,000' },
    { months: 3, price: '8,000' },
    { months: 5, price: '13,000' },
    { months: 7, price: '18,000', popular: true },
    { months: 9, price: '23,000' },
    { months: 12, price: '30,000' },
  ],
  2: [
    { months: 1, price: '4,000' },
    { months: 3, price: '10,000' },
    { months: 5, price: '17,000' },
    { months: 7, price: '24,000', popular: true },
    { months: 9, price: '30,000' },
    { months: 12, price: '40,000' },
  ],
  3: [
    { months: 1, price: '5,000' },
    { months: 3, price: '13,000' },
    { months: 5, price: '21,000' },
    { months: 7, price: '29,000', popular: true },
    { months: 9, price: '37,000' },
    { months: 12, price: '50,000' },
  ],
  4: [
    { months: 1, price: '6,000' },
    { months: 3, price: '16,000' },
    { months: 5, price: '25,000' },
    { months: 7, price: '35,000', popular: true },
    { months: 9, price: '45,000' },
    { months: 12, price: '60,000' },
  ],
  5: [
    { months: 1, price: '7,000' },
    { months: 3, price: '18,000' },
    { months: 5, price: '30,000' },
    { months: 7, price: '40,000', popular: true },
    { months: 9, price: '52,000' },
    { months: 12, price: '70,000' },
  ],
};

const features = [
  { icon: '\u26A1', titleEn: 'Ultra-Fast Speed', titleMy: '\u1021\u1019\u103C\u1014\u103A\u1006\u102F\u1036\u1038 Speed', descEn: 'Premium Singapore & US servers with fast connection speed. Perfect for Streaming & Gaming.', descMy: 'Premium Singapore & US servers \u1016\u103C\u1004\u103A\u1037 \u1019\u103C\u1014\u103A\u1006\u1014\u103A\u101E\u1031\u102C connection speed \u1000\u102D\u102F \u1015\u1031\u1038\u1005\u103D\u1019\u103A\u1038\u1015\u102B\u101E\u100A\u103A\u104B Streaming, Gaming \u1021\u1010\u103D\u1000\u103A \u101E\u1004\u103A\u1037\u1010\u1031\u102C\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { icon: '\u267E\uFE0F', titleEn: 'Unlimited Data', titleMy: '\u1021\u1000\u1014\u103A\u1037\u1021\u101E\u1010\u103A\u1019\u1032\u1037 Data', descEn: 'No data limit at all. Use without any bandwidth throttling.', descMy: 'Data limit \u101C\u102F\u1036\u1038\u101D \u1019\u101B\u103E\u102D\u1015\u102B\u104B Bandwidth throttling \u1019\u101B\u103E\u102D\u1018\u1032 \u1021\u1000\u1014\u103A\u1037\u1021\u101E\u1010\u103A\u1019\u1032\u1037 \u1021\u101E\u102F\u1036\u1038\u1015\u103C\u102F\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { icon: '\uD83D\uDD10', titleEn: 'Multi-Protocol', titleMy: 'Multi-Protocol', descEn: 'Choose from Trojan, VLESS, VMess, Shadowsocks protocols. Suitable for all ISPs.', descMy: 'Trojan, VLESS, VMess, Shadowsocks protocols \u1019\u103B\u102C\u1038 \u101B\u103D\u1031\u1038\u1001\u103B\u101A\u103A\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B ISP \u1021\u102C\u1038\u101C\u102F\u1036\u1038\u1021\u1010\u103D\u1000\u103A \u101E\u1004\u103A\u1037\u1010\u1031\u102C\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { icon: '\uD83E\uDD16', titleEn: 'Telegram Bot Integration', titleMy: 'Telegram Bot Integration', descEn: 'Auto-generate VPN keys via Telegram Bot. Buy anytime 24/7.', descMy: 'Telegram Bot \u1016\u103C\u1004\u103A\u1037 VPN Key \u1000\u102D\u102F \u1021\u101C\u102D\u102F\u1021\u101C\u103B\u1031\u102C\u1000\u103A \u1016\u1014\u103A\u1010\u102E\u1038\u1015\u1031\u1038\u1015\u102B\u101E\u100A\u103A\u104B 24/7 \u1021\u1001\u103B\u102D\u1014\u103A\u1019\u101B\u103D\u1031\u1038 \u101D\u101A\u103A\u101A\u1030\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { icon: '\uD83D\uDCF1', titleEn: 'Multi-Device Support', titleMy: 'Device \u1019\u103B\u102C\u1038\u1005\u103D\u102C \u1001\u103B\u102D\u1010\u103A\u1006\u1000\u103A\u1014\u102D\u102F\u1004\u103A', descEn: 'Connect 1 to 5 devices simultaneously. Phone, PC, Tablet all supported.', descMy: 'Device 1 \u1001\u102F\u1019\u103E 5 \u1001\u102F\u1021\u1011\u102D \u1010\u1005\u103A\u1015\u103C\u102D\u102F\u1004\u103A\u1014\u1000\u103A \u1021\u101E\u102F\u1036\u1038\u1015\u103C\u102F\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B Phone, PC, Tablet \u1021\u102C\u1038\u101C\u102F\u1036\u1038 \u1001\u103B\u102D\u1010\u103A\u1006\u1000\u103A\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { icon: '\uD83C\uDF81', titleEn: 'Free Test Key', titleMy: 'Free Test Key \u1021\u1001\u103C\u1031\u1038', descEn: 'Get a free VPN test key via Telegram Bot (@BurmeseDigitalStore_bot). Join the channel and press "🎁 Free Test Key" to try before you buy!', descMy: 'Telegram Bot (@BurmeseDigitalStore_bot) \u1019\u103E\u102C "🎁 Free Test Key" \u1000\u102D\u102F \u1014\u103E\u102D\u1015\u103A\u1015\u103C\u102E\u1038 Channel Join \u101C\u102F\u1015\u103A\u101B\u102F\u1036\u1016\u103C\u1004\u103A\u1037 Free VPN Key \u1000\u102D\u102F \u1021\u1001\u103C\u1031\u1038\u101B\u101A\u1030\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B \u101D\u101A\u103A\u1019\u101A\u1030\u1001\u1004\u103A \u1021\u101B\u1004\u103A\u1005\u1019\u103A\u1038\u1000\u103C\u100A\u103A\u1037\u1015\u102B!' },
];

const defaultServers = [
  { id: 'sg1', flag: '\uD83C\uDDF8\uD83C\uDDEC', name: 'Singapore 1', online: true },
  { id: 'sg2', flag: '\uD83C\uDDF8\uD83C\uDDEC', name: 'Singapore 2', online: true },
  { id: 'sg3', flag: '\uD83C\uDDF8\uD83C\uDDEC', name: 'Singapore 3', online: true },
  { id: 'sg4', flag: '\uD83C\uDDF8\uD83C\uDDEC', name: 'Singapore 4', online: true },
  { id: 'us1', flag: '\uD83C\uDDFA\uD83C\uDDF8', name: 'United States', online: true },
  { id: 'ny', flag: '\uD83C\uDDFA\uD83C\uDDF8', name: 'New York', online: true },
];

const stepsData = [
  { titleEn: 'Open Telegram Bot', titleMy: 'Telegram Bot \u1016\u103D\u1004\u103A\u1037\u1015\u102B', descEn: 'Open @BurmeseDigitalStore_bot on Telegram and press /start', descMy: '@BurmeseDigitalStore_bot \u1000\u102D\u102F Telegram \u1019\u103E\u102C \u1016\u103D\u1004\u103A\u1037\u1015\u103C\u102E\u1038 /start \u1014\u103E\u102D\u1015\u103A\u1015\u102B' },
  { titleEn: 'Choose Plan', titleMy: 'Plan \u101B\u103D\u1031\u1038\u1001\u103B\u101A\u103A\u1015\u102B', descEn: 'Select Server, Protocol, Device count, and Duration', descMy: 'Server, Protocol, Device \u1021\u101B\u1031\u1021\u1010\u103D\u1000\u103A, \u1000\u102C\u101C \u1005\u1010\u102C\u1010\u103D\u1031 \u101B\u103D\u1031\u1038\u1015\u102B' },
  { titleEn: 'Make Payment', titleMy: '\u1004\u103D\u1031\u101C\u103D\u103E\u1032\u1015\u102B', descEn: 'Transfer via KBZPay/WavePay and send screenshot', descMy: 'KBZPay/WavePay \u1016\u103C\u1004\u103A\u1037 \u1004\u103D\u1031\u101C\u103D\u103E\u1032\u1015\u103C\u102E\u1038 Screenshot \u1015\u102D\u102F\u1037\u1015\u102B' },
  { titleEn: 'Get Your Key', titleMy: 'Key \u101B\u101A\u1030\u1015\u102B', descEn: 'After approval, receive your VPN key instantly', descMy: 'Approve \u1015\u103C\u102E\u1038\u101B\u1004\u103A VPN Key \u1000\u102D\u102F \u1001\u103B\u1000\u103A\u1001\u103B\u1004\u103A\u1038 \u101B\u101B\u103E\u102D\u1015\u102B\u1019\u100A\u103A' },
];

const playStoreApps = [
  { icon: '\uD83D\uDCE6', name: 'V2Box', platform: 'Android', url: 'https://play.google.com/store/apps/details?id=dev.hexasoftware.v2box&hl=en_SG' },
  { icon: '\u26A1', name: 'V2RayTUN', platform: 'Android', url: 'https://play.google.com/store/apps/details?id=com.v2raytun.android&hl=en_SG' },
  { icon: '\uD83D\uDE80', name: 'Shadowrocket', platform: 'Android', url: 'https://play.google.com/store/apps/details?id=com.v2cross.proxy&gl=PT' },
  { icon: '\uD83C\uDF10', name: 'Npv Tunnel', platform: 'Android', url: 'https://play.google.com/store/apps/details?id=com.napsternetlabs.napsternetv&hl=en_SG' },
];

const appStoreApps = [
  { icon: '\uD83D\uDCE6', name: 'V2Box', platform: 'iOS / iPhone', url: 'https://apps.apple.com/us/app/v2box-v2ray-client/id6446814690' },
  { icon: '\u26A1', name: 'V2RayTUN', platform: 'iOS / iPhone', url: 'https://apps.apple.com/us/app/v2raytun/id6476628951' },
  { icon: '\uD83D\uDE80', name: 'Shadowrocket', platform: 'iOS / iPhone', url: 'https://apps.apple.com/us/app/shadowrocket/id932747118' },
  { icon: '\uD83C\uDF10', name: 'Npv Tunnel', platform: 'iOS / iPhone', url: 'https://apps.apple.com/us/app/npv-tunnel/id1629465476' },
];

const faqData = [
  { qEn: 'What is a VPN?', qMy: 'VPN \u1006\u102D\u102F\u1010\u102C \u1018\u102C\u101C\u1032?', aEn: 'A VPN (Virtual Private Network) encrypts your Internet connection and protects your online privacy. You can access blocked websites and browse securely.', aMy: 'VPN (Virtual Private Network) \u101E\u100A\u103A \u101E\u1004\u103A\u1037 Internet connection \u1000\u102D\u102F encrypt \u101C\u102F\u1015\u103A\u1015\u103C\u102E\u1038 \u101E\u1004\u103A\u1037 online privacy \u1000\u102D\u102F \u1000\u102C\u1000\u103D\u101A\u103A\u1015\u1031\u1038\u1015\u102B\u101E\u100A\u103A\u104B Blocked websites \u1019\u103B\u102C\u1038\u1000\u102D\u102F \u1016\u103D\u1004\u103A\u1037\u1014\u102D\u102F\u1004\u103A\u1015\u103C\u102E\u1038 secure \u1016\u103C\u1005\u103A\u1005\u103D\u102C internet \u101E\u102F\u1036\u1038\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { qEn: 'How to get a Free Test Key?', qMy: 'Free Test Key \u1018\u101A\u103A\u101C\u102D\u102F \u101B\u101A\u1030\u101B\u1019\u101C\u1032?', aEn: 'Open Telegram Bot (@BurmeseDigitalStore_bot) and press "🎁 Free Test Key". After joining the channel, you will get a free key. One per user.', aMy: 'Telegram Bot (@BurmeseDigitalStore_bot) \u1000\u102D\u102F \u1016\u103D\u1004\u103A\u1037\u1015\u103C\u102E\u1038 "🎁 Free Test Key" \u1000\u102D\u102F \u1014\u103E\u102D\u1015\u103A\u1015\u102B\u104B Channel Join \u1015\u103C\u102E\u1038\u101B\u1004\u103A Free Key \u101B\u101B\u103E\u102D\u1015\u102B\u1019\u100A\u103A\u104B User \u1010\u1005\u103A\u1026\u1038\u101C\u103B\u103E\u1004\u103A \u1010\u1005\u103A\u1000\u103C\u102D\u1019\u103A\u101E\u102C \u101B\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { qEn: 'What payment methods are accepted?', qMy: '\u1018\u101A\u103A Payment Methods \u1010\u103D\u1031 \u101C\u1000\u103A\u1001\u1036\u101C\u1032?', aEn: 'We accept KBZPay, WavePay, AYA Pay, and UAB Pay. Just transfer and send the screenshot to the Bot.', aMy: 'KBZPay, WavePay, AYA Pay, UAB Pay \u1010\u102D\u102F\u1037\u1016\u103C\u1004\u103A\u1037 \u1004\u103D\u1031\u101C\u103D\u103E\u1032\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B \u1004\u103D\u1031\u101C\u103D\u103E\u1032\u1015\u103C\u102E\u1038 Screenshot \u1000\u102D\u102F Bot \u1019\u103E\u102C \u1015\u102D\u102F\u1037\u1015\u1031\u1038\u101B\u102F\u1036\u101E\u102C \u1016\u103C\u1005\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { qEn: 'How many devices can I use?', qMy: 'Device \u1018\u101A\u103A\u1014\u103E\u1005\u103A\u1001\u102F \u101E\u102F\u1036\u1038\u101C\u102D\u102F\u1037\u101B\u101C\u1032?', aEn: 'Depending on the plan, you can use 1 to 5 devices simultaneously \u2014 Phone, Tablet, PC, Laptop, etc.', aMy: 'Plan \u1015\u1031\u102B\u103A\u1019\u1030\u1010\u100A\u103A\u1015\u103C\u102E\u1038 Device 1 \u1001\u102F\u1019\u103E 5 \u1001\u102F\u1021\u1011\u102D \u1010\u1005\u103A\u1015\u103C\u102D\u102F\u1004\u103A\u1014\u1000\u103A \u1021\u101E\u102F\u1036\u1038\u1015\u103C\u102F\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B Phone, Tablet, PC, Laptop \u1005\u101E\u100A\u103A\u1016\u103C\u1004\u103A\u1037 \u1001\u103B\u102D\u1010\u103A\u1006\u1000\u103A\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { qEn: 'Which protocol is best?', qMy: 'Protocol \u1018\u101A\u103A\u101F\u102C \u1021\u1000\u1031\u102C\u1004\u103A\u1038\u1006\u102F\u1036\u1038\u101C\u1032?', aEn: 'Trojan protocol works best for all ISPs. However VLESS and VMess can also work well depending on your ISP. You can exchange protocol for free via the Bot.', aMy: 'Trojan protocol \u101E\u100A\u103A ISP \u1021\u102C\u1038\u101C\u102F\u1036\u1038\u1021\u1010\u103D\u1000\u103A \u1021\u1000\u1031\u102C\u1004\u103A\u1038\u1006\u102F\u1036\u1038 \u1016\u103C\u1005\u103A\u1015\u102B\u101E\u100A\u103A\u104B \u101E\u102D\u102F\u1037\u101E\u1031\u102C\u103A ISP \u1015\u1031\u102B\u103A\u1019\u1030\u1010\u100A\u103A\u1015\u103C\u102E\u1038 VLESS, VMess \u1010\u102D\u102F\u1037\u101C\u100A\u103A\u1038 \u1000\u1031\u102C\u1004\u103A\u1038\u1019\u103D\u1014\u103A\u1015\u102B\u101E\u100A\u103A\u104B Bot \u1019\u103E Protocol \u1015\u103C\u1031\u102C\u1004\u103A\u1038\u101C\u1032\u1001\u103C\u1004\u103A\u1038 (Exchange Key) \u1000\u102D\u102F \u1021\u1001\u1019\u1032\u1037 \u101C\u102F\u1015\u103A\u1006\u1031\u102C\u1004\u103A\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
  { qEn: 'What if my key expires?', qMy: 'Key \u101E\u1000\u103A\u1010\u1019\u103A\u1038\u1000\u102F\u1014\u103A\u101B\u1004\u103A \u1018\u101A\u103A\u101C\u102D\u102F\u101C\u102F\u1015\u103A\u101B\u1019\u101C\u1032?', aEn: 'You can buy a new key through the Bot. Press "Buy VPN Key" and choose your plan.', aMy: 'Key \u101E\u1000\u103A\u1010\u1019\u103A\u1038\u1000\u102F\u1014\u103A\u101B\u1004\u103A Bot \u1019\u103E\u1010\u1006\u1004\u103A\u1037 Key \u1021\u101E\u1005\u103A \u1011\u1015\u103A\u101D\u101A\u103A\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B Bot \u1011\u1032\u101B\u103E\u102D "\uD83D\uDC8E Buy VPN Key" \u1000\u102D\u102F \u1014\u103E\u102D\u1015\u103A\u1015\u103C\u102E\u1038 Plan \u101B\u103D\u1031\u1038\u1001\u103B\u101A\u103A\u1015\u102B\u104B' },
  { qEn: 'Is there a Referral Program?', qMy: 'Referral Program \u101B\u103E\u102D\u1015\u102B\u101E\u101C\u102C\u1038?', aEn: 'Yes! Refer 5 friends who purchase and use the service to get a free 1-month VPN Key. Get your referral link from the Referral menu in the Bot.', aMy: '\u101B\u103E\u102D\u1015\u102B\u1010\u101A\u103A! \u101E\u1030\u1004\u101A\u103A\u1001\u103B\u1004\u103A\u1038 5 \u101A\u1031\u102C\u1000\u103A Refer \u101C\u102F\u1015\u103A\u1015\u103C\u102E\u1038 \u101D\u101A\u103A\u101A\u1030\u1021\u101E\u102F\u1036\u1038\u1015\u103C\u102F\u101B\u1004\u103A Free 1 Month VPN Key \u101B\u101B\u103E\u102D\u1015\u102B\u1019\u100A\u103A\u104B Bot \u1011\u1032\u101B\u103E\u102D "\uD83D\uDC65 Referral" menu \u1019\u103E \u101E\u1004\u103A\u1037 Referral Link \u101B\u101A\u1030\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u101E\u100A\u103A\u104B' },
];

/* Intersection Observer hook for fade-in */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vpn-visible'); } }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    el.querySelectorAll('.vpn-fade').forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* Counter animation component */
function AnimCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !animated.current) {
          animated.current = true;
          const start = performance.now();
          const duration = 2000;
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.floor(target * eased));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-purple-400 via-cyan-300 to-cyan-400 bg-clip-text text-transparent">
      {val.toLocaleString()}{suffix}
    </div>
  );
}

/* ======== MAIN PAGE ======== */
interface LiveServerHealth {
  id: string;
  name: string;
  flag: string;
  online: boolean;
  latencyMs: number | null;
}

export default function VPNPage() {
  const { t, lang: language } = useLanguage();
  const router = useRouter();
  const [activeDevice, setActiveDevice] = useState(3);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [appStore, setAppStore] = useState<'playstore' | 'appstore'>('playstore');
  const deviceTabsRef = useRef<HTMLDivElement>(null);
  const [liveServers, setLiveServers] = useState<LiveServerHealth[]>(
    defaultServers.map((s) => ({ id: s.id, name: s.name, flag: s.flag, online: s.online, latencyMs: null }))
  );

  // Canonical server list ref — NEVER shrinks, only grows.
  // This prevents servers from "disappearing" due to stale health cache or race conditions.
  const serverListRef = useRef<LiveServerHealth[]>(
    defaultServers.map((s) => ({ id: s.id, name: s.name, flag: s.flag, online: s.online, latencyMs: null }))
  );

  const wrapRef = useFadeIn();
  const onlineServers = liveServers.filter((server) => server.online);

  // Fetch dynamic server list from DB, then overlay health data.
  // Key invariant: servers NEVER disappear from the list once loaded.
  // Admin-enabled servers are always shown; health only updates online/latency status.
  useEffect(() => {
    let cancelled = false;

    // Helper: merge health data ON TOP of the canonical server list ref.
    // This guarantees we NEVER lose servers — health can only add or update, never remove.
    function mergeHealthIntoRef(healthServers: Array<{ id: string; name: string; flag: string; online: boolean; latencyMs?: number | null }>) {
      const healthMap = new Map<string, { name: string; flag: string; online: boolean; latencyMs: number | null }>();
      for (const h of healthServers) {
        healthMap.set(h.id, { name: h.name, flag: h.flag, online: h.online, latencyMs: h.latencyMs ?? null });
      }
      const base = serverListRef.current;
      const existingIds = new Set(base.map((s) => s.id));
      const merged = base.map((s) => {
        const h = healthMap.get(s.id);
        return h ? { ...s, online: h.online, latencyMs: h.latencyMs } : s;
      });
      // Add any servers from health that aren't already in the canonical list
      for (const h of healthServers) {
        if (!existingIds.has(h.id)) {
          const hd = healthMap.get(h.id)!;
          merged.push({ id: h.id, name: hd.name, flag: hd.flag, online: hd.online, latencyMs: hd.latencyMs });
        }
      }
      serverListRef.current = merged;
      return merged;
    }

    async function fetchServerList() {
      try {
        const res = await fetch('/api/vpn/servers');
        const data = await res.json();
        if (data.success && data.data?.servers?.length > 0) {
          const fetched: LiveServerHealth[] = data.data.servers.map((s: any) => ({
            id: s.id,
            name: s.name,
            flag: s.flag,
            online: s.online,
            latencyMs: null,
          }));
          // Merge fetched into ref (never shrink — keep any extra servers already there)
          const fetchedIds = new Set(fetched.map((s) => s.id));
          const existing = serverListRef.current.filter((s) => !fetchedIds.has(s.id));
          serverListRef.current = [...fetched, ...existing];
        }
      } catch {
        // Keep existing ref (fallback servers)
      }
    }

    async function fetchHealth() {
      try {
        const res = await fetch('/api/vpn/health');
        const data = await res.json();
        if (data.success && data.data?.servers?.length > 0) {
          return mergeHealthIntoRef(data.data.servers);
        }
      } catch {
        // Keep existing data
      }
      return serverListRef.current;
    }

    async function refresh() {
      await fetchServerList();
      if (cancelled) return;
      // Show server list immediately (all enabled, default "online")
      setLiveServers([...serverListRef.current]);
      // Then overlay health status
      const merged = await fetchHealth();
      if (!cancelled) {
        setLiveServers([...merged]);
      }
    }

    refresh();

    // Periodically refresh BOTH server list AND health (not just health)
    const interval = setInterval(() => {
      if (!cancelled) refresh();
    }, 60_000);

    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const monthLabel = (m: number) => {
    if (m === 12) return '12 Months';
    return `${m} Month${m > 1 ? 's' : ''}`;
  };

  const perLabel = (devices: number, m: number) => {
    const dur = m === 12 ? '1 Year' : monthLabel(m);
    return `${devices} Device${devices > 1 ? 's' : ''} / ${dur}`;
  };

  const pricingCard = (p: typeof pricing[1][0], i: number, extraClass = '') => {
    // Calculate per-month cost and savings
    const priceNum = parseInt(p.price.replace(/,/g, ''));
    const monthlyRate = pricing[activeDevice][0]; // 1month price for this device count
    const monthlyNum = parseInt(monthlyRate.price.replace(/,/g, ''));
    const fullPrice = monthlyNum * p.months;
    const saved = fullPrice - priceNum;
    const savedPct = p.months > 1 ? Math.round((saved / fullPrice) * 100) : 0;
    const perMonth = Math.round(priceNum / p.months).toLocaleString();

    const isPopular = !!p.popular;
    const isBestValue = p.months === 12;

    // Badge config
    const badge = isPopular
      ? { text: '\u2B50 Most Popular', gradient: 'from-purple-600 to-cyan-500' }
      : isBestValue
        ? { text: '\uD83D\uDCA0 Best Value', gradient: 'from-amber-500 to-orange-500' }
        : null;

    return (
      <div key={`${activeDevice}-${p.months}`}
        className={`group flex flex-col rounded-2xl transition-all duration-300 hover:-translate-y-2 relative overflow-hidden ${
          isPopular
            ? 'bg-gradient-to-b from-purple-900/40 to-[#12122a] border-2 border-purple-500 shadow-[0_0_50px_rgba(108,92,231,0.2)] scale-[1.02]'
            : isBestValue
              ? 'bg-gradient-to-b from-amber-900/20 to-[#12122a] border-2 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.1)]'
              : 'bg-[#12122a] border border-purple-500/15 hover:border-purple-500/40 hover:shadow-[0_0_40px_rgba(108,92,231,0.1)]'
        } ${extraClass}`}
        style={{ animation: 'vpn-fadeInUp 0.4s ease forwards', animationDelay: `${i * 0.06}s` }}>

        {/* Top accent line */}
        <div className={`h-1 w-full ${isPopular ? 'bg-gradient-to-r from-purple-600 via-cyan-400 to-purple-600' : isBestValue ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500' : 'bg-gradient-to-r from-purple-600/30 to-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity'}`} />

        {/* Badge */}
        {badge && (
          <div className="flex justify-center -mt-px">
            <div className={`bg-gradient-to-r ${badge.gradient} text-white text-[10px] sm:text-xs font-bold px-4 py-1 rounded-b-lg shadow-lg`}>
              {badge.text}
            </div>
          </div>
        )}

        {/* Savings ribbon for multi-month */}
        {savedPct > 0 && (
          <div className="absolute top-3 -right-8 rotate-45 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[9px] font-bold px-8 py-0.5 shadow-lg">
            {savedPct}% OFF
          </div>
        )}

        <div className="p-5 sm:p-7 flex flex-col flex-1">
          {/* Duration label */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{p.months === 1 ? '\u23F1' : p.months <= 5 ? '\uD83D\uDCC5' : p.months <= 9 ? '\uD83D\uDD25' : '\uD83D\uDC8E'}</span>
            <span className={`text-sm sm:text-base font-bold ${isPopular ? 'text-purple-300' : isBestValue ? 'text-amber-300' : 'text-gray-300'}`}>
              {monthLabel(p.months)}
            </span>
          </div>

          {/* Price */}
          <div className="mb-1">
            <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{p.price}</span>
            <span className="text-sm sm:text-base font-medium text-gray-500 ml-1.5">Ks</span>
          </div>

          {/* Per month breakdown */}
          {p.months > 1 && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">{perMonth} Ks / month</span>
              <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Save {saved.toLocaleString()} Ks</span>
            </div>
          )}

          <div className="text-[11px] text-gray-600 mb-4 sm:mb-5">{perLabel(activeDevice, p.months)}</div>

          {/* Divider */}
          <div className={`h-px mb-4 sm:mb-5 ${isPopular ? 'bg-purple-500/20' : 'bg-white/5'}`} />

          {/* Features */}
          <ul className="space-y-2 sm:space-y-2.5 mb-6 sm:mb-7 flex-1">
            {[
              { icon: '\u267E\uFE0F', text: 'Unlimited Data' },
              { icon: '\uD83C\uDF10', text: 'All Servers Access' },
              { icon: '\uD83D\uDD12', text: 'Multi-Protocol' },
              ...(activeDevice > 1 ? [{ icon: '\uD83D\uDCF1', text: `${activeDevice} Devices` }] : []),
              { icon: '\u2728', text: '24/7 Support' },
            ].map((feat) => (
              <li key={feat.text} className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-400">
                <span className="text-xs flex-shrink-0">{feat.icon}</span>
                {feat.text}
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <button
            onClick={() => {
              if (!selectedServer) {
                document.getElementById('servers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
              }
              router.push(`/vpn/order?devices=${activeDevice}&months=${p.months}&server=${selectedServer}`);
            }}
            className={`w-full flex items-center justify-center gap-2 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold transition-all duration-200 ${
              isPopular
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-[0_4px_24px_rgba(108,92,231,0.35)] hover:shadow-[0_8px_32px_rgba(108,92,231,0.5)] hover:-translate-y-0.5 active:scale-[0.98]'
                : isBestValue
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_4px_24px_rgba(245,158,11,0.25)] hover:shadow-[0_8px_32px_rgba(245,158,11,0.4)] hover:-translate-y-0.5 active:scale-[0.98]'
                  : 'border border-purple-500/25 text-white hover:bg-purple-500/10 hover:border-purple-500 hover:-translate-y-0.5 active:scale-[0.98]'
            }`}
          >
            {!selectedServer ? (language === 'en' ? '\uD83D\uDC46 Select Server' : 'Server ရွေးပါ') : `${t('vpn.landing.buyNow')} \u2192`}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div ref={wrapRef} className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(108,92,231,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(108,92,231,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="fixed -top-52 -right-52 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.07] pointer-events-none z-0 bg-purple-600" />
      <div className="fixed -bottom-52 -left-52 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.07] pointer-events-none z-0 bg-cyan-500" />

      {/* ======== HERO ======== */}
      <section className="pt-10 sm:pt-12 pb-10 sm:pb-16 relative z-[1] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start">
            {/* Text */}
            <div className="text-center lg:text-left relative z-10">
              <div className="vpn-fade inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs sm:text-sm text-purple-300 mb-4 sm:mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                All servers online
              </div>

              <h1 className="vpn-fade text-3xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.15] tracking-tight mb-4 sm:mb-6">
                Safe &amp; Fast<br />
                <span className="bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">Premium VPN</span><br />
                Service
              </h1>

              <p className="vpn-fade text-sm sm:text-lg text-gray-400 max-w-xl mb-6 sm:mb-8 leading-relaxed mx-auto lg:mx-0">
                {t('vpn.landing.heroDescription')}
              </p>

              <div className="vpn-fade flex flex-col sm:flex-row gap-2.5 justify-center lg:justify-start mb-6 sm:mb-10">
                <a href="https://t.me/BurmeseDigitalStore_bot" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 shadow-[0_4px_20px_rgba(108,92,231,0.3)] hover:shadow-[0_8px_30px_rgba(108,92,231,0.4)] hover:-translate-y-0.5 transition-all">
                  {t('vpn.landing.buyViaTelegramBot')}
                </a>
                <a href="#pricing"
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500 hover:-translate-y-0.5 transition-all">
                  {t('vpn.landing.viewPricing')}
                </a>
              </div>

              {/* Stats */}
              <div className="vpn-fade hidden sm:flex justify-center lg:justify-start gap-8 sm:gap-12 pt-8 border-t border-purple-500/20">
                <div>
                  <AnimCounter target={500} suffix="+" />
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Active Users</div>
                </div>
                <div>
                  <AnimCounter target={liveServers.length} />
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Server Locations</div>
                </div>
                <div>
                  <AnimCounter target={99} suffix="%" />
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Uptime</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Globe visual (decorative only, removed from layout flow) */}
        <div className="vpn-fade pointer-events-none hidden lg:flex absolute right-[8%] top-1/2 -translate-y-1/2 z-0">
          <div className="relative w-80 h-80 xl:w-96 xl:h-96 opacity-90">
            <div
              className="absolute inset-0 rounded-full border border-purple-500/15 animate-[vpn-float_6s_ease-in-out_infinite]"
              style={{ background: 'radial-gradient(circle at 30% 30%, rgba(108,92,231,0.2), transparent 60%), radial-gradient(circle at 70% 70%, rgba(0,206,201,0.15), transparent 60%)', boxShadow: '0 0 40px rgba(108,92,231,0.15)' }}
            />
            <div className="absolute -inset-[10%] rounded-full border border-purple-500/10 animate-[vpn-spin_20s_linear_infinite]" />
            <div className="absolute -inset-[20%] rounded-full border border-purple-500/10 animate-[vpn-spin_30s_linear_infinite_reverse]" />
            <div className="absolute w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_20px_rgba(108,92,231,0.5)] animate-[vpn-pulse-node_3s_ease-in-out_infinite] top-[15%] left-[20%]" />
            <div className="absolute w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_20px_rgba(108,92,231,0.5)] animate-[vpn-pulse-node_3s_ease-in-out_infinite] top-[30%] right-[10%]" style={{ animationDelay: '0.5s' }} />
            <div className="absolute w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_20px_rgba(108,92,231,0.5)] animate-[vpn-pulse-node_3s_ease-in-out_infinite] bottom-[25%] left-[15%]" style={{ animationDelay: '1s' }} />
            <div className="absolute w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(0,206,201,0.5)] animate-[vpn-pulse-node_3s_ease-in-out_infinite] bottom-[10%] right-[25%]" style={{ animationDelay: '1.5s' }} />
            <div className="absolute w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(0,206,201,0.5)] animate-[vpn-pulse-node_3s_ease-in-out_infinite] top-[50%] left-[50%]" style={{ animationDelay: '0.8s' }} />
          </div>
        </div>
      </section>

      {/* ======== FEATURES ======== */}
      <section className="py-12 sm:py-20 relative z-[1]" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vpn-fade text-center mb-8 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-300 mb-4">{'\u2728'} Features</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">
              {t('vpn.landing.whyChooseTitle')}
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">{t('vpn.landing.whyChooseSubtitle')}</p>
          </div>
          {/* Mobile: carousel */}
          <MobileCarousel className="sm:hidden -mx-4 px-4">
            {features.map((f, i) => (
              <div key={i} className="group bg-[#12122a] border border-purple-500/15 rounded-2xl p-5 relative overflow-hidden h-full">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-purple-600 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-2xl mb-4">{f.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{language === 'en' ? f.titleEn : f.titleMy}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{language === 'en' ? f.descEn : f.descMy}</p>
              </div>
            ))}
          </MobileCarousel>
          {/* Desktop: grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="vpn-fade group bg-[#12122a] border border-purple-500/15 rounded-2xl p-8 transition-all duration-300 hover:bg-[#1a1a3e] hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(108,92,231,0.15)] relative overflow-hidden"
                style={{ transitionDelay: `${(i % 3) * 0.1}s` }}>
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-purple-600 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-14 h-14 bg-purple-500/10 rounded-[14px] flex items-center justify-center text-2xl mb-5">{f.icon}</div>
                <h3 className="text-lg font-bold text-white mb-3">{language === 'en' ? f.titleEn : f.titleMy}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{language === 'en' ? f.descEn : f.descMy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== SERVERS ======== */}
      <section className="py-20 relative z-[1] bg-[rgba(18,18,42,0.5)]" id="servers">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vpn-fade text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-300 mb-4">{'\uD83C\uDF0D'} Servers</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Global Server Locations</h2>
            <p className="text-gray-400 max-w-xl mx-auto">{t('vpn.landing.selectFastStableServers')}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {liveServers.map((s, i) => (
              <button key={i}
                disabled={!s.online}
                onClick={() => {
                  setSelectedServer(s.id);
                  setTimeout(() => {
                    deviceTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }}
                className={`vpn-fade bg-[#12122a] border rounded-2xl p-7 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(108,92,231,0.15)] ${selectedServer === s.id ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-[0_0_40px_rgba(108,92,231,0.2)]' : s.online ? 'border-purple-500/15 hover:border-purple-500' : 'border-red-500/15 hover:border-red-500/40 opacity-70 cursor-not-allowed'}`}
                style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="text-5xl mb-3">{s.flag}</div>
                <div className="font-bold text-white mb-2">{s.name}</div>
                <div className={`inline-flex items-center gap-1.5 text-sm ${s.online ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${s.online ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  {s.online ? 'Online' : 'Offline'}
                </div>
                {s.online && s.latencyMs !== null && (
                  <div className="text-xs text-gray-500 mt-1">{s.latencyMs}ms</div>
                )}
                {selectedServer === s.id && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full">
                    <span>✓</span> Selected
                  </div>
                )}
              </button>
            ))}
          </div>
          {!selectedServer && (
            <p className="vpn-fade text-center text-gray-500 text-sm mt-6 animate-pulse">
              👆 {language === 'en' ? 'Click a server to continue' : 'Server တစ်ခုကို ရွေးပါ'}
            </p>
          )}
        </div>
      </section>

      {/* ======== PRICING ======== */}
      <section className="py-14 sm:py-20 relative z-[1]" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vpn-fade text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-300 mb-4">{'\uD83D\uDC8E'} Pricing</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              {t('vpn.landing.affordablePricing')}
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">{t('vpn.landing.longerCheaper')}</p>
          </div>

          {/* Selected server indicator */}
          {selectedServer && (
            <div className="vpn-fade flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm">
                <span className="text-lg">{liveServers.find(s => s.id === selectedServer)?.flag}</span>
                <span className="text-purple-300 font-semibold">{liveServers.find(s => s.id === selectedServer)?.name}</span>
                <button onClick={() => setSelectedServer(null)} className="ml-1 text-gray-500 hover:text-white transition-colors">✕</button>
              </div>
            </div>
          )}

          {/* Device tabs */}
          <div ref={deviceTabsRef} className="vpn-fade flex justify-center gap-2 mb-8 sm:mb-12 flex-wrap">
            {[1, 2, 3, 4, 5].map((d) => (
              <button key={d} onClick={() => setActiveDevice(d)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all border ${activeDevice === d ? 'bg-purple-600 text-white border-purple-600' : 'bg-[#12122a] text-gray-400 border-purple-500/15 hover:bg-purple-600 hover:text-white hover:border-purple-600'}`}>
                {'\uD83D\uDCF1'} {d} Device{d > 1 ? 's' : ''}
              </button>
            ))}
          </div>

          {/* Cards - Mobile carousel */}
          <MobileCarousel key={activeDevice} className="sm:hidden -mx-4 px-4">
            {pricing[activeDevice].map((p, i) => pricingCard(p, i))}
          </MobileCarousel>
          {/* Cards - Desktop grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {pricing[activeDevice].map((p, i) => pricingCard(p, i))}
          </div>

          <p className="vpn-fade text-center text-gray-500 text-sm mt-8">
            {'\uD83D\uDCB3'} Payment Methods: KBZPay, WavePay, AYA Pay, UAB Pay
          </p>
        </div>
      </section>

      {/* ======== HOW IT WORKS ======== */}
      <section className="py-20 relative z-[1] bg-[rgba(18,18,42,0.5)]" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vpn-fade text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-300 mb-4">{'\uD83D\uDCCB'} How It Works</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">{t('vpn.landing.howToBuyTitle')}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">{t('vpn.landing.howToBuySubtitle')}</p>
          </div>
          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-10 left-[15%] right-[15%] h-0.5 bg-purple-500/15" />
            {stepsData.map((s, i) => (
              <div key={i} className="vpn-fade text-center relative z-[1]" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="w-20 h-20 mx-auto mb-5 rounded-full border-2 border-purple-500/15 flex items-center justify-center bg-[#12122a] hover:border-purple-500 hover:shadow-[0_0_40px_rgba(108,92,231,0.15)] transition-all">
                  <span className="text-3xl font-extrabold bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">{i + 1}</span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{language === 'en' ? s.titleEn : s.titleMy}</h3>
                <p className="text-sm text-gray-400">{language === 'en' ? s.descEn : s.descMy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== COMPATIBLE APPS ======== */}
      <section className="py-20 relative z-[1]" id="apps">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vpn-fade text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-300 mb-4">{'\uD83D\uDCF2'} Compatible Apps</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">{t('vpn.landing.compatibleAppsTitle')}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">{t('vpn.landing.compatibleAppsSubtitle')}</p>
          </div>

          {/* Store tabs */}
          <div className="vpn-fade flex justify-center gap-3 mb-10">
            <button onClick={() => setAppStore('playstore')}
              className={`flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold transition-all border ${appStore === 'playstore' ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white border-transparent' : 'bg-[#12122a] text-gray-400 border-purple-500/15 hover:border-purple-300 hover:text-white'}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.396 12l2.302-3.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/></svg>
              Play Store
            </button>
            <button onClick={() => setAppStore('appstore')}
              className={`flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold transition-all border ${appStore === 'appstore' ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white border-transparent' : 'bg-[#12122a] text-gray-400 border-purple-500/15 hover:border-purple-300 hover:text-white'}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              App Store
            </button>
          </div>

          {/* App cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {(appStore === 'playstore' ? playStoreApps : appStoreApps).map((app, i) => (
              <a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer"
                className="bg-[#12122a] border border-purple-500/15 rounded-2xl p-6 text-center transition-all duration-300 hover:border-purple-500 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(108,92,231,0.15)] flex flex-col items-center gap-1"
                style={{ animation: 'vpn-fadeInUp 0.4s ease forwards', animationDelay: `${i * 0.05}s` }}>
                <div className="text-4xl mb-2">{app.icon}</div>
                <h4 className="text-sm font-bold text-white">{app.name}</h4>
                <p className="text-xs text-gray-500 mb-2">{app.platform}</p>
                <span className={`text-[0.65rem] font-semibold px-2.5 py-0.5 rounded-full ${appStore === 'playstore' ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'}`}>
                  {appStore === 'playstore' ? 'Play Store' : 'App Store'}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ======== FAQ ======== */}
      <section className="py-20 relative z-[1] bg-[rgba(18,18,42,0.5)]" id="faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vpn-fade text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-300 mb-4">{'\u2753'} FAQ</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">{t('vpn.landing.faqTitle')}</h2>
          </div>
          <div className="space-y-3">
            {faqData.map((faq, i) => (
              <div key={i} className={`bg-[#12122a] border rounded-2xl overflow-hidden transition-all ${openFaq === i ? 'border-purple-500' : 'border-purple-500/15 hover:border-purple-500'}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left font-semibold text-white hover:text-purple-300 transition-colors">
                  <span>{language === 'en' ? faq.qEn : faq.qMy}</span>
                  <span className={`text-purple-300 text-lg transition-transform duration-300 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-60' : 'max-h-0'}`}>
                  <p className="px-6 pb-5 text-sm text-gray-400 leading-relaxed">{language === 'en' ? faq.aEn : faq.aMy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== CTA ======== */}
      <section className="py-20 relative z-[1]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vpn-fade bg-[#12122a] border border-purple-500/15 rounded-2xl p-12 sm:p-20 text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-purple-600 to-cyan-400" />
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">{t('vpn.landing.getVpnKeyNow')}</h2>
            <p className="text-gray-400 max-w-lg mx-auto mb-8">
              {t('vpn.landing.getVpnKeyNowSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="https://t.me/BurmeseDigitalStore_bot" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 shadow-[0_4px_20px_rgba(108,92,231,0.3)] hover:shadow-[0_8px_30px_rgba(108,92,231,0.4)] hover:-translate-y-0.5 transition-all">
                {t('vpn.landing.openTelegramBot')}
              </a>
              <a href="https://t.me/BurmeseDigitalStore" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold text-white border border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500 hover:-translate-y-0.5 transition-all">
                {t('vpn.landing.joinChannel')}
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
