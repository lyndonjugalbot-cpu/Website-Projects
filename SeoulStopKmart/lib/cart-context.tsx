"use client";

// The shopping cart, kept entirely in the browser (React Context +
// localStorage) — there is no server-side "cart" table. It only becomes a
// real Order once the customer submits the checkout form
// (see lib/orders.ts). This means the cart survives page reloads/tab
// closes, but is per-browser, not per-account.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem } from "@/lib/types";

const STORAGE_KEY = "ecommerce-demo-cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotalCentavos: number;
  isLoaded: boolean;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// Wraps the whole app (see app/layout.tsx) so any component can read/update
// the cart via useCart() below.
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  // Avoids briefly rendering an empty cart before localStorage has been read.
  const [isLoaded, setIsLoaded] = useState(false);

  // On first mount, load whatever was saved from a previous visit.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Corrupt or inaccessible localStorage — start with an empty cart.
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Persist to localStorage every time the cart changes.
  useEffect(() => {
    if (!isLoaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, isLoaded]);

  // Adds a product to the cart, or increases its quantity if it's already
  // there — capped at the stock quantity known when the item was added.
  const addItem = useCallback<CartContextValue["addItem"]>((item, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + quantity, item.stock);
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: nextQuantity } : i
        );
      }
      return [...prev, { ...item, quantity: Math.min(quantity, item.stock) }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  // Sets a specific quantity for an item (used by the quantity stepper in
  // the cart page); removes the item entirely if set to 0 or below.
  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(quantity, i.stock) }
          : i
      );
    });
  }, []);

  // Empties the cart — called after an order is successfully placed.
  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );
  const subtotalCentavos = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.priceCentavos, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      itemCount,
      subtotalCentavos,
      isLoaded,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [items, itemCount, subtotalCentavos, isLoaded, addItem, removeItem, updateQuantity, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Hook every component uses to read the cart or call its actions —
// throws if used outside <CartProvider> (a bug, not a runtime edge case).
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
