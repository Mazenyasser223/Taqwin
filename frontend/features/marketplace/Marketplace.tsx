import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  staggerContainer,
  itemVariants,
  buttonPress,
  snapTransition,
  useMotionPrefs,
} from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { MarketplaceVisual } from '../../3d/PageSpecificVisuals';
import marketplaceService from '../../services/marketplaceService';
import { useCartStore } from '../../store/useCartStore';
import type { Product } from '../../types';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1593094859027-e9623c44810a?q=80&w=400';

export const Marketplace: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const cart = useCartStore();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    marketplaceService.getProducts().then((res) => {
      if (!mounted) return;
      if (res.error) setError(res.error);
      else setProducts(res.data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCheckout = async () => {
    if (cart.items.length === 0) return;
    setCheckingOut(true);
    const res = await marketplaceService.createOrder({
      items: cart.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
    });
    setCheckingOut(false);
    if (res.error) {
      setToast(res.error);
    } else {
      setToast('Order placed! Track it from Orders.');
      cart.clear();
      setShowCart(false);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 relative">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={snapTransition} className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Kinetic Market</h1>
          <p className="text-muted mt-2">Gear and supplements verified for the Taqwin community.</p>
        </motion.div>

        <div className="relative z-10">
          <Magnetic>
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              onClick={() => setShowCart(true)}
              className="w-full sm:w-auto min-h-11 bg-surface/60 border border-border px-6 py-3 rounded-2xl flex items-center gap-3 font-black shadow-xl"
            >
              <span className="material-symbols-outlined text-primary">shopping_bag</span>
              Cart ({cart.count()})
            </motion.button>
          </Magnetic>
        </div>

        <div className="hidden lg:block absolute -top-10 right-0 w-64 h-64 pointer-events-none opacity-40">
          <MarketplaceVisual />
        </div>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm">{toast}</div>
      )}

      {loading && <div className="text-primary animate-pulse">{t('shop.loading')}</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
      {!loading && !error && products.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted">{t('shop.empty')}</div>
      )}

      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {products.map((product) => (
          <TiltCard key={product.id}>
            <motion.div variants={itemVariants} className="bg-surface border border-border rounded-[2.5rem] overflow-hidden group hover:border-primary transition-all flex flex-col h-full shadow-2xl">
              <div className="aspect-square relative overflow-hidden bg-elevated">
                <img
                  src={product.imageUrl || FALLBACK_IMG}
                  className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                  alt={product.name}
                />
                {!shouldSimplify && (
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                {product.stock > 0 && (
                  <div className="absolute top-6 left-6 bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    In Stock
                  </div>
                )}
              </div>

              <div className="p-8 flex flex-col flex-1 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-faint uppercase tracking-[0.2em]">{product.brand}</p>
                  <h3 className="text-xl font-black leading-tight group-hover:text-primary transition-colors">{product.name}</h3>
                  {product.description && <p className="text-sm text-muted line-clamp-2">{product.description}</p>}
                </div>

                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="text-2xl font-black tabular-nums">${product.price.toFixed(2)}</span>
                  <Magnetic strength={0.4}>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => {
                        cart.add(product);
                        setToast(`Added ${product.name}`);
                        setTimeout(() => setToast(null), 1500);
                      }}
                      className="size-14 bg-primary text-white rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-primary/30 group-hover:bg-accent group-hover:shadow-accent/30 transition-all duration-300"
                    >
                      <span className="material-symbols-outlined font-black">add_shopping_cart</span>
                    </motion.button>
                  </Magnetic>
                </div>
              </div>
            </motion.div>
          </TiltCard>
        ))}
      </motion.div>

      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-6 safe-bottom"
            onClick={() => setShowCart(false)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-6 max-h-[min(90dvh,85vh)] flex flex-col"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black">Your Cart</h3>
                <button onClick={() => setShowCart(false)} className="text-muted hover:text-foreground">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {cart.items.length === 0 ? (
                <div className="text-center py-12 text-muted">Your cart is empty.</div>
              ) : (
                <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                  {cart.items.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-2xl bg-elevated border border-subtle">
                      <img src={item.product.imageUrl || FALLBACK_IMG} alt={item.product.name} className="size-14 rounded-xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{item.product.name}</p>
                        <p className="text-xs text-faint">${item.product.price.toFixed(2)}</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => cart.setQuantity(item.product.id, Number(e.target.value) || 1)}
                        className="w-16 bg-elevated border border-subtle rounded-lg px-2 py-1 text-center font-bold"
                      />
                      <button onClick={() => cart.remove(item.product.id)} className="text-muted hover:text-red-400">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-subtle pt-4 space-y-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${cart.total().toFixed(2)}</span>
                </div>
                <motion.button
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={handleCheckout}
                  disabled={cart.items.length === 0 || checkingOut}
                  className="w-full bg-primary text-white font-black py-4 rounded-2xl disabled:opacity-50"
                >
                  {checkingOut ? 'Placing order…' : 'Checkout'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
