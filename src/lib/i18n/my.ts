// ==========================================
// Myanmar (Burmese) Translation Dictionary
// Burmese Digital Store
// ==========================================

import type { TranslationKeys } from './en';

const my: TranslationKeys = {
  // Navigation
  nav: {
    home: 'မူလ',
    shop: 'ဆိုင်',
    vpn: 'VPN',
    contact: 'ဆက်သွယ်ရန်',
    signIn: 'ဝင်မည်',
    signUp: 'အကောင့်ဖွင့်မည်',
    logOut: 'ထွက်မည်',
    myAccount: 'ကျွန်ုပ်အကောင့်',
    myOrders: 'ကျွန်ုပ်အော်ဒါများ',
    adminPanel: 'အက်ဒမင်',
    profile: 'ပရိုဖိုင်',
    cart: 'စျေးခြင်းတောင်း',
    switchLanguage: 'English သို့ပြောင်းရန်',
    mainNavigation: 'အဓိက navigation',
    userMenu: 'အသုံးပြုသူ menu',
    openMenu: 'Menu ဖွင့်ရန်',
    closeMenu: 'Menu ပိတ်ရန်',
    skipToContent: 'အကြောင်းအရာသို့ ကျော်ရန်',
  },

  // Auth
  auth: {
    login: 'ဝင်ရန်',
    register: 'အကောင့်ဖွင့်ရန်',
    email: 'အီးမေးလ်',
    password: 'စကားဝှက်',
    confirmPassword: 'စကားဝှက် အတည်ပြု',
    name: 'အမည်',
    phone: 'ဖုန်းနံပါတ်',
    forgotPassword: 'စကားဝှက် မေ့နေပါသလား?',
    resetPassword: 'စကားဝှက် ပြန်သတ်မှတ်ရန်',
    signInWithGoogle: 'Google ဖြင့်ဝင်ရန်',
    noAccount: 'အကောင့်မရှိသေးဘူးလား?',
    hasAccount: 'အကောင့်ရှိပြီးသားလား?',
    loginSuccess: 'အောင်မြင်စွာ ဝင်ရောက်ပြီးပါပြီ!',
    registerSuccess: 'အောင်မြင်စွာ အကောင့်ဖွင့်ပြီးပါပြီ!',
    logoutSuccess: 'အောင်မြင်စွာ ထွက်ပြီးပါပြီ',
    deleteAccount: 'အကောင့်ဖျက်ရန်',
    changePassword: 'စကားဝှက်ပြောင်းရန်',
    currentPassword: 'လက်ရှိ စကားဝှက်',
    newPassword: 'စကားဝှက်အသစ်',
  },

  // Shop
  shop: {
    title: 'ဒစ်ဂျစ်တယ် ဆိုင်',
    search: 'ပစ္စည်းရှာရန်...',
    allCategories: 'အမျိုးအစားအားလုံး',
    sortBy: 'စီရန်',
    newest: 'အသစ်ဆုံး',
    priceLowHigh: 'စျေးနှုန်း: နည်း→များ',
    priceHighLow: 'စျေးနှုန်း: များ→နည်း',
    nameAZ: 'အမည်: A-Z',
    noProducts: 'ပစ္စည်းမတွေ့ပါ',
    clearFilters: 'စစ်ထုတ်မှုများ ရှင်းရန်',
    viewDetails: 'အသေးစိတ်ကြည့်ရန်',
    addToCart: 'စျေးခြင်းထဲထည့်ရန်',
    buyNow: 'ယခုဝယ်ရန်',
    inStock: 'ရှိပါတယ်',
    outOfStock: 'ကုန်ပါပြီ',
    featured: 'အထူးအသားပေး',
    priceRange: 'စျေးနှုန်း အကွာအဝေး',
  },

  // Product
  product: {
    description: 'ဖော်ပြချက်',
    features: 'အင်္ဂါရပ်များ',
    category: 'အမျိုးအစား',
    price: 'စျေးနှုန်း',
    stock: 'လက်ကျန်',
    quantity: 'အရေအတွက်',
  },

  // Cart
  cart: {
    title: 'စျေးခြင်းတောင်း',
    empty: 'စျေးခြင်းတောင်း ဗလာဖြစ်နေပါတယ်',
    continueShopping: 'ဆက်ဝယ်ရန်',
    subtotal: 'စုစုပေါင်း',
    discount: 'လျှော့စျေး',
    total: 'ပေးဆောင်ရမည့်ပမာဏ',
    applyCoupon: 'ကူပွန်သုံးရန်',
    couponCode: 'ကူပွန်ကုဒ်',
    checkout: 'ငွေချေရန်',
    remove: 'ဖယ်ရှားရန်',
    items: 'ခု',
  },

  // Orders
  order: {
    title: 'ကျွန်ုပ်အော်ဒါများ',
    orderNumber: 'အော်ဒါနံပါတ်',
    date: 'ရက်စွဲ',
    status: 'အခြေအနေ',
    total: 'စုစုပေါင်း',
    noOrders: 'အော်ဒါ မရှိသေးပါ',
    pending: 'စောင့်ဆိုင်းဆဲ',
    verifying: 'စစ်ဆေးနေဆဲ',
    completed: 'ပြီးဆုံးပြီ',
    rejected: 'ငြင်းပယ်ပြီ',
    refunded: 'ပြန်အမ်းပြီ',
    paymentMethod: 'ငွေပေးချေနည်း',
    transactionId: 'ငွေလွှဲအမှတ်',
    viewDetails: 'အသေးစိတ်ကြည့်ရန်',
    deliveredKeys: 'ရရှိသော Keys',
    uploadScreenshot: 'ငွေလွှဲပြေစာ တင်ရန်',
  },

  // VPN
  vpn: {
    title: 'VPN Plans',
    subtitle: 'မြန်ဆန်ပြီး လုံခြုံသော VPN ဝန်ဆောင်မှု',
    devices: 'စက်အရေအတွက်',
    months: 'လ',
    selectServer: 'Server ရွေးရန်',
    selectPlan: 'Plan ရွေးရန်',
    freeTrial: 'အခမဲ့ စမ်းသုံးရန်',
    freeTrialDesc: '3GB / 72 နာရီ / စက် 1 လုံး',
    subscriptionLink: 'Subscription Link',
    configLink: 'Config Link',
    expiresAt: 'သက်တမ်းကုန်ရက်',
    online: 'အွန်လိုင်း',
    offline: 'အော့ဖ်လိုင်း',
    myKeys: 'ကျွန်ုပ် VPN Keys',
  },

  // Contact
  contact: {
    title: 'ဆက်သွယ်ရန်',
    subtitle: 'ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ',
    telegram: 'Telegram',
    facebook: 'Facebook',
    viber: 'Viber',
  },

  // Account
  account: {
    title: 'ကျွန်ုပ်အကောင့်',
    editProfile: 'ပရိုဖိုင် ပြင်ဆင်ရန်',
    notifications: 'အကြောင်းကြားချက်များ',
    vpnKeys: 'VPN Keys',
    orders: 'အော်ဒါများ',
    totalOrders: 'စုစုပေါင်း အော်ဒါ',
    activeVpn: 'အသုံးပြုဆဲ VPN',
    memberSince: 'အဖွဲ့ဝင်ဖြစ်သည့်ရက်',
  },

  // Common
  common: {
    loading: 'ခဏစောင့်ပါ...',
    error: 'တစ်ခုခု မှားသွားပါတယ်',
    retry: 'ပြန်လုပ်ရန်',
    save: 'သိမ်းရန်',
    cancel: 'ပယ်ဖျက်ရန်',
    delete: 'ဖျက်ရန်',
    edit: 'ပြင်ဆင်ရန်',
    confirm: 'အတည်ပြုရန်',
    back: 'နောက်သို့',
    next: 'ရှေ့သို့',
    previous: 'အရင်',
    close: 'ပိတ်ရန်',
    copy: 'ကူးရန်',
    copied: 'ကူးပြီး!',
    submit: 'တင်ရန်',
    ks: 'ကျပ်',
    noData: 'ဒေတာ မရှိပါ',
    pageNotFound: 'ဒီစာမျက်နှာ မတွေ့ပါ',
    goHome: 'ပင်မစာမျက်နှာသို့',
  },

  // Admin
  admin: {
    dashboard: 'Dashboard',
    products: 'ပစ္စည်းများ',
    orders: 'အော်ဒါများ',
    users: 'အသုံးပြုသူများ',
    settings: 'ဆက်တင်များ',
    analytics: 'ကိန်းဂဏန်းများ',
    activity: 'လုပ်ဆောင်ချက်မှတ်တမ်း',
    coupons: 'ကူပွန်များ',
    servers: 'VPN Servers',
    vpnKeys: 'VPN Keys',
    export: 'ထုတ်ယူရန်',
    approve: 'အတည်ပြုရန်',
    reject: 'ငြင်းပယ်ရန်',
    rejectReason: 'ငြင်းပယ်အကြောင်းရင်း',
  },
};

export default my;
