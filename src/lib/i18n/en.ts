// ==========================================
// English Translation Dictionary
// Burmese Digital Store
// ==========================================

const en = {
  // Navigation
  nav: {
    home: 'Home',
    shop: 'Shop',
    vpn: 'VPN',
    contact: 'Contact',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    logOut: 'Log Out',
    myAccount: 'My Account',
    myOrders: 'My Orders',
    adminPanel: 'Admin Panel',
    profile: 'Profile',
    cart: 'Cart',
    switchLanguage: 'Switch to Myanmar',
    mainNavigation: 'Main navigation',
    userMenu: 'User menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    skipToContent: 'Skip to main content',
  },

  // Auth
  auth: {
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    name: 'Full Name',
    phone: 'Phone Number',
    forgotPassword: 'Forgot Password?',
    resetPassword: 'Reset Password',
    signInWithGoogle: 'Sign in with Google',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    loginSuccess: 'Login successful!',
    registerSuccess: 'Registration successful!',
    logoutSuccess: 'Logged out successfully',
    deleteAccount: 'Delete Account',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
  },

  // Shop
  shop: {
    title: 'Digital Shop',
    search: 'Search products...',
    allCategories: 'All Categories',
    sortBy: 'Sort by',
    newest: 'Newest',
    priceLowHigh: 'Price: Low to High',
    priceHighLow: 'Price: High to Low',
    nameAZ: 'Name: A-Z',
    noProducts: 'No products found',
    clearFilters: 'Clear all filters',
    viewDetails: 'View Details',
    addToCart: 'Add to Cart',
    buyNow: 'Buy Now',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    featured: 'Featured',
    priceRange: 'Price Range',
  },

  // Product
  product: {
    description: 'Description',
    features: 'Features',
    category: 'Category',
    price: 'Price',
    stock: 'Stock',
    quantity: 'Quantity',
  },

  // Cart
  cart: {
    title: 'Shopping Cart',
    empty: 'Your cart is empty',
    continueShopping: 'Continue Shopping',
    subtotal: 'Subtotal',
    discount: 'Discount',
    total: 'Total',
    applyCoupon: 'Apply Coupon',
    couponCode: 'Coupon Code',
    checkout: 'Proceed to Checkout',
    remove: 'Remove',
    items: 'items',
  },

  // Orders
  order: {
    title: 'My Orders',
    orderNumber: 'Order Number',
    date: 'Date',
    status: 'Status',
    total: 'Total',
    noOrders: 'No orders yet',
    pending: 'Pending',
    verifying: 'Verifying',
    completed: 'Completed',
    rejected: 'Rejected',
    refunded: 'Refunded',
    paymentMethod: 'Payment Method',
    transactionId: 'Transaction ID',
    viewDetails: 'View Details',
    deliveredKeys: 'Delivered Keys',
    uploadScreenshot: 'Upload Payment Screenshot',
  },

  // VPN
  vpn: {
    title: 'VPN Plans',
    subtitle: 'Fast & Secure VPN Service',
    devices: 'Devices',
    months: 'Months',
    selectServer: 'Select Server',
    selectPlan: 'Select Plan',
    freeTrial: 'Free Trial',
    freeTrialDesc: '3GB / 72 Hours / 1 Device',
    subscriptionLink: 'Subscription Link',
    configLink: 'Config Link',
    expiresAt: 'Expires At',
    online: 'Online',
    offline: 'Offline',
    myKeys: 'My VPN Keys',
  },

  // Contact
  contact: {
    title: 'Contact Us',
    subtitle: 'Get in touch with us',
    telegram: 'Telegram',
    facebook: 'Facebook',
    viber: 'Viber',
  },

  // Account
  account: {
    title: 'My Account',
    editProfile: 'Edit Profile',
    notifications: 'Notifications',
    vpnKeys: 'VPN Keys',
    orders: 'Orders',
    totalOrders: 'Total Orders',
    activeVpn: 'Active VPN',
    memberSince: 'Member Since',
  },

  // Common
  common: {
    loading: 'Loading...',
    error: 'Something went wrong',
    retry: 'Retry',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    close: 'Close',
    copy: 'Copy',
    copied: 'Copied!',
    submit: 'Submit',
    ks: 'Ks',
    noData: 'No data available',
    pageNotFound: 'Page Not Found',
    goHome: 'Go Home',
  },

  // Admin
  admin: {
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Orders',
    users: 'Users',
    settings: 'Settings',
    analytics: 'Analytics',
    activity: 'Activity Log',
    coupons: 'Coupons',
    servers: 'VPN Servers',
    vpnKeys: 'VPN Keys',
    export: 'Export',
    approve: 'Approve',
    reject: 'Reject',
    rejectReason: 'Reject Reason',
  },
} as const;

// Recursively convert literal string types to `string` so translations
// only need to match the *shape*, not the exact English values.
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type TranslationKeys = DeepString<typeof en>;
export default en;
