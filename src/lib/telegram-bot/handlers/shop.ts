import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Order from '@/models/Order';
import { sendMessage, editMessageText } from '../api';
import { MSG } from '../messages';
import { markup, mainMenuKeyboard } from '../keyboards';
import { setSession, getSession } from '../session';
import { createLogger } from '@/lib/logger';
import { findOrCreateTelegramUser } from './commands';

const log = createLogger({ module: 'bot-shop' });

const CATEGORIES: Record<string, string> = {
  vps: '☁️ Cloud VPS',
  vpn: '🌐 VPN',
  streaming: '🎬 Streaming',
  gaming: '🎮 Gaming',
  software: '💻 Software',
  'gift-card': '💳 Gift Card',
  other: '📦 Other',
};

// 1. Show Categories
export async function handleShopCategories(chatId: number, messageId?: number): Promise<void> {
  const categoryEntries = Object.entries(CATEGORIES);
  const keyboard = [];
  
  for (let i = 0; i < categoryEntries.length; i += 2) {
    const row = [];
    row.push({ text: categoryEntries[i][1], callback_data: 'shop_cat_' + categoryEntries[i][0] });
    if (i + 1 < categoryEntries.length) {
      row.push({ text: categoryEntries[i + 1][1], callback_data: 'shop_cat_' + categoryEntries[i + 1][0] });
    }
    keyboard.push(row);
  }
  
  keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);

  const text = '🌟 <b>Categories (Category များ)</b>\n\nမိမိဝယ်ယူလိုသော Category ကိုရွေးချယ်ပါ 👇';
  if (messageId) {
    await editMessageText(chatId, messageId, text, { replyMarkup: markup(keyboard) });
  } else {
    await sendMessage(chatId, text, { replyMarkup: markup(keyboard) });
  }
}

// 2. Show Products in Category
export async function handleShopCategory(chatId: number, category: string, messageId: number): Promise<void> {
  if (category === 'vps') {
    const { handleVPSCategory } = await import('./vps');
    const ctx = {
      update: {},
      chatId: chatId,
      session: {},
      fromUser: { id: chatId, is_bot: false, first_name: 'User' },
      answerCbQuery: async () => {},
      messageId: messageId
    } as any;
    return handleVPSCategory(ctx);
  }

  // Handle VPN separately inside the main router or here if doing redirect
  if (category === 'vpn') {
    const { handleBuyKey } = await import('./purchase');
    return handleBuyKey(chatId, chatId, messageId);
  }

  try {
    await connectDB();
    const products = await Product.find({ category, active: true, purchaseDisabled: false }).lean() as any[];

    if (!products || products.length === 0) {
      await editMessageText(chatId, messageId, '❌ ယခု Category တွင် Product မရှိသေးပါ။', {
        replyMarkup: markup([[{ text: '🔙 နောက်သို့', callback_data: 'shop_categories' }]])
      });
      return;
    }

    const keyboard = [];
    for(let i=0; i<products.length; i++) {
      const p = products[i];
      // Use 1 column for products to leave enough room to display the price and name fully without truncation
      keyboard.push([{ text: '🛍️ ' + p.name + ' - ' + p.price.toLocaleString() + ' Ks', callback_data: 'shop_prod_' + p._id.toString() }]);
    }
    keyboard.push([{ text: '🔙 နောက်သို့', callback_data: 'shop_categories' }]);

    const catName = CATEGORIES[category] || category;
    const text = '🛍️ <b>' + catName + ' Products</b>\n\nအောက်ပါ Product များမှရွေးချယ်ပါ 👇';
    await editMessageText(chatId, messageId, text, { replyMarkup: markup(keyboard) });
  } catch (error) {
    log.error('Error fetching shop category', { error });
    await sendMessage(chatId, MSG.error);
  }
}

// 3. Show Product Details
export async function handleShopProduct(chatId: number, productId: string, messageId: number): Promise<void> {
  try {
    await connectDB();
    const product = await Product.findById(productId).lean() as any;

    if (!product) {
      await editMessageText(chatId, messageId, '❌ Product မတွေ့ပါ', {
        replyMarkup: markup([[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]])
      });
      return;
    }

    const keyboard = [
      [{ text: '🛒 ချက်ချင်းဝယ်မည် (Buy Now)', callback_data: 'shop_buy_' + product._id.toString() }],
      [{ text: '🔙 နောက်သို့', callback_data: 'shop_cat_' + product.category }]
    ];

    const stockText = product.stock > 0 ? product.stock + ' ခု' : 'Out of stock ❌';
    const text = '📦 <b>' + product.name + '</b>\n\n' +
                 '📝 ' + (product.description || 'No description') + '\n\n' +
                 '💵 စျေးနှုန်း: <b>' + product.price.toLocaleString() + ' Ks</b>\n' +
                 '📦 Stock: <b>' + stockText + '</b>';

    if (product.stock <= 0) {
      keyboard.shift();
    }

    await editMessageText(chatId, messageId, text, { replyMarkup: markup(keyboard) });
  } catch (error) {
    log.error('Error fetching product details', { error });
    await sendMessage(chatId, MSG.error);
  }
}

// 4. Handle Buy Click
export async function handleShopBuy(chatId: number, userId: number, firstName: string, username: string | undefined, productId: string, messageId: number): Promise<void> {
  try {
    await connectDB();
    const product = await Product.findById(productId);
    if (!product || product.stock <= 0 || product.purchaseDisabled || !product.active) {
      await editMessageText(chatId, messageId, '❌ ယခု Product ဝယ်ယူ၍မရပါ။ (Out of stock သို့မဟုတ် ပိတ်ထားပါသည်)', {
        replyMarkup: markup([[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]])
      });
      return;
    }

    const user = await findOrCreateTelegramUser(userId, firstName, undefined, username);
    
    if (user.isBanned) {
      await sendMessage(chatId, MSG.banned + (user.banReason || 'No reason'));
      return;
    }

    const order = await Order.create({
      user: user._id,
      product: product._id,
      orderType: 'product',
      quantity: 1,
      totalAmount: product.price,
      paymentMethod: 'kpay',
      paymentScreenshot: 'pending',
      transactionId: 'BOT-P-' + Date.now(),
      status: 'pending',
      paymentExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const session = getSession(userId) || {};
    setSession(userId, {
      ...session,
      orderId: order._id.toString(),
      amount: product.price,
      waitingScreenshot: true,
    });

    const text = '🛒 <b>' + product.name + '</b> ဝယ်ယူရန် အောက်ပါအကောင့်သို့ ငွေလွှဲပေးပါ။\n\n' +
                 '💰 ကျသင့်ငွေ: <b>' + product.price.toLocaleString() + ' Ks</b>\n\n' +
                 '🏦 KPay: 09123456789 (U Mya)\n\n' +
                 '✅ ငွေလွှဲပြီးပါက Screenshot (ဓာတ်ပုံ) ကို ယခု Chat သို့ တိုက်ရိုက်ပို့ပေးပါ။';
                 
    await editMessageText(chatId, messageId, text, {
      replyMarkup: markup([[{ text: '❌ Cancel Order', callback_data: 'main_menu' }]])
    });
    
  } catch (error) {
    log.error('Error creating product bot order', { error });
    await sendMessage(chatId, MSG.error);
  }
}
